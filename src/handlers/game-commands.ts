import { Composer, InlineKeyboard } from "grammy";
import {
  getActiveGame,
  updateGame,
  getPlayerByTelegramId,
  getGamePlayersWithInfo,
  getPlayerActiveGame,
  getCurrentRound,
} from "../db/client.js";
import { MESSAGES } from "../lib/messages.js";
import { getMessageQueue } from "../queue/message-queue.js";
import { invalidateGameCache } from "../lib/message-capture.js";
import type { PlayerRole, RoundPhase } from "../db/types.js";

// ---------------------------------------------------------------------------
// Game commands handler (Composer)
// ---------------------------------------------------------------------------

export const gameCommandsHandler = new Composer();

// ---------------------------------------------------------------------------
// /avbryt -- cancel the active game (admin only, group/supergroup)
// ---------------------------------------------------------------------------

gameCommandsHandler
  .chatType(["group", "supergroup"])
  .command("avbryt", async (ctx) => {
    if (!ctx.from) return;

    try {
      // 1. Get active game
      const game = await getActiveGame(ctx.chat.id);
      if (!game) {
        await ctx.reply(MESSAGES.LOBBY_NO_GAME);
        return;
      }

      // 2. Check permission -- only the game creator can cancel
      if (ctx.from.id !== game.admin_user_id) {
        await ctx.reply("Bara den som skapade spelet kan avbryta det, bre. 🚫");
        return;
      }

      // 3. Update game state to cancelled
      await updateGame(game.id, { state: "cancelled" });
      invalidateGameCache(game.group_chat_id);

      // 4. If game was in lobby state with a lobby message, edit to remove buttons
      if (game.state === "lobby" && game.lobby_message_id) {
        try {
          await ctx.api.editMessageText(
            ctx.chat.id,
            game.lobby_message_id,
            "Spelet avbröts. 🚫",
          );
        } catch {
          // Message may have been deleted -- ignore
        }
      }

      // 5. Send cancellation announcement to group
      const adminName =
        ctx.from.first_name || ctx.from.username || "Admin";
      const queue = getMessageQueue();
      await queue.send(
        ctx.chat.id,
        MESSAGES.GAME_CANCELLED(adminName),
        { parse_mode: "HTML" },
      );

      console.log(
        `[game-commands] Game ${game.id} cancelled by user ${ctx.from.id}`,
      );
    } catch (error) {
      console.error("[game-commands] /avbryt failed:", error);
      await ctx.reply("Något gick fel, bre. Försök igen. 🔧");
    }
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RulesPage = "roller" | "spelgang" | "vinst";

const RULES_PAGES: RulesPage[] = ["roller", "spelgang", "vinst"];

const RULES_PAGE_LABELS: Record<RulesPage, string> = {
  roller: "Roller",
  spelgang: "Spelgång",
  vinst: "Vinst",
};

/**
 * Build the inline keyboard for rules page navigation.
 * The current page label is wrapped with markers.
 */
function buildRulesKeyboard(currentPage: RulesPage): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const page of RULES_PAGES) {
    const label =
      page === currentPage
        ? `» ${RULES_PAGE_LABELS[page]} «`
        : RULES_PAGE_LABELS[page];
    kb.text(label, `rules:${page}`);
  }
  return kb;
}

/**
 * Map game states to Swedish display names.
 */
function getStateDisplayName(state: string): string {
  switch (state) {
    case "lobby":
      return "Lobby (väntar på spelare)";
    case "active":
      return "Pågår";
    case "finished":
      return "Avslutat";
    case "cancelled":
      return "Avbrutet";
    default:
      return state;
  }
}

/**
 * Map round phases to Swedish display names.
 */
function getPhaseDisplayName(phase: RoundPhase): string {
  switch (phase) {
    case "mission_posted":
      return "Uppdrag postat";
    case "nomination":
      return "Capo-val pågående";
    case "voting":
      return "Röstning pågående";
    case "execution":
      return "Stöten pågående";
    case "reveal":
      return "Resultat avslöjas";
  }
}

/**
 * Map roles to display info for DM /status.
 */
function getRoleDisplayInfo(
  role: PlayerRole,
): { name: string; abilities: string } {
  switch (role) {
    case "akta":
      return { name: "Äkta", abilities: "Inga specialförmågor" };
    case "golare":
      return { name: "Golare", abilities: "Vet vilka andra Golare är" };
    case "hogra_hand":
      return {
        name: "Guzmans Högra Hand",
        abilities: "Spaning (kolla en spelares roll)",
      };
  }
}

/**
 * Check if an error is the benign "message is not modified" Telegram error.
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
// /regler -- paginated rules display (works in group AND DM)
// ---------------------------------------------------------------------------

gameCommandsHandler.command("regler", async (ctx) => {
  try {
    const text = MESSAGES.RULES_PAGE("roller");
    const keyboard = buildRulesKeyboard("roller");
    await ctx.reply(text, { reply_markup: keyboard, parse_mode: "HTML" });
  } catch (error) {
    console.error("[game-commands] /regler failed:", error);
    await ctx.reply("Något gick fel, bre. Försök igen. 🔧");
  }
});

// ---------------------------------------------------------------------------
// rules:{page} callback -- navigate between rules pages
// ---------------------------------------------------------------------------

gameCommandsHandler.callbackQuery(/^rules:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  try {
    const page = ctx.match[1] as string;

    // Validate page is a known rules page
    if (!RULES_PAGES.includes(page as RulesPage)) return;

    const validPage = page as RulesPage;
    const text = MESSAGES.RULES_PAGE(validPage);
    const keyboard = buildRulesKeyboard(validPage);

    try {
      await ctx.editMessageText(text, {
        reply_markup: keyboard,
        parse_mode: "HTML",
      });
    } catch (editErr) {
      if (!isMessageNotModifiedError(editErr)) throw editErr;
    }
  } catch (error) {
    console.error("[game-commands] rules callback failed:", error);
  }
});

// ---------------------------------------------------------------------------
// /status -- show game status (works in group AND DM)
// ---------------------------------------------------------------------------

gameCommandsHandler.command("status", async (ctx) => {
  if (!ctx.from) return;

  try {
    const isPrivate = ctx.chat.type === "private";

    if (!isPrivate) {
      // --- Group chat: look up active game by group_chat_id ---
      const game = await getActiveGame(ctx.chat.id);
      if (!game) {
        await ctx.reply(MESSAGES.STATUS_NO_GAME_GROUP);
        return;
      }

      const players = await getGamePlayersWithInfo(game.id);

      // Determine display state: show round phase when game is active
      let displayState = getStateDisplayName(game.state);
      let capoName: string | undefined;

      if (game.state === "active") {
        const round = await getCurrentRound(game.id);
        if (round) {
          displayState = getPhaseDisplayName(round.phase);

          // Find Capo name
          if (round.capo_player_id) {
            const capoPlayer = players.find((gp) => gp.id === round.capo_player_id);
            if (capoPlayer) {
              capoName = capoPlayer.players.username
                ? `@${capoPlayer.players.username}`
                : capoPlayer.players.first_name || "Okänd";
            }
          }
        }
      }

      // Build player list with Capo marking
      const playerListWithCapo = players.map((gp) => {
        const name = gp.players.username
          ? `@${gp.players.username}`
          : gp.players.first_name || "Okänd";
        return {
          name,
          isCapo: capoName ? name === capoName : false,
        };
      });

      const statusText = MESSAGES.STATUS_TEXT({
        liganScore: game.ligan_score,
        ainaScore: game.aina_score,
        round: game.round,
        totalRounds: 5,
        state: displayState,
        players: playerListWithCapo,
        capo: capoName,
      });

      await ctx.reply(statusText, { parse_mode: "HTML" });
    } else {
      // --- DM: find the player's active game ---
      const player = await getPlayerByTelegramId(ctx.from.id);
      if (!player) {
        await ctx.reply(MESSAGES.STATUS_NO_GAME_DM);
        return;
      }

      const result = await getPlayerActiveGame(player.id);
      if (!result) {
        await ctx.reply(MESSAGES.STATUS_NO_GAME_DM);
        return;
      }

      const { game, gamePlayer } = result;
      const players = await getGamePlayersWithInfo(game.id);

      // Determine display state: show round phase when game is active
      let displayState = getStateDisplayName(game.state);
      let capoName: string | undefined;

      if (game.state === "active") {
        const round = await getCurrentRound(game.id);
        if (round) {
          displayState = getPhaseDisplayName(round.phase);

          // Find Capo name
          if (round.capo_player_id) {
            const capoPlayer = players.find((gp) => gp.id === round.capo_player_id);
            if (capoPlayer) {
              capoName = capoPlayer.players.username
                ? `@${capoPlayer.players.username}`
                : capoPlayer.players.first_name || "Okänd";
            }
          }
        }
      }

      const playerListWithCapo = players.map((gp) => {
        const name = gp.players.username
          ? `@${gp.players.username}`
          : gp.players.first_name || "Okänd";
        return {
          name,
          isCapo: capoName ? name === capoName : false,
        };
      });

      let statusText = MESSAGES.STATUS_TEXT({
        liganScore: game.ligan_score,
        ainaScore: game.aina_score,
        round: game.round,
        totalRounds: 5,
        state: displayState,
        players: playerListWithCapo,
        capo: capoName,
      });

      // Append role info if assigned
      if (gamePlayer.role) {
        const info = getRoleDisplayInfo(gamePlayer.role);
        statusText += MESSAGES.STATUS_DM_EXTRA(info.name, info.abilities);
      }

      await ctx.reply(statusText, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("[game-commands] /status failed:", error);
    await ctx.reply("Något gick fel, bre. Försök igen. 🔧");
  }
});
