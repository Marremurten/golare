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
} from "../db/client.js";
import { MESSAGES } from "../lib/messages.js";
import { getRandomError } from "../lib/errors.js";
import { getMessageQueue } from "../queue/message-queue.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PLAYERS = 4;
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
 * Build the inline keyboard for the lobby message.
 * Always shows join/leave. Shows start button when playerCount >= minPlayers.
 */
function buildLobbyKeyboard(
  gameId: string,
  playerCount: number,
  minPlayers: number,
): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("Jag är med! 🤝", `join:${gameId}`)
    .text("Hoppa av 👋", `leave:${gameId}`);

  if (playerCount >= minPlayers) {
    kb.row().text("Kör igång! 🔥", `start:${gameId}`);
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
      const headerText = MESSAGES.LOBBY_CREATED(adminName);
      const lobbyText = buildLobbyText([], MAX_PLAYERS);
      const fullText = `${headerText}\n\n${lobbyText}`;
      const keyboard = buildLobbyKeyboard(game.id, 0, MIN_PLAYERS);

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
      MESSAGES.LOBBY_CREATED(adminName) +
      "\n\n" +
      buildLobbyText(playerInfos, MAX_PLAYERS);
    const newKeyboard = buildLobbyKeyboard(
      gameId,
      updatedPlayers.length,
      MIN_PLAYERS,
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
      MESSAGES.LOBBY_CREATED(adminName) +
      "\n\n" +
      buildLobbyText(playerInfos, MAX_PLAYERS);
    const newKeyboard = buildLobbyKeyboard(
      gameId,
      updatedPlayers.length,
      MIN_PLAYERS,
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

    // 4. Transition to active state
    await updateGame(gameId, { state: "active" });

    // 5. Edit lobby message to remove buttons
    try {
      await ctx.editMessageText("Spelet har börjat! 🎬 Kolla era DMs, bre.", {
        parse_mode: "HTML",
      });
    } catch (editErr) {
      if (!isMessageNotModifiedError(editErr)) throw editErr;
    }

    // NOTE: Role assignment and DM delivery happens in Plan 02.
    // For now, start just transitions state and updates the lobby message.

    console.log(
      `[lobby] Game ${gameId} started by user ${ctx.from.id}`,
    );
  } catch (error) {
    console.error("[lobby] start callback failed:", error);
  }
});
