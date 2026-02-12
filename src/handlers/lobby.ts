import { Composer, InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import {
  createGame,
  getActiveGame,
  getGameById,
  updateGame,
  addPlayerToGame,
  removePlayerFromGame,
  getGamePlayers,
  getGamePlayersWithInfo,
  getPlayerByTelegramId,
  setPlayerRole,
  setJoinOrder,
} from "../db/client.js";
import { MESSAGES } from "../lib/messages.js";
import { getRandomError } from "../lib/errors.js";
import { getMessageQueue } from "../queue/message-queue.js";
import { assignRoles, ROLE_BALANCING } from "../lib/roles.js";
import { invalidateGameCache } from "../lib/message-capture.js";
import { startFirstRound } from "./game-loop.js";
import { callOutPlayer } from "./dm-flow.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PLAYERS = process.env.DEV_MODE === "true" ? 1 : 4;
const MAX_PLAYERS = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a user is a group admin or creator.
 */
async function isGroupAdmin(
  ctx: Context,
  chatId: number,
  userId: number,
): Promise<boolean> {
  try {
    const member = await ctx.api.getChatMember(chatId, userId);
    return member.status === "creator" || member.status === "administrator";
  } catch {
    return false;
  }
}

/**
 * Check if the bot itself is an admin or creator in the chat.
 * Required for message visibility (DATA-04).
 */
async function isBotAdmin(ctx: Context, chatId: number): Promise<boolean> {
  try {
    const botMember = await ctx.api.getChatMember(chatId, ctx.me.id);
    return botMember.status === "administrator" || botMember.status === "creator";
  } catch {
    return false;
  }
}

/**
 * Build the inline keyboard for the lobby message.
 * Always shows join/leave. Shows start button when playerCount >= minPlayers.
 */
function buildLobbyKeyboard(
  gameId: string,
  playerCount: number,
  minPlayers: number,
  tutorialMode: boolean,
): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("Jag är med! 🤝", `join:${gameId}`)
    .text("Hoppa av 👋", `leave:${gameId}`);

  if (playerCount >= minPlayers) {
    const tutorialLabel = tutorialMode ? "Tutorial ✅ 📖" : "Tutorial 📖";
    kb.row()
      .text(tutorialLabel, `tutorial:${gameId}`)
      .text("Kör igång! 🔥", `start:${gameId}`);
  }

  return kb;
}

/**
 * Build the lobby text showing player names and count.
 */
function buildLobbyText(
  players: Array<{ username: string | null; first_name: string | null }>,
  maxPlayers: number,
): string {
  const names = players.map((p) => {
    if (p.username) return `@${p.username}`;
    if (p.first_name) return p.first_name;
    return "Okänd";
  });
  return MESSAGES.LOBBY_TEXT(names, maxPlayers);
}

/**
 * Check if an error is the benign "message is not modified" Telegram error.
 * This happens when two players click join/leave at nearly the same time
 * and the second editMessageText call has the same content.
 */
function isMessageNotModifiedError(err: unknown): boolean {
  if (err && typeof err === "object" && "description" in err) {
    return String((err as { description: string }).description).includes(
      "message is not modified",
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// Lobby handler (Composer)
// ---------------------------------------------------------------------------

export const lobbyHandler = new Composer();

// ---------------------------------------------------------------------------
// /nyttspel command -- group/supergroup only
// ---------------------------------------------------------------------------

lobbyHandler
  .chatType(["group", "supergroup"])
  .command("nyttspel", async (ctx) => {
    if (!ctx.from) return;

    try {
      // 1. Check admin
      const admin = await isGroupAdmin(ctx, ctx.chat.id, ctx.from.id);
      if (!admin) {
        await ctx.reply(MESSAGES.LOBBY_NOT_ADMIN);
        return;
      }

      // 1b. Check bot is admin (required for message visibility -- DATA-04)
      const botAdmin = await isBotAdmin(ctx, ctx.chat.id);
      if (!botAdmin) {
        await ctx.reply(
          "Yo, jag behöver vara admin i gruppen för att kunna " +
          "se alla meddelanden. Gör mig till admin först, sen kör vi. 🔧"
        );
        return;
      }

      // 2. Check no active game
      const existing = await getActiveGame(ctx.chat.id);
      if (existing) {
        await ctx.reply(MESSAGES.LOBBY_GAME_EXISTS);
        return;
      }

      // 3. Create game
      const game = await createGame(ctx.chat.id, ctx.from.id);

      // 4. Build initial lobby message (0 players)
      const adminName =
        ctx.from.first_name || ctx.from.username || "Okänd admin";
      const headerText = MESSAGES.LOBBY_CREATED(adminName, ctx.me.username);
      const lobbyText = buildLobbyText([], MAX_PLAYERS);
      const fullText = `${headerText}\n\n${lobbyText}`;
      const keyboard = buildLobbyKeyboard(game.id, 0, MIN_PLAYERS, false);

      // 5. Send via message queue
      const queue = getMessageQueue();
      const sentMessage = await queue.send(ctx.chat.id, fullText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });

      // 6. Store lobby_message_id
      await updateGame(game.id, { lobby_message_id: sentMessage.message_id });

      console.log(
        `[lobby] Game ${game.id} created in chat ${ctx.chat.id} by user ${ctx.from.id}`,
      );
    } catch (error) {
      console.error("[lobby] /nyttspel failed:", error);
      await ctx.reply(getRandomError("LOBBY_ERROR"));
    }
  });

// ---------------------------------------------------------------------------
// Join callback: join:{gameId}
// ---------------------------------------------------------------------------

lobbyHandler.callbackQuery(/^join:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  try {
    const gameId = ctx.match[1];

    // 1. Get game and verify lobby state
    const game = await getGameById(gameId);
    if (!game || game.state !== "lobby") return;

    // 2. Check player is registered
    const player = await getPlayerByTelegramId(ctx.from.id);
    if (!player) {
      await ctx.answerCallbackQuery({
        text: MESSAGES.LOBBY_NOT_REGISTERED,
        show_alert: true,
      });
      // Post a clickable deep link in the group so the player can register
      const chatId = ctx.chat?.id;
      if (chatId) {
        await callOutPlayer(chatId, {
          telegramUserId: ctx.from.id,
          firstName: ctx.from.first_name,
          username: ctx.from.username,
        }, ctx.me.username);
      }
      return;
    }

    // 3. Check not already in game (silently ignore double-clicks)
    const currentPlayers = await getGamePlayers(gameId);
    if (currentPlayers.some((gp) => gp.player_id === player.id)) {
      return;
    }

    // 4. Check max players
    if (currentPlayers.length >= MAX_PLAYERS) {
      await ctx.answerCallbackQuery({
        text: MESSAGES.LOBBY_FULL,
      });
      return;
    }

    // 5. Add player
    await addPlayerToGame(gameId, player.id);

    // 6. Rebuild lobby message
    const updatedPlayers = await getGamePlayersWithInfo(gameId);
    const playerInfos = updatedPlayers.map((gp) => gp.players);

    // Look up admin name from the game creator (ctx.from is the joining player)
    const adminPlayer = await getPlayerByTelegramId(game.admin_user_id);
    const adminName =
      adminPlayer?.first_name || adminPlayer?.username || "Okänd admin";

    const newText =
      MESSAGES.LOBBY_CREATED(adminName, ctx.me.username) +
      "\n\n" +
      buildLobbyText(playerInfos, MAX_PLAYERS);
    const newKeyboard = buildLobbyKeyboard(
      gameId,
      updatedPlayers.length,
      MIN_PLAYERS,
      game.tutorial_mode ?? false,
    );

    // 7. Edit lobby message
    try {
      await ctx.editMessageText(newText, {
        reply_markup: newKeyboard,
        parse_mode: "HTML",
      });
    } catch (editErr) {
      if (!isMessageNotModifiedError(editErr)) throw editErr;
    }
  } catch (error) {
    console.error("[lobby] join callback failed:", error);
  }
});

// ---------------------------------------------------------------------------
// Leave callback: leave:{gameId}
// ---------------------------------------------------------------------------

lobbyHandler.callbackQuery(/^leave:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  try {
    const gameId = ctx.match[1];

    // 1. Get game and verify lobby state
    const game = await getGameById(gameId);
    if (!game || game.state !== "lobby") return;

    // 2. Get player
    const player = await getPlayerByTelegramId(ctx.from.id);
    if (!player) return;

    // 3. Remove player from game
    await removePlayerFromGame(gameId, player.id);

    // 4. Rebuild lobby message
    const updatedPlayers = await getGamePlayersWithInfo(gameId);
    const playerInfos = updatedPlayers.map((gp) => gp.players);

    // Need admin name for header -- look up from game's admin_user_id
    const adminPlayer = await getPlayerByTelegramId(game.admin_user_id);
    const adminName =
      adminPlayer?.first_name || adminPlayer?.username || "Okänd admin";

    const newText =
      MESSAGES.LOBBY_CREATED(adminName, ctx.me.username) +
      "\n\n" +
      buildLobbyText(playerInfos, MAX_PLAYERS);
    const newKeyboard = buildLobbyKeyboard(
      gameId,
      updatedPlayers.length,
      MIN_PLAYERS,
      game.tutorial_mode ?? false,
    );

    try {
      await ctx.editMessageText(newText, {
        reply_markup: newKeyboard,
        parse_mode: "HTML",
      });
    } catch (editErr) {
      if (!isMessageNotModifiedError(editErr)) throw editErr;
    }
  } catch (error) {
    console.error("[lobby] leave callback failed:", error);
  }
});

// ---------------------------------------------------------------------------
// Tutorial toggle callback: tutorial:{gameId}
// ---------------------------------------------------------------------------

lobbyHandler.callbackQuery(/^tutorial:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  try {
    const gameId = ctx.match[1];

    // 1. Get game and verify lobby state
    const game = await getGameById(gameId);
    if (!game || game.state !== "lobby") return;

    // 2. Only game creator can toggle tutorial mode
    if (ctx.from.id !== game.admin_user_id) {
      await ctx.answerCallbackQuery({
        text: "Bara den som skapade spelet kan ändra tutorial-läge, bre.",
        show_alert: true,
      });
      return;
    }

    // 3. Toggle tutorial_mode
    const newTutorialMode = !game.tutorial_mode;
    await updateGame(gameId, { tutorial_mode: newTutorialMode });

    // 4. Rebuild lobby message with updated keyboard
    const updatedPlayers = await getGamePlayersWithInfo(gameId);
    const playerInfos = updatedPlayers.map((gp) => gp.players);

    const adminPlayer = await getPlayerByTelegramId(game.admin_user_id);
    const adminName =
      adminPlayer?.first_name || adminPlayer?.username || "Okänd admin";

    const newText =
      MESSAGES.LOBBY_CREATED(adminName, ctx.me.username) +
      "\n\n" +
      buildLobbyText(playerInfos, MAX_PLAYERS);
    const newKeyboard = buildLobbyKeyboard(
      gameId,
      updatedPlayers.length,
      MIN_PLAYERS,
      newTutorialMode,
    );

    try {
      await ctx.editMessageText(newText, {
        reply_markup: newKeyboard,
        parse_mode: "HTML",
      });
    } catch (editErr) {
      if (!isMessageNotModifiedError(editErr)) throw editErr;
    }
  } catch (error) {
    console.error("[lobby] tutorial toggle failed:", error);
  }
});

// ---------------------------------------------------------------------------
// Start callback: start:{gameId}
// ---------------------------------------------------------------------------

lobbyHandler.callbackQuery(/^start:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  try {
    const gameId = ctx.match[1];

    // 1. Get game and verify lobby state
    const game = await getGameById(gameId);
    if (!game || game.state !== "lobby") return;

    // 2. Verify the person clicking is the game creator
    if (ctx.from.id !== game.admin_user_id) {
      await ctx.answerCallbackQuery({
        text: "Bara den som skapade spelet kan starta det, bre.",
        show_alert: true,
      });
      return;
    }

    // 3. Check minimum players
    const players = await getGamePlayersWithInfo(gameId);
    if (players.length < MIN_PLAYERS) {
      await ctx.answerCallbackQuery({
        text: MESSAGES.LOBBY_MIN_PLAYERS(MIN_PLAYERS),
        show_alert: true,
      });
      return;
    }

    // 4. Assign roles
    const playerIds = players.map((gp) => gp.player_id);
    const assignments = assignRoles(playerIds);
    const balancing = ROLE_BALANCING[players.length];

    // 5. Transition to active state with team_size
    await updateGame(gameId, { state: "active", team_size: balancing.teamSize });

    // Invalidate message capture cache (new game started)
    invalidateGameCache(game.group_chat_id);

    // 6. Save roles to database
    await Promise.all(
      assignments.map((a) => setPlayerRole(gameId, a.playerId, a.role)),
    );

    // 6b. Assign join_order based on joined_at ASC (for Capo rotation)
    const orderedPlayers = [...players].sort(
      (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    );
    await Promise.all(
      orderedPlayers.map((gp, i) =>
        setJoinOrder(gameId, gp.player_id, i + 1),
      ),
    );

    // 7. Edit lobby message to remove buttons
    try {
      await ctx.editMessageText("Spelet har börjat! 🎬 Kolla era DMs, bre.", {
        parse_mode: "HTML",
      });
    } catch (editErr) {
      if (!isMessageNotModifiedError(editErr)) throw editErr;
    }

    // 8. Build lookup maps for DMs
    const playerInfoMap = new Map(
      players.map((gp) => [gp.player_id, gp.players]),
    );

    const getDisplayName = (playerId: string): string => {
      const info = playerInfoMap.get(playerId);
      if (!info) return "Okänd";
      if (info.username) return `@${info.username}`;
      if (info.first_name) return info.first_name;
      return "Okänd";
    };

    // Build list of Golare player IDs for the Golare identity reveal
    const golareAssignments = assignments.filter((a) => a.role === "golare");

    // 9. Send role DMs simultaneously via Promise.all
    const queue = getMessageQueue();
    const dmPromises = assignments.map((assignment) => {
      const info = playerInfoMap.get(assignment.playerId);
      if (!info) {
        console.warn(
          `[lobby] No player info for ${assignment.playerId}, skipping DM`,
        );
        return Promise.resolve();
      }

      let dmText: string;
      switch (assignment.role) {
        case "golare": {
          const otherGolareNames = golareAssignments
            .filter((g) => g.playerId !== assignment.playerId)
            .map((g) => getDisplayName(g.playerId))
            .join(", ");
          dmText = MESSAGES.ROLE_REVEAL_GOLARE(otherGolareNames);
          break;
        }
        case "hogra_hand":
          dmText = MESSAGES.ROLE_REVEAL_HOGRA_HAND;
          break;
        case "akta":
        default:
          dmText = MESSAGES.ROLE_REVEAL_AKTA;
          break;
      }

      return queue
        .send(info.dm_chat_id, dmText, { parse_mode: "HTML" })
        .catch((err) => {
          console.error(
            `[lobby] Failed to send role DM to player ${assignment.playerId} (chat ${info.dm_chat_id}):`,
            err,
          );
        });
    });

    await Promise.all(dmPromises);

    // 10. Send dramatic game start monologue to group
    await queue.send(game.group_chat_id, MESSAGES.GAME_START_MONOLOGUE, {
      parse_mode: "HTML",
    });

    // 11. Auto-start round 1 immediately (compressed schedule)
    startFirstRound(gameId).catch((err) => {
      console.error(`[lobby] startFirstRound failed for game ${gameId}:`, err);
    });

    console.log(
      `[lobby] Game ${gameId} started by user ${ctx.from.id} with ${players.length} players`,
    );
  } catch (error) {
    console.error("[lobby] start callback failed:", error);
  }
});
