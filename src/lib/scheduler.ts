/**
 * Croner-based event scheduler for the game loop.
 * Fires 8 cron jobs on weekdays (Mon-Fri) in Europe/Stockholm timezone:
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
import { getAllActiveGames, getCurrentRound } from "../db/client.js";
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
};

// ---------------------------------------------------------------------------
// Scheduler state
// ---------------------------------------------------------------------------

const jobs: Cron[] = [];

// ---------------------------------------------------------------------------
// Start / Stop
// ---------------------------------------------------------------------------

/**
 * Start all 11 cron jobs on the Mon-Fri schedule.
 */
export function startScheduler(handlers: ScheduleHandlers): void {
  jobs.push(
    new Cron("0 9 * * 1-5", { timezone: TIMEZONE }, handlers.onMissionPost),
    new Cron("0 11 * * 1-5", { timezone: TIMEZONE }, handlers.onNominationReminder),
    new Cron("0 12 * * 1-5", { timezone: TIMEZONE }, handlers.onNominationDeadline),
    new Cron("0 13 * * 1-5", { timezone: TIMEZONE }, handlers.onWhisperAfternoon),
    new Cron("0 14 * * 1-5", { timezone: TIMEZONE }, handlers.onVotingReminder),
    new Cron("0 14,20 * * 1-5", { timezone: TIMEZONE }, handlers.onGapFill),
    new Cron("0 15 * * 1-5", { timezone: TIMEZONE }, handlers.onVotingDeadline),
    new Cron("0 17 * * 1-5", { timezone: TIMEZONE }, handlers.onExecutionReminder),
    new Cron("0 18 * * 1-5", { timezone: TIMEZONE }, handlers.onExecutionDeadline),
    new Cron("0 19 * * 1-5", { timezone: TIMEZONE }, handlers.onWhisperEvening),
    new Cron("0 21 * * 1-5", { timezone: TIMEZONE }, handlers.onResultReveal),
  );
  console.log("[scheduler] Started 11 cron jobs (Mon-Fri, Europe/Stockholm)");
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
    const dayOfWeek = stockholmTime.getDay(); // 0=Sun, 6=Sat

    // Only recover on weekdays
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log("[scheduler] Weekend -- skipping recovery");
      return;
    }

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

    console.log("[scheduler] Recovery check complete");
  } catch (err) {
    console.error("[scheduler] Recovery error:", err);
  }
}
