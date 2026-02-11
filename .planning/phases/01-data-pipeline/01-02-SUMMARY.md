---
phase: 01-data-pipeline
plan: 02
subsystem: middleware
tags: [grammy, middleware, message-capture, caching, bot-admin, fire-and-forget]

# Dependency graph
requires:
  - phase: 01-data-pipeline plan 01
    provides: player_messages table, createPlayerMessage/getGamePlayerByTelegramId/getActiveGame CRUD functions
provides:
  - capturePlayerMessage middleware function with DATA-03 filtering
  - invalidateGameCache export for game state transitions
  - Bot admin check (DATA-04) blocking /nyttspel if bot lacks admin
  - Cache invalidation at all 4 game state transition points
affects: [02-ai-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget middleware pattern, in-memory cache with TTL and explicit invalidation]

key-files:
  created:
    - src/lib/message-capture.ts
  modified:
    - src/bot.ts
    - src/handlers/lobby.ts
    - src/handlers/game-loop.ts
    - src/handlers/game-commands.ts

key-decisions:
  - "In-memory Map cache for game ID with 5-min TTL + explicit invalidation on state transitions"
  - "Bot admin check at /nyttspel (not at every message) -- lightweight gate for DATA-04"

patterns-established:
  - "Fire-and-forget middleware: capturePlayerMessage(ctx).catch() pattern -- never blocks handler chain"
  - "Cache invalidation pattern: explicit invalidateGameCache() at all state transitions (start, finish, cancel)"

# Metrics
duration: 3min
completed: 2026-02-11
---

# Phase 01 Plan 02: Message Capture Middleware Summary

**Fire-and-forget message capture middleware with DATA-03 filtering (bots, commands, non-players), bot admin gate on /nyttspel (DATA-04), and game ID cache with invalidation at all state transitions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-11T13:02:08Z
- **Completed:** 2026-02-11T13:04:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- New message-capture.ts module with capturePlayerMessage (filtering + caching) and invalidateGameCache
- bot.ts middleware extended with fire-and-forget capture call that never blocks grammY chain
- Bot admin check in /nyttspel blocks game creation if bot lacks admin status (DATA-04)
- Cache invalidation wired at all 4 state transitions: game start (lobby.ts), game finish x2 (game-loop.ts), game cancel (game-commands.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create message capture module with filtering and caching** - `e380a88` (feat)
2. **Task 2: Wire middleware, bot admin check, and cache invalidation** - `11f68b8` (feat)

## Files Created/Modified
- `src/lib/message-capture.ts` - New module: capturePlayerMessage with DATA-03 filtering, invalidateGameCache export, in-memory game ID cache with 5-min TTL
- `src/bot.ts` - Added capturePlayerMessage import and fire-and-forget call in group message middleware
- `src/handlers/lobby.ts` - Added isBotAdmin helper, bot admin check in /nyttspel (DATA-04), invalidateGameCache on game start
- `src/handlers/game-loop.ts` - Added invalidateGameCache import and calls at both game finish code paths (performFinalReveal + resolveExecution fallback)
- `src/handlers/game-commands.ts` - Added invalidateGameCache import and call on game cancel (/avbryt)

## Decisions Made
- In-memory Map cache for game ID with 5-min TTL + explicit invalidation -- avoids DB query on every group message while staying fresh on state transitions
- Bot admin check at /nyttspel (not at every message) -- lightweight gate that blocks game creation if bot can't see messages, without adding overhead to every update

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Bot must be set as group admin by users for message capture to work (enforced by DATA-04 check).

## Next Phase Readiness
- Full data pipeline complete: messages flow from group chat through filtering into player_messages table
- AI integration phase can now query getRecentPlayerMessages/getAllRecentMessages for behavioral analysis
- Zero new npm dependencies added (CONST-01 maintained)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 01-data-pipeline*
*Completed: 2026-02-11*
