import { Composer } from "grammy";
import { getActiveGame, updateGame } from "../db/client.js";
import { MESSAGES } from "../lib/messages.js";
import { getMessageQueue } from "../queue/message-queue.js";

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
