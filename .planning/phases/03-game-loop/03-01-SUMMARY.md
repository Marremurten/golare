---
phase: 03-game-loop
plan: 01
subsystem: database, game-engine, scheduler
tags: [supabase, croner, fsm, cron, typescript, telegram]

# Dependency graph
requires:
  - phase: 02-game-lobby
    provides: games/game_players tables, lobby flow, role assignment, message queue
provides:
  - rounds/votes/mission_actions/sista_chansen database tables
  - Round/Vote/MissionActionRow/SistaChansen TypeScript types
  - 13 CRUD functions for game loop data access
  - Pure FSM with 7 exported functions for phase transitions and game logic
  - Croner-based scheduler with 8 cron jobs (Mon-Fri Europe/Stockholm)
  - 31 Swedish Guzman-persona game loop message templates
  - join_order column on game_players for Capo rotation
affects: [03-02, 03-03, 03-04, 04-ai-narratives]

# Tech tracking
tech-stack:
  added: [croner@10.0.1]
  patterns: [pure-function FSM, global cron scheduler with DB queries, restart recovery, first-guess-wins via UNIQUE constraint]

key-files:
  created:
    - src/lib/game-state.ts
    - src/lib/scheduler.ts
  modified:
    - src/db/schema.sql
    - src/db/types.ts
    - src/db/client.ts
    - src/lib/messages.ts
    - src/lib/errors.ts
    - src/bot.ts
    - package.json

key-decisions:
  - "Croner 10.x for zero-dependency ESM-native timezone-aware cron scheduling"
  - "Pure FSM functions (no class, no side effects) for testable phase transitions"
  - "UNIQUE constraint on sista_chansen(game_id) for atomic first-guess-wins"
  - "Global scheduler (not per-game) with DB queries per tick for restart safety"
  - "Underscore prefix for unused teamSize param in computeMissionResult (_teamSize)"

patterns-established:
  - "FSM transitions as pure functions: nextRoundPhase(current, event) => next"
  - "Capo rotation: (roundNumber - 1 + failedVotes) % playerCount"
  - "Scheduler recovery: compare DB phase vs expected phase for current hour"
  - "Upsert with onConflict for idempotent vote/action casting"

# Metrics
duration: 7min
completed: 2026-02-10
---

# Phase 3 Plan 01: Game Loop Foundation Summary

**Database schema for rounds/votes/missions, pure FSM with 7 game logic functions, Croner scheduler with 8 Mon-Fri cron jobs, and 31 Swedish game loop message templates**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-10T14:33:37Z
- **Completed:** 2026-02-10T14:40:40Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Four new database tables (rounds, votes, mission_actions, sista_chansen) with proper constraints, indexes, and triggers
- Pure FSM in game-state.ts: nextRoundPhase, getCapoIndex, computeVoteResult, computeMissionResult, getTeamSize, getSistaChansenSide, checkWinCondition
- Croner scheduler with 8 cron jobs at fixed Stockholm times, restart recovery via recoverMissedEvents
- 31 game loop message templates in Guzman Swedish suburb slang persona
- 13 new CRUD functions in client.ts for all game loop data access
- Scheduler wired into bot.ts with placeholder handlers ready for Phase 3 plans 02-04

## Task Commits

Each task was committed atomically:

1. **Task 1: Database schema, types, and CRUD** - `e40f8c8` (feat)
2. **Task 2: Pure FSM and Croner scheduler** - `8f0ebea` (feat)
3. **Task 3: Template messages, error variants, and bot wiring** - `80d590b` (feat)

## Files Created/Modified
- `src/db/schema.sql` - Added rounds, votes, mission_actions, sista_chansen tables + join_order column
- `src/db/types.ts` - Added RoundPhase, VoteChoice, MissionAction, MissionResult, GuessingSide, Round, Vote, MissionActionRow, SistaChansen types + Database table definitions
- `src/db/client.ts` - Added 13 CRUD functions for game loop operations
- `src/lib/game-state.ts` - NEW: Pure FSM with 7 exported game logic functions
- `src/lib/scheduler.ts` - NEW: Croner-based scheduler with 8 cron jobs + restart recovery
- `src/lib/messages.ts` - Added 31 game loop message templates in Guzman persona
- `src/lib/errors.ts` - Added GAME_LOOP_ERROR variant
- `src/bot.ts` - Wired scheduler: startScheduler before bot.start, recoverMissedEvents in onStart, stopScheduler in shutdown
- `package.json` - Added croner@10.0.1 dependency

## Decisions Made
- Croner 10.x chosen for zero-dependency ESM-native timezone-aware cron (per research recommendation)
- Pure function FSM (no class, no side effects) for testability -- matches project decision "Custom FSM over XState"
- UNIQUE constraint on sista_chansen(game_id) enforces first-guess-wins atomically at DB level
- Global scheduler (one set of cron jobs for ALL active games) instead of per-game jobs -- avoids memory leaks, simplifies restart
- Upsert with onConflict for castVote and castMissionAction -- handles double-click race conditions gracefully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing join_order in getPlayerActiveGame return**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Adding join_order to GamePlayer type broke getPlayerActiveGame which manually constructed a GamePlayer object without the new field
- **Fix:** Added join_order: row.join_order to the return object
- **Files modified:** src/db/client.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** e40f8c8 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed GamePlayerInsert missing join_order**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** setJoinOrder uses .update({ join_order }) but GamePlayerInsert (and thus the Update type) didn't include join_order
- **Fix:** Added join_order?: number | null to GamePlayerInsert type
- **Files modified:** src/db/types.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** e40f8c8 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs from adding join_order to existing type)
**Impact on plan:** Both fixes were necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None -- all three tasks executed smoothly.

## User Setup Required
SQL migrations need to be run manually in the Supabase dashboard:
- Execute the new table CREATE statements from src/db/schema.sql
- Execute the ALTER TABLE game_players ADD COLUMN join_order INT statement

## Next Phase Readiness
- All game loop infrastructure is in place for Phase 3 plans 02-04
- Scheduler placeholder handlers ready to be replaced with real game logic
- FSM functions ready for integration in nomination, voting, and execution handlers
- Message templates ready for use in all game loop interactions

## Self-Check: PASSED

All 9 claimed files exist. All 3 commit hashes verified.

---
*Phase: 03-game-loop*
*Completed: 2026-02-10*
