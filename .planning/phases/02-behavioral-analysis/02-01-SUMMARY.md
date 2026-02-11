---
phase: 02-behavioral-analysis
plan: 01
subsystem: ai
tags: [behavioral-analysis, swedish-nlp, heuristic-tone, anomaly-detection, guzman-context]

# Dependency graph
requires:
  - phase: 01-data-pipeline
    provides: "getAllRecentMessages, getGamePlayersWithInfo, PlayerMessage type, message capture middleware"
provides:
  - "analyzeBehavior(gameId) orchestrator for per-player behavioral summaries"
  - "Pure functions: computePlayerStats, classifyTone, detectAnomalies, buildPlayerSummary"
  - "GuzmanContext.behavioralHistory for cross-round anomaly tracking"
  - "playerNotes populated on every round reveal via updateNarrativeContext"
affects: [03-whisper-targeting, 04-gap-fill-awareness, 05-mission-intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Heuristic Swedish keyword tone classification (no ML dependency)"
    - "Self-relative anomaly detection (player vs own history, not group)"
    - "Non-critical try/catch wrapping for behavioral analysis (CONST-04)"
    - "Structured label format for player summaries (token-efficient)"

key-files:
  created:
    - "src/lib/behavioral-analysis.ts"
  modified:
    - "src/db/types.ts"
    - "src/lib/ai-guzman.ts"

key-decisions:
  - "Heuristic keyword matching for tone (zero npm deps, CONST-01 compliant)"
  - "Anomaly detection relative to player's own history across rounds (not group baseline)"
  - "Structured label format for summaries instead of prose (token-efficient, ~50 tokens/player)"
  - "Non-critical behavioral analysis: failure never blocks game loop (CONST-04)"

patterns-established:
  - "Behavioral analysis as pure functions + async orchestrator pattern"
  - "Cross-round state via optional GuzmanContext fields (backward compatible)"
  - "Swedish NFC normalization for all text comparison"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 02 Plan 01: Behavioral Analysis Summary

**Heuristic Swedish tone classification and anomaly detection module populating GuzmanContext.playerNotes on every round reveal**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T13:50:15Z
- **Completed:** 2026-02-11T13:52:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created behavioral-analysis.ts with 4 pure functions (computePlayerStats, classifyTone, detectAnomalies, buildPlayerSummary) and 1 async orchestrator (analyzeBehavior)
- Extended GuzmanContext with optional behavioralHistory field for cross-round anomaly comparison
- Wired analyzeBehavior into updateNarrativeContext so playerNotes are populated on every round reveal
- Existing whisper prompts (ai-prompts.ts:150) automatically receive behavioral summaries with zero changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create behavioral-analysis.ts module and extend GuzmanContext type** - `099fd67` (feat)
2. **Task 2: Wire analyzeBehavior into updateNarrativeContext** - `be286bd` (feat)

## Files Created/Modified
- `src/lib/behavioral-analysis.ts` - Behavioral analysis module: stats computation, Swedish tone classification (5 categories), self-relative anomaly detection, structured summary builder, and async orchestrator
- `src/db/types.ts` - Extended GuzmanContext with optional behavioralHistory field
- `src/lib/ai-guzman.ts` - Added analyzeBehavior call in updateNarrativeContext with CONST-04 try/catch

## Decisions Made
- Heuristic Swedish keyword matching for tone classification (anklagande, defensiv, tyst, neutral, kaotisk) -- zero ML dependencies, CONST-01 compliant
- Anomaly detection compares player against their own behavioral history (not group baseline) -- more meaningful for detecting individual shifts
- Structured label format for summaries ("Ton: X | Aktivitet: Y | Riktar sig mot: Z | Anomali: W") -- token-efficient at ~50 tokens per player
- 200-char hard cap per player summary to respect CONST-02 token budget
- NFC normalization + toLowerCase for all Swedish text comparison

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- playerNotes now contain structured behavioral data on every round reveal
- Downstream AI prompts (whispers, gap-fill, missions) automatically receive this context
- behavioralHistory persists across rounds for anomaly detection baseline
- Ready for next plan in phase 02 or downstream phases

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 02-behavioral-analysis*
*Completed: 2026-02-11*
