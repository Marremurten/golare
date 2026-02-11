---
phase: 04-gap-fill-accusations
plan: 02
subsystem: ai, game-loop
tags: [behavioral-analysis, accusation, gap-fill, mood-adaptive, cron, message-queue]

# Dependency graph
requires:
  - phase: 04-gap-fill-accusations/01
    provides: "computeGroupMood, selectAccusationTarget, generateAccusation, mood-aware generateGapFillComment"
provides:
  - "Accusation delivery wired into gap-fill cron schedule"
  - "In-memory accusation frequency tracking (max 2/round, no escalation)"
  - "Mood-adaptive gap-fill gating (tense=always, active=quiet, calm=never)"
  - "Fresh behavioral data at cron time via analyzeBehavior"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-memory Map for accusation frequency tracking with round-based reset"
    - "Mood-gated gap-fill: tense=always, calm=never, active=when quiet"
    - "Accusation priority over gap-fill (no double messages per slot)"
    - "Fresh analyzeBehavior at cron time with fallback to stale playerNotes"

key-files:
  created: []
  modified:
    - "src/handlers/whisper-handler.ts"

key-decisions:
  - "Flat max 2 accusations per round across ALL rounds (locked user decision, no escalation)"
  - "Accusation fires skip gap-fill for that slot (no double messages)"
  - "Fresh analyzeBehavior at cron time, not stale GuzmanContext.playerNotes"
  - "Mood-adaptive gating: tense=always, calm=never, active=when quiet"

patterns-established:
  - "In-memory accusation tracking per game with round-based reset"
  - "Priority ordering: accusation > gap-fill in cron slots"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 04 Plan 02: Accusation Delivery and Mood-Adaptive Gap-Fill Wiring Summary

**Accusation delivery and mood-adaptive gap-fill wired into cron schedule with in-memory frequency tracking, fresh behavioral data at cron time, and priority ordering (accusation > gap-fill)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T17:57:38Z
- **Completed:** 2026-02-11T17:59:16Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Accusation delivery wired into existing 14:00/20:00 gap-fill cron with priority over gap-fill
- In-memory accusation frequency tracking enforces consistent max 2 per round (locked decision, no round-based escalation)
- Same player never accused twice in a row via getLastTargetName exclusion
- Mood-adaptive gap-fill gating: tense games always get gap-fill, calm games never, active games only when quiet
- Fresh behavioral data fetched at cron time via analyzeBehavior with graceful fallback to stale GuzmanContext.playerNotes
- All AI paths return null on failure -- game never blocks (CONST-04)
- No PlayerRole imports in accusation path (role-safe public accusations)

## Task Commits

Each task was committed atomically:

1. **Task 1: Accusation frequency tracking and delivery wiring** - `d4d0580` (feat)

## Files Modified
- `src/handlers/whisper-handler.ts` - Added accusation tracking state (AccusationState type, accusationTracking Map), frequency control helpers (canAccuse, recordAccusation, getLastTargetName), mood-adaptive gap-fill gating (shouldSendGapFill), and rewrote runGapFill with accusation + mood-adaptive logic

## Decisions Made
- Flat max 2 accusations per round across ALL rounds -- no round-based escalation (locked user decision)
- Accusation fires skip gap-fill for that cron slot (no double messages to group)
- Fresh analyzeBehavior at cron time instead of relying on stale GuzmanContext.playerNotes (only updated at result reveal)
- Mood-adaptive gating: tense=always send, calm=never send, active=only when quiet (existing behavior preserved for active mood)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 04 (gap-fill-accusations) is now complete
- Accusation system fully wired: behavioral data flows from analyzeBehavior through mood computation and target selection into AI-generated accusations delivered via MessageQueue
- Gap-fill commentary adapts to group mood
- Ready for Phase 05 if applicable, or v1.1 completion

## Self-Check: PASSED

- [x] `src/handlers/whisper-handler.ts` exists
- [x] Commit `d4d0580` exists in git log
- [x] `npx tsc --noEmit` passes with zero errors
- [x] `accusationTracking` Map present
- [x] All 4 helper functions present (canAccuse, recordAccusation, getLastTargetName, shouldSendGapFill)
- [x] No `PlayerRole` imports in accusation path
- [x] `generateAccusation` called with 5 args (no roundNumber)
- [x] `generateGapFillComment` called with 4 args (mood included)

---
*Phase: 04-gap-fill-accusations*
*Completed: 2026-02-11*
