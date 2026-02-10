/**
 * Whisper handler: scheduled whisper DMs, event-triggered bonus whispers,
 * and gap-fill commentary during quiet periods.
 *
 * NOT a Composer -- exports functions called by the scheduler and game-loop
 * event triggers. All outbound messages go through MessageQueue.
 *
 * Whispers are the paranoia engine: Guzman privately messages players with
 * a mix of truths, half-truths, and lies. Gap-fill keeps Guzman present
 * during quiet periods. Both are AI-only (disabled during fallback).
 */

import type { Bot } from "grammy";
import {
  getAllActiveGames,
  getCurrentRound,
  getGamePlayersOrderedWithInfo,
  getWhispersForPlayerInRound,
  createWhisper,
} from "../db/client.js";
import {
  generateWhisperMessage,
  generateGapFillComment,
  getGuzmanContext,
} from "../lib/ai-guzman.js";
import { getMessageQueue } from "../queue/message-queue.js";
import type { Game, GamePlayer, Player, Round, WhisperTrigger } from "../db/types.js";
import { randomInt } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Player with joined player info */
type PlayerWithInfo = GamePlayer & { players: Player };

/** Schedule handler functions returned by createWhisperHandler */
export type WhisperScheduleHandlers = {
  onWhisperAfternoon: () => Promise<void>;
  onWhisperEvening: () => Promise<void>;
  onGapFill: () => Promise<void>;
};

/** Event types that trigger bonus whispers */
export type WhisperEvent = "mission_failed" | "close_vote" | "kaos_triggered";

// ---------------------------------------------------------------------------
// Group activity tracking (for gap-fill)
// ---------------------------------------------------------------------------

type ActivityEntry = { count: number; lastReset: number };

/** Per-group message counter. Resets hourly. */
const groupActivity = new Map<number, ActivityEntry>();

/**
 * Track a message in a group chat for gap-fill activity monitoring.
 * Called from middleware in bot.ts for every group text message.
 */
export function trackGroupMessage(chatId: number): void {
  const now = Date.now();
  const entry = groupActivity.get(chatId);

  if (!entry || now - entry.lastReset > 60 * 60 * 1000) {
    // Reset if no entry or >1 hour since last reset
    groupActivity.set(chatId, { count: 1, lastReset: now });
  } else {
    entry.count++;
  }
}

/**
 * Check if a group is "quiet" (< 2 messages in the current hour window).
 * Only considers activity during 09:00-21:00 Stockholm time.
 */
function isGroupQuiet(chatId: number): boolean {
  const now = new Date();
  const stockholmTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }),
  );
  const hour = stockholmTime.getHours();

  // Only consider quiet during active game hours
  if (hour < 9 || hour >= 21) return false;

  const entry = groupActivity.get(chatId);
  if (!entry) return true; // No messages at all = quiet

  const hoursSinceReset = (Date.now() - entry.lastReset) / (60 * 60 * 1000);

  // If last reset was more than 2 hours ago, definitely quiet
  if (hoursSinceReset > 2) return true;

  // < 2 messages in current window = quiet
  return entry.count < 2;
}

// ---------------------------------------------------------------------------
// Module-level bot reference
// ---------------------------------------------------------------------------

let botRef: Bot | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a display name for a player (prefer username, fallback to first_name).
 */
function displayName(player: Player): string {
  if (player.username) return `@${player.username}`;
  if (player.first_name) return player.first_name;
  return "Okänd";
}

/**
 * Gather observable round events for whisper context.
 * NEVER includes role information -- only observable behavior.
 */
function gatherRoundEvents(
  game: Game,
  round: Round,
  players: PlayerWithInfo[],
): string {
  const events: string[] = [];

  // Score state
  events.push(`Ställning: Ligan ${game.ligan_score} - Aina ${game.aina_score}`);

  // Round phase
  events.push(`Runda ${round.round_number}, fas: ${round.phase}`);

  // Team selection (observable)
  if (round.team_player_ids.length > 0) {
    const teamNames = round.team_player_ids.map((id) => {
      const p = players.find((pl) => pl.id === id);
      return p ? displayName(p.players) : "Okänd";
    });
    events.push(`Valt team: ${teamNames.join(", ")}`);
  }

  // Failed votes (observable)
  if (round.consecutive_failed_votes > 0) {
    events.push(`Misslyckade röstningar i rad: ${round.consecutive_failed_votes}`);
  }

  // Previous mission result (observable)
  if (round.mission_result) {
    const resultText =
      round.mission_result === "success"
        ? "lyckades"
        : round.mission_result === "kaos_fail"
          ? "KAOS-fail"
          : "saboterad";
    events.push(`Senaste stöt: ${resultText}`);
  }

  return events.join(". ");
}

/**
 * Select 1-2 random players who haven't been whispered this round.
 */
async function selectWhisperTargets(
  game: Game,
  round: Round,
  players: PlayerWithInfo[],
  maxTargets: number,
): Promise<PlayerWithInfo[]> {
  // Filter to players not yet whispered this round
  const available: PlayerWithInfo[] = [];
  for (const player of players) {
    const existing = await getWhispersForPlayerInRound(
      game.id,
      player.id,
      round.round_number,
    );
    if (existing.length === 0) {
      available.push(player);
    }
  }

  if (available.length === 0) return [];

  // Select 1-2 randomly using Fisher-Yates partial shuffle
  const count = Math.min(maxTargets, available.length);
  const selected: PlayerWithInfo[] = [];

  for (let i = 0; i < count; i++) {
    const idx = randomInt(i, available.length);
    // Swap
    [available[i], available[idx]] = [available[idx], available[i]];
    selected.push(available[i]);
  }

  return selected;
}

/**
 * Send a whisper DM to a player and persist it.
 */
async function sendWhisper(
  game: Game,
  round: Round,
  target: PlayerWithInfo,
  players: PlayerWithInfo[],
  triggerType: WhisperTrigger,
): Promise<boolean> {
  try {
    const guzmanCtx = await getGuzmanContext(game.id);
    const otherNames = players
      .filter((p) => p.id !== target.id)
      .map((p) => displayName(p.players));
    const roundEvents = gatherRoundEvents(game, round, players);

    const whisperResult = await generateWhisperMessage(
      guzmanCtx,
      displayName(target.players),
      otherNames,
      roundEvents,
    );

    // AI unavailable or returned null -- skip silently
    if (!whisperResult) return false;

    // Send DM via message queue
    const queue = getMessageQueue();
    await queue.send(target.players.dm_chat_id, whisperResult.message, {
      parse_mode: "HTML",
    });

    // Persist whisper
    await createWhisper({
      game_id: game.id,
      round_number: round.round_number,
      target_player_id: target.id,
      message: whisperResult.message,
      truth_level: whisperResult.truthLevel,
      trigger_type: triggerType,
    });

    console.log(
      `[whisper] Sent ${triggerType} whisper to ${displayName(target.players)} ` +
        `(truth_level=${whisperResult.truthLevel}) in game ${game.id}`,
    );
    return true;
  } catch (err) {
    console.warn(
      `[whisper] Failed to send whisper to ${displayName(target.players)}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scheduled whisper logic
// ---------------------------------------------------------------------------

/**
 * Core scheduled whisper logic: for each active game, select 1-2 players
 * and send them manipulative DMs from Guzman.
 */
async function runScheduledWhispers(): Promise<void> {
  try {
    const games = await getAllActiveGames();

    for (const game of games) {
      try {
        const round = await getCurrentRound(game.id);
        if (!round) continue;

        const players = await getGamePlayersOrderedWithInfo(game.id);
        if (players.length === 0) continue;

        // Select 1-2 targets (use randomInt for count: 1 or 2)
        const maxTargets = players.length >= 4 ? randomInt(1, 3) : 1;
        const targets = await selectWhisperTargets(
          game,
          round,
          players,
          maxTargets,
        );

        for (const target of targets) {
          await sendWhisper(game, round, target, players, "scheduled");
        }
      } catch (gameErr) {
        console.error(
          `[whisper] Scheduled whisper failed for game ${game.id}:`,
          gameErr,
        );
      }
    }
  } catch (err) {
    console.error("[whisper] runScheduledWhispers failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Gap-fill logic
// ---------------------------------------------------------------------------

/**
 * Send gap-fill commentary to quiet groups.
 */
async function runGapFill(): Promise<void> {
  try {
    const games = await getAllActiveGames();

    for (const game of games) {
      try {
        // Check if group is quiet
        if (!isGroupQuiet(game.group_chat_id)) continue;

        const round = await getCurrentRound(game.id);
        if (!round) continue;

        const players = await getGamePlayersOrderedWithInfo(game.id);
        if (players.length === 0) continue;

        const guzmanCtx = await getGuzmanContext(game.id);
        const playerNames = players.map((p) => displayName(p.players));
        const recentActivity = gatherRoundEvents(game, round, players);

        const comment = await generateGapFillComment(
          guzmanCtx,
          recentActivity,
          playerNames,
        );

        // AI unavailable or returned null -- skip silently
        if (!comment) continue;

        const queue = getMessageQueue();
        await queue.send(game.group_chat_id, comment, {
          parse_mode: "HTML",
        });

        console.log(
          `[whisper] Sent gap-fill comment to group ${game.group_chat_id} for game ${game.id}`,
        );
      } catch (gameErr) {
        console.error(
          `[whisper] Gap-fill failed for game ${game.id}:`,
          gameErr,
        );
      }
    }
  } catch (err) {
    console.error("[whisper] runGapFill failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Event-triggered whispers
// ---------------------------------------------------------------------------

/**
 * Trigger a bonus whisper after a significant game event.
 * Fire-and-forget pattern: caller should .catch() to avoid unhandled rejections.
 */
export async function triggerEventWhisper(
  gameId: string,
  event: WhisperEvent,
): Promise<void> {
  try {
    // Need bot ref to be set (via createWhisperHandler)
    if (!botRef) {
      console.warn("[whisper] No bot reference, skipping event whisper");
      return;
    }

    const { getGameById } = await import("../db/client.js");
    const game = await getGameById(gameId);
    if (!game || game.state !== "active") return;

    const round = await getCurrentRound(gameId);
    if (!round) return;

    const players = await getGamePlayersOrderedWithInfo(gameId);
    if (players.length === 0) return;

    // Select 1 player for event whispers
    const targets = await selectWhisperTargets(game, round, players, 1);
    if (targets.length === 0) return;

    await sendWhisper(game, round, targets[0], players, "event");

    console.log(
      `[whisper] Event whisper triggered (${event}) for game ${gameId}`,
    );
  } catch (err) {
    console.warn(
      `[whisper] Event whisper failed (${event}) for game ${gameId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create whisper handler functions with access to the bot instance.
 * Returns schedule handlers (for scheduler) and triggerEventWhisper (for game-loop).
 */
export function createWhisperHandler(bot: Bot): WhisperScheduleHandlers {
  botRef = bot;

  return {
    onWhisperAfternoon: async (): Promise<void> => {
      console.log("[whisper] Running afternoon whispers (13:00)");
      await runScheduledWhispers();
    },

    onWhisperEvening: async (): Promise<void> => {
      console.log("[whisper] Running evening whispers (19:00)");
      await runScheduledWhispers();
    },

    onGapFill: async (): Promise<void> => {
      console.log("[whisper] Running gap-fill check (14:00/20:00)");
      await runGapFill();
    },
  };
}
