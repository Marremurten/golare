---
phase: 04-ai-guzman
plan: 03
subsystem: ai, messaging
tags: [openai, whispers, cron, gap-fill, telegram-dm, grammy]

# Dependency graph
requires:
  - phase: 04-01
    provides: AI client, generation functions (generateWhisperMessage, generateGapFillComment), whisper DB CRUD
provides:
  - Whisper handler module with scheduled and event-triggered whisper delivery
  - Gap-fill commentary system with group activity tracking
  - 3 new cron jobs (13:00, 19:00 whispers; 14:00/20:00 gap-fill)
  - Event whisper triggers in game-loop (mission_failed, close_vote, kaos_triggered)
  - Group message tracking middleware for activity monitoring
affects: [05-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget pattern for event whispers (.catch for non-blocking)"
    - "Module-level Map for in-memory group activity tracking (reset hourly)"
    - "Factory function pattern for handler creation with bot reference injection"
    - "Combined schedule handlers via spread operator in bot.ts"

key-files:
  created:
    - src/handlers/whisper-handler.ts
  modified:
    - src/lib/scheduler.ts
    - src/handlers/game-loop.ts
    - src/bot.ts

key-decisions:
  - "Fisher-Yates partial shuffle with node:crypto randomInt for unbiased player selection"
  - "Quiet threshold: < 2 messages in 2 hours during 09:00-21:00 for gap-fill trigger"
  - "Event whispers select 1 player (conservative), scheduled whispers 1-2 players"
  - "GameLoopScheduleHandlers Omit type to separate game-loop and whisper handler returns"

patterns-established:
  - "Fire-and-forget: triggerEventWhisper().catch() for non-blocking event whispers"
  - "Activity tracking: module-level Map with hourly reset window"
  - "Combined handlers: spread game-loop + whisper handlers into ScheduleHandlers"

# Metrics
duration: 4min
completed: 2026-02-10
---

# Phase 4 Plan 3: Viskningar (Whispers) Summary

**Manipulative whisper DMs with scheduled delivery (13:00/19:00), event-triggered bonus whispers, gap-fill commentary, and group activity tracking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-10T19:50:53Z
- **Completed:** 2026-02-10T19:55:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Whisper handler module with full scheduled delivery, event triggers, and gap-fill commentary
- Scheduler expanded from 8 to 11 cron jobs with whisper/gap-fill timing
- Event whispers fire-and-forget after failed missions, kaos triggers, and close votes
- Group activity tracking middleware enables quiet-period detection for gap-fill
- All features gracefully degrade when AI is unavailable (skip silently)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create whisper handler** - `9762f50` (feat)
2. **Task 2: Wire into scheduler, game-loop, bot.ts** - `051303f` (feat)

## Files Created/Modified
- `src/handlers/whisper-handler.ts` - New module: scheduled whispers, event triggers, gap-fill, group activity tracking
- `src/lib/scheduler.ts` - Added 3 whisper/gap-fill handler types and cron jobs (now 11 total)
- `src/handlers/game-loop.ts` - Added triggerEventWhisper calls for mission_failed, kaos_triggered, close_vote
- `src/bot.ts` - Group activity middleware, combined schedule handlers, whisper handler creation

## Decisions Made
- **Fisher-Yates with crypto.randomInt:** Used for unbiased random player selection in whisper targeting
- **Quiet threshold:** < 2 messages in 2 hours during 09:00-21:00 Stockholm time triggers gap-fill
- **GameLoopScheduleHandlers type:** Used Omit to separate game-loop handlers from whisper handlers, combined in bot.ts via spread
- **Event whisper count:** 1 player per event (conservative start), scheduled whispers 1-2 players
- **Dynamic import for getGameById in triggerEventWhisper:** Avoids circular dependency risk

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added GameLoopScheduleHandlers Omit type**
- **Found during:** Task 2 (wiring into scheduler)
- **Issue:** Adding 3 new fields to ScheduleHandlers type caused createScheduleHandlers in game-loop.ts to fail type check (missing new fields)
- **Fix:** Created `GameLoopScheduleHandlers = Omit<ScheduleHandlers, whisper fields>` and changed return type
- **Files modified:** src/handlers/game-loop.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 051303f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type fix necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Whispers use the existing OPENAI_API_KEY from Plan 01.

## Next Phase Readiness
- Phase 4 (AI Guzman) is now complete: foundation (01), narratives (02), and whispers (03)
- All AI features have template fallback or graceful skip when API key is missing
- Ready for Phase 5 (Polish)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 04-ai-guzman*
*Completed: 2026-02-10*
