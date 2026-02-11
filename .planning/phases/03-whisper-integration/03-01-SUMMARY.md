---
phase: 03-whisper-integration
plan: 01
subsystem: ai
tags: [openai, prompts, behavioral-analysis, whisper, swedish-nlp]

# Dependency graph
requires:
  - phase: 02-behavioral-analysis
    provides: "analyzeBehavior() populating GuzmanContext.playerNotes, TONE_KEYWORDS, PlayerMessage type"
provides:
  - "selectQuotesForWhisper() -- signal-scored message selection for whisper context"
  - "buildAllPlayerOverview() -- compressed multi-player behavioral summary"
  - "Rewritten buildWhisperPrompt() with 8-param signature, gossip-dealer persona, role calibration, round escalation"
affects: [03-whisper-integration-plan-02, ai-guzman, whisper-handler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-aware prompt calibration via switch on PlayerRole (aggressive/seductive/respectful)"
    - "Round-based prompt intensity escalation (vague 1-2, specific 3, pointed 4-5)"
    - "Gossip-dealer persona framing -- all behavioral data as rumors and gut feeling"
    - "4-strategy truth framework: SANNING, HALV_SANNING, LOGN, FORSAKRAN"

key-files:
  created: []
  modified:
    - "src/lib/behavioral-analysis.ts"
    - "src/lib/ai-prompts.ts"

key-decisions:
  - "Round-based escalation: vague early (1-2), specific mid (3), pointed late (4-5) -- solves thin-data problem and creates narrative arc"
  - "FORSAKRAN as 4th whisper strategy -- trust/reassurance as manipulation tool alongside truth/half-truth/lie"
  - "Keyword scoring uses flattened TONE_KEYWORDS (all values) rather than a separate keyword list"

patterns-established:
  - "Prompt-level role calibration: PlayerRole determines Guzman tone, never content"
  - "Behavioral data as AI-internal context: structured labels go in, natural gossip comes out"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 3 Plan 1: Whisper Prompt Behavioral Awareness Summary

**Gossip-dealer whisper prompt with message quote paraphrasing, all-player overview, role-aware paranoia calibration, and round-based intensity escalation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T14:34:50Z
- **Completed:** 2026-02-11T14:37:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Two pure helper functions for whisper data preparation: selectQuotesForWhisper (signal-scored message selection using flattened TONE_KEYWORDS) and buildAllPlayerOverview (compressed multi-player summary with 500-char hard cap)
- Completely rewritten buildWhisperPrompt with 8-parameter signature implementing gossip-dealer persona (skvallerkung), oblique-reference rules, role-aware paranoia calibration for all 3 roles, and round-based intensity escalation across 3 tiers
- Added FORSAKRAN (reassurance as manipulation) as 4th whisper strategy alongside SANNING, HALV_SANNING, LOGN

## Task Commits

Each task was committed atomically:

1. **Task 1: Add selectQuotesForWhisper and buildAllPlayerOverview** - `f3bb2f3` (feat)
2. **Task 2: Rewrite buildWhisperPrompt** - `971c62b` (feat)

## Files Created/Modified
- `src/lib/behavioral-analysis.ts` - Added selectQuotesForWhisper() and buildAllPlayerOverview() pure helper functions for whisper data preparation
- `src/lib/ai-prompts.ts` - Rewritten buildWhisperPrompt() with 8-param signature, gossip-dealer persona, behavioral data sections, role calibration, round escalation, and strict WHISP-03 oblique-reference rules

## Decisions Made
- **Round-based escalation implemented:** Vague/atmospheric for rounds 1-2, specific for round 3, maximum intensity for rounds 4-5. This solves the thin-data problem naturally (early rounds have less data) and creates a narrative arc where paranoia builds over the game.
- **FORSAKRAN as 4th strategy:** Added trust/reassurance ("du ar den enda jag litar pa") as a manipulation tool. Creates information asymmetry -- players who receive "trust" from Guzman are suspected by others.
- **Keyword scoring via flattened TONE_KEYWORDS:** selectQuotesForWhisper reuses the existing TONE_KEYWORDS constant (flattened via Object.values().flat()) rather than maintaining a separate keyword list. Single source of truth.
- **500-char hard cap on overview:** buildAllPlayerOverview truncates at 500 characters to respect CONST-02 token budget while providing meaningful multi-player context.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (caller updates) is ready to execute: ai-guzman.ts and whisper-handler.ts need updated call signatures to match the new 8-param buildWhisperPrompt
- Expected type error in ai-guzman.ts (TS2554: Expected 8 arguments, but got 4) confirms the signature change propagates correctly
- All behavioral data helpers are exported and ready for import by whisper-handler.ts

## Self-Check: PASSED

- FOUND: src/lib/behavioral-analysis.ts
- FOUND: src/lib/ai-prompts.ts
- FOUND: 03-01-SUMMARY.md
- FOUND: f3bb2f3 (Task 1 commit)
- FOUND: 971c62b (Task 2 commit)

---
*Phase: 03-whisper-integration*
*Completed: 2026-02-11*
