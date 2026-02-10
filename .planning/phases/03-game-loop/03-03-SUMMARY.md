---
phase: 03-game-loop
plan: 03
subsystem: handlers, game-engine, scheduler
tags: [grammy, telegram, inline-keyboard, callback-query, execution, reveal, win-condition]

# Dependency graph
requires:
  - phase: 03-game-loop
    plan: 02
    provides: game-loop.ts Composer with nomination/voting handlers, scheduler handler factory with execution/reveal stubs
provides:
  - ms: and mg: callback handlers for secret Sakra/Gola mission actions
  - sendExecutionDMs delivering action buttons to team after vote approval
  - resolveExecution with mission result computation, score updates, win condition check
  - checkAndResolveExecution for early resolution when all team members act
  - Real onExecutionReminder, onExecutionDeadline, onResultReveal scheduler handlers
  - /status round phase display with Swedish phase names and Capo marking
affects: [03-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [early execution resolution on all-acted, default-to-Sakra at deadline, shared resolveExecution for both early and scheduled paths]

key-files:
  created: []
  modified:
    - src/handlers/game-loop.ts
    - src/handlers/game-commands.ts

key-decisions:
  - "resolveExecution as shared helper for both early resolution and 21:00 scheduler"
  - "sendExecutionDMs called from handleVoteResult after vote approval and from onVotingDeadline"
  - "Default to Sakra (loyalty assumed) at 18:00 for missing actions"
  - "Game state set to finished on win (Sista Chansen flow deferred to Plan 04)"
  - "getPhaseDisplayName maps round phases to Swedish for /status display"

patterns-established:
  - "Early resolution pattern: checkAndResolveExecution checks all actions then calls shared resolveExecution"
  - "Execution DMs via Promise.all with catch-per-DM for partial failure tolerance"
  - "Dual-context round phase display: group and DM /status both show phase in Swedish"
  - "Capo marked with crown emoji in /status player list during active rounds"

# Metrics
duration: 4min
completed: 2026-02-10
---

# Phase 3 Plan 03: Execution and Result Reveal Summary

**Secret Sakra/Gola DM buttons for team members, early resolution on all-acted, 18:00 default-to-Sakra deadline, 21:00 result reveal with score updates and win condition, plus /status round phase display in Swedish**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-10T15:55:59Z
- **Completed:** 2026-02-10T16:00:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Full execution phase: DM buttons (Sakra/Gola) sent to team after vote approval, secret action recording, early resolution, deadline default
- Result reveal at 21:00: mission success/fail with sabotage count, score updates, win condition check
- Three scheduler stubs replaced with real handlers: onExecutionReminder (17:00), onExecutionDeadline (18:00), onResultReveal (21:00)
- /status now shows current round phase in Swedish with Capo marking for both group and DM contexts

## Task Commits

Each task was committed atomically:

1. **Task 1: Execution phase -- DM buttons, deadline, result reveal** - `fdc1d94` (feat)
2. **Task 2: Update /status with round phase display** - `4e9fb9c` (feat)

## Files Created/Modified
- `src/handlers/game-loop.ts` - Added ms:/mg: callback handlers, sendExecutionDMs, resolveExecution, checkAndResolveExecution, and three real scheduler handlers replacing stubs
- `src/handlers/game-commands.ts` - Added getPhaseDisplayName, updated group and DM /status to show round phase and Capo

## Decisions Made
- resolveExecution is a shared helper used by both the early resolution path (when all team members act before deadline) and the 21:00 scheduler -- avoids code duplication
- sendExecutionDMs uses Promise.all with catch-per-DM (partial DM failure does not block game progress) -- same pattern as existing role reveal DMs
- Default to Sakra (loyalty assumed) at 18:00 deadline, per CONTEXT.md user decision
- Game state set to "finished" on win condition -- Sista Chansen flow deferred to Plan 04 (which will intercept before finishing)
- onExecutionDeadline also handles lingering nomination phase (Capo rotation + Kaos-mataren) as a fallback for games stuck in nomination

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None -- both tasks executed smoothly.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- All daily round lifecycle phases are now complete: mission post, nomination, voting, execution, reveal
- Plan 04 (Sista Chansen) can intercept the win condition check to trigger the guessing flow before setting game to finished
- Scheduler has all 8 real handlers wired (no more stubs)
- /status provides full visibility into current game state for players

## Self-Check: PASSED

All 2 claimed files exist. Both commit hashes verified.

---
*Phase: 03-game-loop*
*Completed: 2026-02-10*
