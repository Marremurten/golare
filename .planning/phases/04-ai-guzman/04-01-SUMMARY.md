---
phase: 04-ai-guzman
plan: 01
subsystem: ai
tags: [openai, gpt-4o-mini, gpt-4.1-nano, zod, structured-output, swedish-nlp]

# Dependency graph
requires:
  - phase: 03-game-loop
    provides: "Game state machine, MESSAGES templates, round lifecycle"
  - phase: 01-foundation
    provides: "Supabase client, config pattern, message queue"
provides:
  - "OpenAI client singleton with tiered model selection"
  - "Guzman system prompt with orten persona and few-shot examples"
  - "5 prompt builders for mission, result, whisper, gap-fill messages"
  - "5 AI generation functions with template fallback on any failure"
  - "guzman_context JSONB column for narrative persistence"
  - "whispers table for tracking DM whispers"
  - "sanitizeForTelegram HTML sanitizer"
affects: [04-ai-guzman-02, 04-ai-guzman-03]

# Tech tracking
tech-stack:
  added: [openai@6.x, zod]
  patterns: [lazy-singleton-with-null-guard, try-catch-template-fallback, tiered-model-selection, zodResponseFormat-structured-output, narrative-context-compression]

key-files:
  created:
    - src/lib/ai-client.ts
    - src/lib/ai-prompts.ts
    - src/lib/ai-guzman.ts
  modified:
    - src/config.ts
    - src/db/schema.sql
    - src/db/types.ts
    - src/db/client.ts
    - package.json

key-decisions:
  - "Optional OPENAI_API_KEY -- game runs on templates when key is missing"
  - "gpt-4o-mini for narrative/whisper tiers, gpt-4.1-nano for commentary (cost optimization)"
  - "zodResponseFormat for structured whisper output (truth_level enum)"
  - "Narrative context compression: keep last 3 rounds detailed, drop beats for older"
  - "Whispers return null on failure (optional feature, never blocks game)"
  - "client.chat.completions.parse over deprecated beta.chat.completions.parse in OpenAI SDK v6"

patterns-established:
  - "AI fallback pattern: every generation function wraps OpenAI in try/catch with MESSAGES template fallback"
  - "Lazy AI client: getAIClient() returns null when key missing, callers check null first"
  - "Tiered model selection: MODEL_MAP maps message purpose to cost-appropriate model"
  - "Narrative context accumulation: per-round summaries with mood tracking across games"

# Metrics
duration: 5min
completed: 2026-02-10
---

# Phase 4 Plan 01: AI Guzman Foundation Summary

**OpenAI integration with tiered model selection, orten-Swedish Guzman persona prompt, 5 AI generation functions with template fallbacks, and DB schema for narrative context persistence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-10T19:40:39Z
- **Completed:** 2026-02-10T19:46:01Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- OpenAI client singleton with optional API key -- graceful degradation to templates when key is missing
- Complete Guzman orten persona system prompt with few-shot examples for 3 message styles
- 5 AI generation functions (mission narrative, result reveal, whisper, gap-fill, context update) each with try/catch template fallback
- DB schema for narrative context (guzman_context JSONB on games) and whispers table with truth_level/trigger_type constraints
- Structured whisper output via Zod schema with truth_level enum for game logic integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, config, and OpenAI client singleton** - `0b52ee0` (feat)
2. **Task 2: DB schema migration, types, and CRUD for narrative context + whispers** - `e7938f5` (feat)
3. **Task 3: Guzman system prompt, prompt builders, and AI generation module with fallbacks** - `f0a6ddc` (feat)

## Files Created/Modified

- `src/lib/ai-client.ts` - OpenAI lazy singleton with MODEL_MAP for tiered model selection
- `src/lib/ai-prompts.ts` - Guzman system prompt + 4 prompt builders (mission, result, whisper, gap-fill)
- `src/lib/ai-guzman.ts` - 5 AI generation functions with template fallback, sanitizeForTelegram, narrative context management
- `src/config.ts` - Added optional OPENAI_API_KEY config entry
- `src/db/schema.sql` - Added guzman_context JSONB column on games, whispers table with indexes
- `src/db/types.ts` - Added GuzmanContext, TruthLevel, WhisperTrigger, Whisper, WhisperInsert types + Database entry
- `src/db/client.ts` - Added 5 CRUD functions: getGuzmanContext, updateGuzmanContext, createWhisper, getWhispersForGame, getWhispersForPlayerInRound
- `package.json` - Added openai and zod dependencies

## Decisions Made

- **Optional API key**: OPENAI_API_KEY is not required -- game works fully on templates when missing. This preserves the "template fallbacks before AI" project decision.
- **Tiered models**: gpt-4o-mini for narrative/whisper (needs quality), gpt-4.1-nano for commentary (speed + cost). Addresses OpenAI cost management concern from STATE.md.
- **Structured whisper output**: Using zodResponseFormat to get typed truth_level from OpenAI, enabling game logic to track deception patterns.
- **Narrative compression**: Older round summaries drop narrative beats to keep prompt tokens manageable across 5 rounds.
- **OpenAI SDK v6 API**: Used `client.chat.completions.parse()` (not deprecated `beta.chat.completions.parse()`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed OpenAI SDK v6 API path for structured output**
- **Found during:** Task 3 (AI generation module)
- **Issue:** Plan specified `client.beta.chat.completions.parse()` which no longer exists in OpenAI SDK v6 -- `beta.chat` was removed
- **Fix:** Changed to `client.chat.completions.parse()` which is the current API in v6
- **Files modified:** src/lib/ai-guzman.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** f0a6ddc (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary API path correction for SDK compatibility. No scope creep.

## Issues Encountered

None beyond the auto-fixed SDK API path change.

## User Setup Required

**External services require manual configuration:**
- **OPENAI_API_KEY**: Required for AI-generated messages. Get from [OpenAI Dashboard -> API keys](https://platform.openai.com/api-keys). Without it, game runs normally using template messages.
- **Database migration**: Run the schema.sql additions (ALTER TABLE games ADD COLUMN guzman_context, CREATE TABLE whispers) against Supabase.

## Next Phase Readiness

- AI generation module is ready for Plans 02 and 03 to consume
- Plan 02 can import generateMissionNarrative, generateResultReveal to replace template calls in game loop
- Plan 03 can import generateWhisperMessage, generateGapFillComment for proactive engagement
- updateNarrativeContext ready to be called after each round resolves
- No blockers for next plans

## Self-Check: PASSED

All 7 files verified present. All 3 task commits verified in git log.

---
*Phase: 04-ai-guzman*
*Completed: 2026-02-10*
