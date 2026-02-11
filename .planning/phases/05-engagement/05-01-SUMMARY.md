---
phase: 05-engagement
plan: 01
subsystem: game-mechanics
tags: [grammy, supabase, openai, telegram-bot, engagement, whisper, surveillance]

# Dependency graph
requires:
  - phase: 04-ai-guzman
    provides: AI generation infrastructure (ai-client, ai-guzman, ai-prompts, Guzman persona)
  - phase: 03-game-loop
    provides: Game loop, rounds, team selection, scheduler, message queue
  - phase: 02-game-lobby
    provides: Player registration, game creation, role assignment
provides:
  - Anonymous whisper system (/viska) for non-team players to relay messages through Guzman
  - Surveillance system (/spana) for non-team players to get clues about team members
  - anonymous_whispers and surveillance DB tables with CRUD
  - AI generation for whisper relay and surveillance clues with template fallbacks
  - Engagement Composer handler registered in bot.ts
affects: [05-engagement-plan-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - In-memory Map with TTL for freeform text capture state
    - Callback data format with colon-separated parameters (wt:, sp:)
    - Freeform text handler with next() passthrough guard
    - 40% random notification using node:crypto randomInt

key-files:
  created:
    - src/handlers/engagement.ts
  modified:
    - src/db/schema.sql
    - src/db/types.ts
    - src/db/client.ts
    - src/lib/messages.ts
    - src/lib/ai-prompts.ts
    - src/lib/ai-guzman.ts
    - src/bot.ts

key-decisions:
  - "Freeform text handler registered LAST in Composer with next() guard to avoid eating other DM text messages"
  - "Pending whisper state uses in-memory Map with 5-minute TTL (same pattern as Sista Chansen)"
  - "Surveillance limited to once per round per player via UNIQUE constraint on (game_id, surveiller_player_id, round_number)"
  - "40% surveillance target notification chance using node:crypto randomInt for security-grade randomness"
  - "Whisper relay uses narrative tier (gpt-4o-mini) for quality; surveillance clue uses commentary tier (gpt-4.1-nano) for cost"
  - "Role hints in whisper relay are Guzman-flavored cryptic hints, never direct role reveals"

patterns-established:
  - "Engagement commands are DM-only (.chatType('private')) with active game context verification"
  - "Non-team player eligibility check reused across /viska and /spana commands"
  - "Callback data format: wt:{gameId}:{target} for whispers, sp:{gameId}:{roundNumber}:{index} for surveillance"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 5 Plan 01: Engagement Mechanics Summary

**Anonymous whisper (/viska) and surveillance (/spana) commands for non-team players with AI-generated relay and clue messages, DB persistence, and template fallbacks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T08:20:40Z
- **Completed:** 2026-02-11T08:26:09Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Full anonymous whisper flow: /viska -> target selection -> freeform text capture -> AI relay to group/player DM
- Full surveillance flow: /spana -> team member selection -> AI clue generation -> 40% target notification
- DB tables with proper constraints (UNIQUE for one-surveillance-per-round enforcement)
- AI generation with template fallbacks for both features (game never blocks on OpenAI)

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema, types, CRUD, and template messages** - `9ddae9e` (feat)
2. **Task 2: AI generation functions for whisper relay and surveillance clues** - `1b4a615` (feat)
3. **Task 3: Engagement handler (Composer) with /viska, /spana, and bot.ts registration** - `321d171` (feat)

## Files Created/Modified
- `src/handlers/engagement.ts` - Engagement Composer with /viska, /spana commands, callback handlers, freeform text capture (515 lines)
- `src/db/schema.sql` - anonymous_whispers and surveillance tables with indexes and constraints
- `src/db/types.ts` - AnonymousWhisper, Surveillance, WhisperTargetType type aliases + Database type entries
- `src/db/client.ts` - createAnonymousWhisper, createSurveillance, getSurveillanceForPlayerInRound CRUD functions
- `src/lib/messages.ts` - 14 engagement message templates with proper Swedish characters
- `src/lib/ai-prompts.ts` - buildWhisperRelayPrompt and buildSurveillanceCluePrompt builders
- `src/lib/ai-guzman.ts` - generateWhisperRelay (narrative tier) and generateSurveillanceClue (commentary tier)
- `src/bot.ts` - engagementHandler registration after gameLoopHandler

## Decisions Made
- Freeform text handler registered LAST in Composer with next() passthrough guard to avoid eating other DM text messages
- Pending whisper state uses in-memory Map with 5-minute TTL (same pattern as Sista Chansen)
- Surveillance limited to once per round per player via UNIQUE constraint
- 40% surveillance target notification chance using node:crypto randomInt
- Whisper relay uses narrative tier (gpt-4o-mini) for quality; surveillance clue uses commentary tier (gpt-4.1-nano) for cost
- Role hints in whisper relay are Guzman-flavored cryptic hints, never direct role reveals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Engagement mechanics complete, non-team players now have /viska and /spana during active rounds
- Ready for Plan 02 (if applicable) or phase completion
- All AI generation gracefully degrades to templates when OPENAI_API_KEY is not set

## Self-Check: PASSED

All 8 files verified present. All 3 task commits verified in git log.

---
*Phase: 05-engagement*
*Completed: 2026-02-11*
