/**
 * Message capture module for behavioral tracking (v1.1).
 *
 * Captures player text messages from group chats and stores them in the
 * player_messages table. Called fire-and-forget from the bot middleware
 * (bot.ts) -- errors propagate to the caller's `.catch()` handler.
 *
 * Filtering (DATA-03):
 *   - Bot messages are excluded
 *   - Commands (starting with "/") are excluded
 *   - Non-player messages (spectators) are excluded
 *   - Messages outside active games are excluded
 */

import type { Context } from "grammy";
import {
  getActiveGame,
  getGamePlayerByTelegramId,
  createPlayerMessage,
} from "../db/client.js";

// ---------------------------------------------------------------------------
// In-memory game ID cache (same pattern as groupActivity Map in whisper-handler)
// ---------------------------------------------------------------------------

const gameIdCache = new Map<number, { gameId: string; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidate the cached game ID for a group chat.
 * Call when game state changes (start, finish, cancel) so the next
 * message lookup fetches fresh data from the database.
 */
export function invalidateGameCache(groupChatId: number): void {
  gameIdCache.delete(groupChatId);
}

/**
 * Capture a player's text message from a group chat and store it for
 * behavioral analysis. This function is called fire-and-forget from
 * the bot middleware -- it does NOT wrap in try/catch internally.
 * Errors propagate to the caller's `.catch()` handler in bot.ts.
 *
 * Filtering rules (DATA-03):
 *   - No `ctx.from` or no text → skip
 *   - Bot messages (`is_bot`) → skip
 *   - Commands (text starts with "/") → skip
 *   - No active game for this group → skip
 *   - Sender is not a player in the active game → skip
 */
export async function capturePlayerMessage(ctx: Context): Promise<void> {
  // Guard clauses -- DATA-03 filtering
  if (!ctx.from || !ctx.message?.text) return;
  if (ctx.from.is_bot) return;
  if (ctx.message.text.startsWith("/")) return;

  // Extract data
  const groupChatId = ctx.chat!.id;
  const text = ctx.message.text.slice(0, 500); // truncate for safety

  // Resolve game_id from cache or database
  let gameId: string | null = null;

  const cached = gameIdCache.get(groupChatId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    gameId = cached.gameId;
  } else {
    const game = await getActiveGame(groupChatId);
    if (game && game.state !== "finished" && game.state !== "cancelled") {
      gameId = game.id;
      gameIdCache.set(groupChatId, { gameId: game.id, cachedAt: Date.now() });
    } else {
      gameIdCache.delete(groupChatId);
      return;
    }
  }

  // Resolve game_player_id -- skip if sender is not a player (spectator)
  const gamePlayer = await getGamePlayerByTelegramId(gameId, ctx.from.id);
  if (!gamePlayer) return;

  // Store message (fire-and-forget insert, ring buffer pruning at DB level)
  await createPlayerMessage({
    game_id: gameId,
    game_player_id: gamePlayer.id,
    message_text: text,
  });
}
