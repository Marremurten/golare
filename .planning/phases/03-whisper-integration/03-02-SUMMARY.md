---
phase: 03-whisper-integration
plan: 02
subsystem: ai
tags: [whisper-pipeline, behavioral-data, verbatim-safety, graceful-degradation]

# Dependency graph
requires:
  - phase: 03-whisper-integration
    plan: 01
    provides: "selectQuotesForWhisper(), buildAllPlayerOverview(), rewritten buildWhisperPrompt() with 8-param signature"
provides:
  - "Complete whisper pipeline: data gathering -> AI generation -> verbatim safety check -> send"
  - "Every whisper DM informed by target quotes, all-player overview, target role, round number"
  - "Verbatim quote safety check with one-retry logic"
affects: [whisper-delivery, ai-guzman, game-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verbatim safety check: post-generation substring match on quotes >= 8 chars with single retry"
    - "Reassurance truth level mapped to 'truth' at return boundary (type stays unchanged)"
    - "Graceful degradation on message fetch failure: empty quotes, whisper still sends (CONST-04)"

key-files:
  created: []
  modified:
    - "src/lib/ai-guzman.ts"
    - "src/handlers/whisper-handler.ts"

key-decisions:
  - "Verbatim check threshold at 8 characters: short phrases like 'bre' or 'wallah' are too common to be meaningful matches"
  - "Map 'reassurance' to 'truth' at ai-guzman boundary rather than modifying TruthLevel type in types.ts"
  - "Single retry on verbatim detection, then return anyway: CONST-04 pattern (never block whispers)"

patterns-established:
  - "Post-generation safety checks with bounded retry (prevent infinite loops)"
  - "Behavioral data gathering with try/catch fallback at call site (not inside helpers)"

# Metrics
duration: 2min
completed: 2026-02-11
---

# Phase 3 Plan 2: Whisper Pipeline Behavioral Wiring Summary

**End-to-end whisper pipeline wiring: database message fetch, behavioral data selection, AI generation with expanded context, and post-generation verbatim safety check**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-11T14:41:27Z
- **Completed:** 2026-02-11T14:43:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Expanded generateWhisperMessage from 4 to 8 parameters, passing target role, target quotes, all-player overview, and round number through to the rewritten buildWhisperPrompt
- Added WhisperResponseSchema "reassurance" enum value with mapping to "truth" TruthLevel at return boundary
- Implemented containsVerbatimQuote helper with 8-character minimum threshold and one-retry safety logic
- Wired sendWhisper to fetch target player's recent messages via getRecentPlayerMessages, select best quotes via selectQuotesForWhisper, build all-player overview via buildAllPlayerOverview, and extract target role and round number
- Graceful degradation on message fetch failure: empty quotes array, whisper still generates and sends

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand generateWhisperMessage signature and add verbatim safety check** - `e6f792e` (feat)
2. **Task 2: Wire behavioral data gathering into sendWhisper** - `2a66911` (feat)

## Files Created/Modified
- `src/lib/ai-guzman.ts` - Expanded generateWhisperMessage to 8 params, added "reassurance" to WhisperResponseSchema, added containsVerbatimQuote helper with one-retry safety, increased max_tokens to 500, mapped reassurance->truth at return
- `src/handlers/whisper-handler.ts` - Added imports for selectQuotesForWhisper, buildAllPlayerOverview, getRecentPlayerMessages; updated sendWhisper to gather behavioral data with graceful degradation; pass all 8 params to generateWhisperMessage

## Decisions Made
- **Verbatim threshold at 8 characters:** Short phrases like "bre", "wallah", "asså" are common Swedish slang that would trigger false positives. 8 chars is long enough to catch actual quote leaks while avoiding noise.
- **Map reassurance to truth (not new type):** Adding a 4th TruthLevel would require DB migration and downstream changes. Since reassurance is closest to truth in intent (it's a manipulation tool, not a lie), mapping at the ai-guzman boundary keeps the change surgical.
- **Single retry, then return anyway:** Verbatim safety is a best-effort check. Blocking whisper delivery over a failed safety check would violate CONST-04 (non-critical AI features never block game flow). One retry gives 2 chances; if both fail, the whisper still sends.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification Results
- `npx tsc --noEmit` passes with zero src/ errors
- Import chain verified: whisper-handler.ts -> behavioral-analysis.ts (selectQuotesForWhisper, buildAllPlayerOverview), db/client.ts (getRecentPlayerMessages)
- Import chain verified: ai-guzman.ts -> ai-prompts.ts (buildWhisperPrompt with 8 params)
- generateWhisperMessage call in whisper-handler passes all 8 parameters
- Verbatim safety check with "[ai-guzman] Verbatim quote detected" log message confirmed present
- No new npm dependencies added (CONST-01)
- WHISP-01 (target quotes in whisper), WHISP-02 (all-player overview), WHISP-03 (verbatim safety) all wired end-to-end

## Self-Check: PASSED

- FOUND: src/lib/ai-guzman.ts
- FOUND: src/handlers/whisper-handler.ts
- FOUND: 03-02-SUMMARY.md
- FOUND: e6f792e (Task 1 commit)
- FOUND: 2a66911 (Task 2 commit)

---
*Phase: 03-whisper-integration*
*Completed: 2026-02-11*
