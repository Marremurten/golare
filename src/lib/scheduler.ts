/**
 * Croner-based event scheduler for the game loop.
 * Fires 8 cron jobs daily in Europe/Stockholm timezone:
 *   09:00 - Mission post
 *   11:00 - Nomination reminder (1h before deadline)
 *   12:00 - Nomination deadline
 *   14:00 - Voting reminder (1h before deadline)
 *   15:00 - Voting deadline
 *   17:00 - Execution reminder (1h before deadline)
 *   18:00 - Execution deadline
 *   21:00 - Result reveal
 *
 * The scheduler is global (not per-game). Each handler queries the DB
 * for all active games and processes them.
 */

import { Cron } from "croner";
import { getAllActiveGames, getCurrentRound, getSistaChansen } from "../db/client.js";
import { checkWinCondition } from "./game-state.js";
import type { RoundPhase } from "../db/types.js";

const TIMEZONE = "Europe/Stockholm";

// ---------------------------------------------------------------------------
// Handler interface
// ---------------------------------------------------------------------------

export type ScheduleHandlers = {
  onMissionPost: () => Promise<void>;
  onNominationReminder: () => Promise<void>;
  onNominationDeadline: () => Promise<void>;
  onVotingReminder: () => Promise<void>;
  onVotingDeadline: () => Promise<void>;
  onExecutionReminder: () => Promise<void>;
  onExecutionDeadline: () => Promise<void>;
  onResultReveal: () => Promise<void>;
  onWhisperAfternoon: () => Promise<void>;
  onWhisperEvening: () => Promise<void>;
  onGapFill: () => Promise<void>;
  /** Recover Sista Chansen games stuck after restart (optional). */
  onSistaChansensRecovery?: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Scheduler state
// ---------------------------------------------------------------------------

const jobs: Cron[] = [];

// ---------------------------------------------------------------------------
// Start / Stop
// ---------------------------------------------------------------------------

/**
 * Start all 11 cron jobs on the daily schedule.
 */
export function startScheduler(handlers: ScheduleHandlers): void {
  jobs.push(
    new Cron("0 9 * * *", { timezone: TIMEZONE }, handlers.onMissionPost),
    new Cron("0 11 * * *", { timezone: TIMEZONE }, handlers.onNominationReminder),
    new Cron("0 12 * * *", { timezone: TIMEZONE }, handlers.onNominationDeadline),
    new Cron("0 13 * * *", { timezone: TIMEZONE }, handlers.onWhisperAfternoon),
    new Cron("0 14 * * *", { timezone: TIMEZONE }, handlers.onVotingReminder),
    new Cron("0 14,20 * * *", { timezone: TIMEZONE }, handlers.onGapFill),
    new Cron("0 15 * * *", { timezone: TIMEZONE }, handlers.onVotingDeadline),
    new Cron("0 17 * * *", { timezone: TIMEZONE }, handlers.onExecutionReminder),
    new Cron("0 18 * * *", { timezone: TIMEZONE }, handlers.onExecutionDeadline),
    new Cron("0 19 * * *", { timezone: TIMEZONE }, handlers.onWhisperEvening),
    new Cron("0 21 * * *", { timezone: TIMEZONE }, handlers.onResultReveal),
  );
  console.log("[scheduler] Started 11 cron jobs (daily, Europe/Stockholm)");
}

/**
 * Stop all cron jobs and clear the array.
 */
export function stopScheduler(): void {
  for (const job of jobs) job.stop();
  jobs.length = 0;
  console.log("[scheduler] All jobs stopped");
}

// ---------------------------------------------------------------------------
// Restart recovery
// ---------------------------------------------------------------------------

/**
 * Expected phase for each time window (Stockholm time).
 * Maps the current hour to the phase that should have been reached.
 */
const PHASE_BY_HOUR: Array<{ hour: number; phase: RoundPhase }> = [
  { hour: 21, phase: "reveal" },
  { hour: 18, phase: "execution" },
  { hour: 15, phase: "voting" },
  { hour: 12, phase: "nomination" },
  { hour: 9, phase: "mission_posted" },
];

/**
 * Phase progression order (lower index = earlier in the day).
 */
const PHASE_ORDER: Record<RoundPhase, number> = {
  mission_posted: 0,
  nomination: 1,
  voting: 2,
  execution: 3,
  reveal: 4,
};

/**
 * Recover missed scheduled events after bot restart.
 * Checks all active games and fires the appropriate handler
 * if their current round phase is behind the expected phase
 * for the current time.
 */
export async function recoverMissedEvents(
  handlers: ScheduleHandlers,
): Promise<void> {
  try {
    const games = await getAllActiveGames();
    if (games.length === 0) return;

    // Get current Stockholm hour
    const now = new Date();
    const stockholmTime = new Date(
      now.toLocaleString("en-US", { timeZone: TIMEZONE }),
    );
    const currentHour = stockholmTime.getHours();
    // Determine expected phase for current time
    let expectedPhase: RoundPhase | null = null;
    for (const entry of PHASE_BY_HOUR) {
      if (currentHour >= entry.hour) {
        expectedPhase = entry.phase;
        break;
      }
    }

    if (!expectedPhase) {
      console.log("[scheduler] Before 09:00 -- no recovery needed");
      return;
    }

    const expectedOrder = PHASE_ORDER[expectedPhase];

    for (const game of games) {
      const round = await getCurrentRound(game.id);
      if (!round) {
        // No round yet -- if past 09:00 we need to post mission
        if (currentHour >= 9) {
          console.log(`[scheduler] Recovery: triggering onMissionPost for game ${game.id}`);
          await handlers.onMissionPost();
        }
        continue;
      }

      const currentOrder = PHASE_ORDER[round.phase];

      // If the round's phase is behind where it should be, fire the handler
      if (currentOrder < expectedOrder) {
        console.log(
          `[scheduler] Recovery: game ${game.id} is in phase "${round.phase}" ` +
          `but expected "${expectedPhase}" -- firing catch-up handlers`,
        );

        // Fire the handler for the expected phase
        // (in a more sophisticated system, we'd fire each missed handler in sequence,
        //  but since each handler checks DB state, firing the current one is sufficient)
        switch (expectedPhase) {
          case "nomination":
            await handlers.onNominationDeadline();
            break;
          case "voting":
            await handlers.onVotingDeadline();
            break;
          case "execution":
            await handlers.onExecutionDeadline();
            break;
          case "reveal":
            await handlers.onResultReveal();
            break;
          default:
            await handlers.onMissionPost();
        }
      }
    }

    // Recover Sista Chansen games stuck after restart
    if (handlers.onSistaChansensRecovery) {
      try {
        await handlers.onSistaChansensRecovery();
      } catch (scErr) {
        console.error("[scheduler] Sista Chansen recovery error:", scErr);
      }
    }

    console.log("[scheduler] Recovery check complete");
  } catch (err) {
    console.error("[scheduler] Recovery error:", err);
  }
}

/**
 * Find active games stuck in Sista Chansen state (win condition met,
 * game still active, no resolved guess in sista_chansen table).
 * Returns game IDs that need recovery.
 */
export async function findSistaChansensGames(): Promise<string[]> {
  const games = await getAllActiveGames();
  const stuckGameIds: string[] = [];

  for (const game of games) {
    const winner = checkWinCondition(game.ligan_score, game.aina_score);
    if (!winner) continue; // No win condition -- not in Sista Chansen

    // Game has a winner but is still active -- check if guess was already made
    const existing = await getSistaChansen(game.id);
    if (!existing) {
      // No guess recorded -- this game is stuck in Sista Chansen
      stuckGameIds.push(game.id);
    }
  }

  return stuckGameIds;
}
