---
phase: 04-gap-fill-accusations
plan: 01
subsystem: ai
tags: [behavioral-analysis, ai-prompts, mood-computation, accusations, gap-fill]

# Dependency graph
requires:
  - phase: 02-behavioral-analysis
    provides: "playerNotes with tone/activity/anomaly summaries"
  - phase: 03-whisper-integration
    provides: "behavioral-analysis.ts module, ai-guzman.ts generation pattern"
provides:
  - "computeGroupMood() for deriving group mood from playerNotes"
  - "selectAccusationTarget() for anomaly-based target selection"
  - "buildAccusationPrompt() for role-safe public accusation prompts"
  - "buildGapFillPrompt() mood-aware always-provocative gap-fill prompts"
  - "generateAccusation() with null fallback (never fabricates)"
  - "generateGapFillComment() with groupMood parameter"
affects: [04-gap-fill-accusations-02, whisper-handler]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Null fallback for accusations (no template -- never fabricates)"
    - "GroupMood type: tense/active/calm derived from playerNotes"
    - "Anomaly-based accusation targeting with last-target exclusion"

key-files:
  modified:
    - src/lib/behavioral-analysis.ts
    - src/lib/ai-prompts.ts
    - src/lib/ai-guzman.ts
    - src/handlers/whisper-handler.ts

key-decisions:
  - "Accusation generation returns null on AI failure -- no template fallback per never-fabricates constraint"
  - "GroupMood computed at call time from playerNotes, never stored"
  - "Gap-fill always provocative, mood only adapts angle/content"

patterns-established:
  - "Null fallback pattern: when AI-generated content must reference real data, skip on failure instead of templating"
  - "GroupMood as runtime computation, not persisted state"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 04 Plan 01: Mood-Adaptive Gap-Fill and Accusation Building Blocks

**Group mood computation from behavioral data, anomaly-based accusation target selection, mood-aware always-provocative gap-fill prompts, and role-safe public accusation generation with null-on-failure semantics**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T17:48:55Z
- **Completed:** 2026-02-11T17:54:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- computeGroupMood derives tense/active/calm from playerNotes behavioral summaries using threshold logic
- selectAccusationTarget scans for anomaly signals with last-target exclusion and cryptographic random selection
- buildAccusationPrompt generates street-boss intimidation prompts that reference only observed anomalies, never roles
- buildGapFillPrompt now mood-adaptive with always-provocative content (locked user decision)
- generateAccusation returns null on any failure -- no template, per "never fabricates" constraint

## Task Commits

Each task was committed atomically:

1. **Task 1: Group mood computation and accusation target selection** - `39a0bd8` (feat)
2. **Task 2: Mood-aware gap-fill prompt and accusation prompt builder** - `bdeaa57` (feat)
3. **Task 3: generateAccusation function and mood-aware generateGapFillComment** - `247b5e7` (feat)

## Files Created/Modified
- `src/lib/behavioral-analysis.ts` - Added computeGroupMood(), selectAccusationTarget(), GroupMood type
- `src/lib/ai-prompts.ts` - Added buildAccusationPrompt(), updated buildGapFillPrompt with groupMood
- `src/lib/ai-guzman.ts` - Added generateAccusation(), updated generateGapFillComment with groupMood
- `src/handlers/whisper-handler.ts` - Fixed caller with default mood for compilation (Plan 02 will wire properly)

## Decisions Made
- Accusation generation returns null on AI failure -- no template fallback (per "never fabricates" constraint)
- GroupMood computed at call time from playerNotes, never stored in DB
- Gap-fill commentary always provocative regardless of mood (locked user decision) -- mood only adapts angle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed whisper-handler caller after buildGapFillPrompt signature change**
- **Found during:** Task 3 (generateAccusation and mood-aware generateGapFillComment)
- **Issue:** Changing buildGapFillPrompt from 3 to 4 params broke existing caller in whisper-handler.ts
- **Fix:** Added default "active" mood string to existing call site with comment noting Plan 02 will wire properly
- **Files modified:** src/handlers/whisper-handler.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 247b5e7 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for compilation. Default "active" mood is safe -- Plan 02 will replace with computeGroupMood() call.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All building blocks ready for Plan 02 to wire into gap-fill schedule
- computeGroupMood and selectAccusationTarget ready to be called from whisper-handler runGapFill
- generateAccusation ready to be called with target data from selectAccusationTarget

## Self-Check: PASSED

All 4 files verified on disk. All 3 task commits verified in git log.

---
*Phase: 04-gap-fill-accusations*
*Completed: 2026-02-11*
