---
phase: 05-engagement
plan: 02
subsystem: game-mechanics
tags: [spaning, investigation, scoring, role-reveal, telegram, ai, grammy]

# Dependency graph
requires:
  - phase: 05-01
    provides: "Engagement handler Composer with whisper and surveillance patterns"
  - phase: 04-ai-guzman
    provides: "AI generation framework with model tiers and template fallbacks"
  - phase: 03-game-loop
    provides: "resolveExecution, handleKaosFail, performFinalReveal functions"
provides:
  - "/spaning command for Akta (75% truth, cryptic) and Hogra Hand (100% truth, direct)"
  - "player_spanings table with one-per-game enforcement"
  - "Anti-blowout double scoring for rounds 4-5 (getRoundPointValue)"
  - "One-by-one dramatic role reveal sorted by role (Akta -> Hogra Hand -> Golare)"
  - "generateSpaningAnswer and generateIndividualReveal AI functions with fallbacks"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node:crypto randomInt for probabilistic truthfulness (75% threshold)"
    - "Role-sorted sequential message delivery with suspense delays"
    - "MODEL_MAP tier selection based on message complexity"

key-files:
  created:
    - "src/db/schema.sql (player_spanings table)"
  modified:
    - "src/db/types.ts"
    - "src/db/client.ts"
    - "src/handlers/engagement.ts"
    - "src/lib/game-state.ts"
    - "src/lib/messages.ts"
    - "src/lib/ai-prompts.ts"
    - "src/lib/ai-guzman.ts"
    - "src/handlers/game-loop.ts"

key-decisions:
  - "75% truthful threshold for Akta Spaning using node:crypto randomInt"
  - "Hogra Hand Spaning always 100% truthful with direct presentation"
  - "Role reveal order: Akta first (warm), Hogra Hand middle (respectful), Golare last (dramatic)"
  - "gpt-4o-mini for Akta Spaning (needs nuance), gpt-4.1-nano for Hogra Hand and reveals (simple/cheap)"
  - "Double points capped at 3 via Math.min in both resolveExecution and handleKaosFail"

patterns-established:
  - "ATOMIC INSERT with catch for one-per-game Spaning enforcement (same as Sista Chansen)"
  - "getRoundPointValue pure function for anti-blowout scoring logic"
  - "Sequential role-sorted message delivery for dramatic reveal"

# Metrics
duration: 5min
completed: 2026-02-11
---

# Phase 5 Plan 02: Spaning, Double Scoring, and Dramatic Role Reveal Summary

**Spaning investigation (one-per-game, role-differentiated), anti-blowout double scoring in rounds 4-5, and sequential one-by-one role reveal sorted Akta-first/Golare-last**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-11T08:30:48Z
- **Completed:** 2026-02-11T08:36:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Spaning investigation system with role-based truthfulness: Akta gets 75% truth cryptic answer, Hogra Hand gets 100% truth direct answer
- Anti-blowout double scoring: rounds 4-5 award 2 points instead of 1, all scores capped at 3 via Math.min
- Dramatic one-by-one role reveal replacing batch FINAL_REVEAL: sorted Akta first, Hogra Hand middle, Golare last with AI-generated text per player
- Anonymous group notification when anyone uses Spaning ("Nagon har bett mig kolla runt...")
- All AI generation has template fallbacks for graceful degradation without OpenAI

## Task Commits

Each task was committed atomically:

1. **Task 1: Spaning DB, types, CRUD, AI prompts, and /spaning handler** - `e855489` (feat)
2. **Task 2: Anti-blowout double scoring and one-by-one dramatic role reveal** - `864435d` (feat)

## Files Created/Modified
- `src/db/schema.sql` - Added player_spanings table with UNIQUE(game_id, player_id)
- `src/db/types.ts` - Added PlayerSpaning, PlayerSpaningInsert types and Database entry
- `src/db/client.ts` - Added createPlayerSpaning and getPlayerSpaning CRUD
- `src/handlers/engagement.ts` - Added /spaning command and sn: callback with role-based truthfulness
- `src/lib/game-state.ts` - Added getRoundPointValue for anti-blowout scoring
- `src/lib/messages.ts` - Added Spaning templates, role reveal templates, double-point score template
- `src/lib/ai-prompts.ts` - Added buildSpaningPrompt and buildIndividualRevealPrompt
- `src/lib/ai-guzman.ts` - Added generateSpaningAnswer and generateIndividualReveal
- `src/handlers/game-loop.ts` - Modified resolveExecution, handleKaosFail (double points), performFinalReveal (one-by-one)

## Decisions Made
- 75% truthful threshold for Akta Spaning using `randomInt(0, 100) < 75` (same crypto module as existing patterns)
- Hogra Hand Spaning is always 100% truthful with direct, unambiguous presentation
- Role reveal sorted: Akta first (warm tone), Hogra Hand middle (respectful/mysterious), Golare last (maximum drama)
- AI model selection: gpt-4o-mini for Akta Spaning (needs subtlety/nuance), gpt-4.1-nano for Hogra Hand and individual reveals (simple, cost-efficient)
- FINAL_REVEAL template kept in messages.ts but no longer used in performFinalReveal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 5 engagement mechanics are complete
- All 5 phases of the project are now complete
- Full game loop: lobby -> role assignment -> round mechanics -> AI Guzman narrative -> engagement (whispers, surveillance, spaning, double scoring, dramatic reveal)

---
*Phase: 05-engagement*
*Completed: 2026-02-11*
