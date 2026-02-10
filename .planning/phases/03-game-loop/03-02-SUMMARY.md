---
phase: 03-game-loop
plan: 02
subsystem: handlers, game-engine, scheduler
tags: [grammy, telegram, inline-keyboard, callback-query, nomination, voting, kaos-mataren]

# Dependency graph
requires:
  - phase: 03-game-loop
    plan: 01
    provides: rounds/votes tables, FSM functions, scheduler, message templates, CRUD
provides:
  - game-loop.ts Composer with 4 callback handlers (nt, nc, vj, vn)
  - createScheduleHandlers factory with 5 real + 3 stub scheduler handlers
  - Nomination toggle/confirm flow with toggleable inline keyboard
  - Team voting flow with live tally and full reveal
  - Kaos-mataren escalation (warnings at 1/2, auto-fail at 3)
  - Capo rotation on failed vote/timeout
  - join_order assignment at game start for predictable Capo rotation
affects: [03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [toggleable inline keyboard for multi-select, live vote tally with edit, shared vote result handler for both callback and scheduler contexts, safeEditMessage wrapper]

key-files:
  created:
    - src/handlers/game-loop.ts
  modified:
    - src/db/client.ts
    - src/handlers/lobby.ts
    - src/bot.ts

key-decisions:
  - "Shared handleVoteResult function for both callback and scheduler vote resolution paths"
  - "deleteVotesForRound on Capo rotation to allow fresh voting cycle"
  - "safeEditMessage wrapper for ignoring benign 'message is not modified' errors"
  - "Callback data uses full round UUID (nt:{uuid}:{idx}) -- well within 64-byte limit"
  - "Vote tally edited in-place on the vote message (not a new message)"

patterns-established:
  - "Toggleable inline keyboard: [x]/[ ] prefix per button, rebuild on each toggle"
  - "Live tally pattern: edit vote message with who-voted, then reveal all at deadline"
  - "Scheduler handlers as closure factory: createScheduleHandlers(bot) captures bot instance"
  - "Per-game error catching in scheduler loops: one game failure doesn't block others"

# Metrics
duration: 6min
completed: 2026-02-10
---

# Phase 3 Plan 02: Mission Posting, Nomination, and Voting Summary

**1058-line game-loop.ts with toggleable nomination keyboard, live vote tally, Kaos-mataren escalation, and Capo rotation -- wired into bot.ts with real scheduler handlers**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-10T15:45:39Z
- **Completed:** 2026-02-10T15:52:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created game-loop.ts (1058 lines) as a Composer with 4 callback handlers and a createScheduleHandlers factory
- Nomination flow: toggleable inline keyboard where Capo selects/deselects players, confirm button appears at correct team size
- Voting flow: JA/NEJ inline buttons, live tally showing who voted (not how), full reveal when all vote or deadline hits
- Kaos-mataren escalation: KAOS_WARNING_1 at first failed vote, KAOS_WARNING_2 at second, KAOS_TRIGGERED at third with auto-fail
- Capo rotation on failed vote and nomination timeout, with fresh nomination prompt
- Vote deletion on Capo rotation for clean re-voting
- Scheduler handlers: onMissionPost creates rounds and posts mission, onNominationDeadline sends nomination keyboard, onVotingDeadline resolves votes
- Reminder handlers: onNominationReminder (11:00) and onVotingReminder (14:00) send group + DM reminders
- lobby.ts assigns join_order (1..N) at game start based on joined_at order
- bot.ts registers gameLoopHandler and wires real scheduler handlers via createScheduleHandlers(bot)

## Task Commits

Each task was committed atomically:

1. **Task 1: Game loop handler** - `f75e5d0` (feat)
2. **Task 2: Bot wiring and lobby join_order** - `c210729` (feat)

## Files Created/Modified
- `src/handlers/game-loop.ts` - NEW: 1058-line Composer with nomination/voting callback handlers and scheduler handler factory
- `src/db/client.ts` - Added getGamePlayersOrderedWithInfo, getRoundById, deleteVotesForRound functions
- `src/handlers/lobby.ts` - Added join_order assignment at game start (step 6b)
- `src/bot.ts` - Registered gameLoopHandler, replaced placeholder scheduler with createScheduleHandlers(bot)

## Decisions Made
- Shared handleVoteResult function used by both callback context (all players voted inline) and scheduler context (deadline reached) to avoid code duplication
- Votes are deleted (deleteVotesForRound) when Capo rotates so new vote cycle starts clean -- simpler than trying to track which votes belong to which nomination attempt
- safeEditMessage wrapper handles the "message is not modified" error gracefully for all bot.api.editMessageText calls
- Callback data format: nt:{roundUUID}:{playerIndex} -- uses full round UUID (36 chars + prefix stays well under 64 bytes)
- Execution and reveal scheduler handlers remain as stubs (planned for 03-03/03-04)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added getGamePlayersOrderedWithInfo to client.ts**
- **Found during:** Task 1
- **Issue:** Game loop handlers need player names and dm_chat_id alongside join_order sorting, but only getGamePlayersOrdered (no player info) and getGamePlayersWithInfo (no join_order sort) existed
- **Fix:** Added getGamePlayersOrderedWithInfo that joins game_players with players and orders by join_order ASC
- **Files modified:** src/db/client.ts
- **Committed in:** f75e5d0 (Task 1 commit)

**2. [Rule 3 - Blocking] Added getRoundById to client.ts**
- **Found during:** Task 1
- **Issue:** Callback handlers receive round UUID in callback data and need to look up the round, but no getRoundById function existed (only getCurrentRound which gets latest round by game_id)
- **Fix:** Added getRoundById that selects a round by its UUID
- **Files modified:** src/db/client.ts
- **Committed in:** f75e5d0 (Task 1 commit)

**3. [Rule 3 - Blocking] Added deleteVotesForRound to client.ts**
- **Found during:** Task 1
- **Issue:** When Capo rotates after a failed vote, old votes need to be cleared for the new voting cycle. No deletion function existed.
- **Fix:** Added deleteVotesForRound that deletes all votes for a given round_id
- **Files modified:** src/db/client.ts
- **Committed in:** f75e5d0 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all blocking -- missing DB functions needed by game-loop handlers)
**Impact on plan:** All three additions were essential for the handler to function. No scope creep.

## Issues Encountered
None -- both tasks executed smoothly.

## Next Phase Readiness
- Execution phase handlers (03-03): onExecutionReminder and onExecutionDeadline are stub-wired, ready for implementation
- Result reveal (03-04): onResultReveal is stub-wired, ready for implementation
- All nomination/voting infrastructure is complete and tested via TypeScript compilation

## Self-Check: PASSED

All 4 claimed files exist. Both commit hashes verified.
