---
phase: 03-game-loop
plan: 04
subsystem: game-logic
tags: [telegram, inline-keyboard, sista-chansen, endgame, reveal, supabase, unique-constraint]

# Dependency graph
requires:
  - phase: 03-game-loop/03-02
    provides: "Game loop handler with mission, nomination, voting"
  - phase: 03-game-loop/03-03
    provides: "Execution, reveal, win condition check, resolveExecution"
provides:
  - "Sista Chansen symmetric endgame mechanic"
  - "Atomic first-guess-wins via UNIQUE constraint"
  - "Dramatic multi-message reveal with 30s pacing"
  - "Full role reveal at game end"
  - "Complete 5-round game flow from start to finish"
affects: [04-ai-guzman, 05-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level botRef for cross-context bot access (resolveExecution -> Sista Chansen)"
    - "In-memory Maps for transient Sista Chansen state (DM message IDs, timeouts, candidates)"
    - "sleep() helper for dramatic message pacing"

key-files:
  created: []
  modified:
    - src/handlers/game-loop.ts
    - src/db/client.ts
    - src/lib/messages.ts

key-decisions:
  - "Module-level botRef set in createScheduleHandlers for resolveExecution to access bot instance"
  - "In-memory Maps for Sista Chansen transient state (not DB) since it's ephemeral per-game session"
  - "Candidates list derived as all players minus guessers (prevents information leakage)"
  - "Game stays active during Sista Chansen, only transitions to finished after full reveal"

patterns-established:
  - "botRef pattern: store bot reference at handler creation for use in async callbacks"
  - "In-memory timeout tracking with Map<gameId, timeout> for clearable async flows"
  - "sleep() for paced multi-message sequences"

# Metrics
duration: 9min
completed: 2026-02-10
---

# Phase 3 Plan 04: Sista Chansen Endgame and Final Reveal Summary

**Symmetric Sista Chansen guess mechanic with atomic first-guess-wins, 2-hour timeout, dramatic 30s-paced reveal, and full role unveiling**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-10T17:30:40Z
- **Completed:** 2026-02-10T17:39:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Sista Chansen triggers on any win condition (3 successes or 3 failures), keeping game active for the guessing phase
- Guessing team receives individual DMs with candidate inline buttons; first click atomically locks the guess via UNIQUE constraint
- Group announcement tells guessing team to discuss in group chat before voting via DM
- All guessers' DM buttons removed after first guess; 2-hour timeout auto-resolves with no guess
- Dramatic final reveal with 30-second delays between suspense, result, and full role reveal
- Correct guess flips the winner (steal mechanic) -- both sides always have comeback potential
- Game transitions to finished state only after complete reveal sequence
- Added updateSistaChansen to client.ts for setting the correct field
- Kaos-fail win condition also triggers Sista Chansen in the 21:00 result reveal handler

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Sista Chansen guessing flow + Dramatic reveal and game end** - `a4f9dc9` (feat)
   - Both tasks tightly coupled in game-loop.ts; committed together

**Plan metadata:** pending

## Files Created/Modified
- `src/handlers/game-loop.ts` - Added Sista Chansen initiation, guess callback (sc:{gameId}:{candidateIndex}), performFinalReveal, sleep helper, in-memory state Maps, botRef pattern
- `src/db/client.ts` - Added updateSistaChansen function for setting correct=true/false

## Decisions Made
- Module-level botRef stored at createScheduleHandlers time so resolveExecution (called from both callback and scheduler contexts) can initiate Sista Chansen with the bot instance
- In-memory Maps for Sista Chansen DM tracking, timeouts, and candidate lists -- ephemeral state that doesn't survive restarts (acceptable: 2-hour window, recovery handles timeout case)
- Candidates = all players minus guessers to prevent information leakage (a guesser should not see themselves as a candidate)
- Game state remains "active" during Sista Chansen window so getAllActiveGames still finds it; transitions to "finished" only after performFinalReveal completes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added updateSistaChansen to client.ts**
- **Found during:** Task 1 (Sista Chansen guess callback)
- **Issue:** No function existed to update the `correct` field on the sista_chansen record after evaluating the guess
- **Fix:** Added `updateSistaChansen(id, updates)` function to client.ts
- **Files modified:** src/db/client.ts
- **Verification:** TypeScript compilation passes, function used in guess callback
- **Committed in:** a4f9dc9

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness -- needed to persist guess result to database. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 (Game Loop) is now complete: all 4 plans executed
- Complete 5-round game flow from lobby creation through Sista Chansen to final role reveal
- Ready for Phase 4 (AI Guzman) to add AI-generated messages and dynamic game master personality
- Ready for Phase 5 (Polish) for UX refinements, error recovery improvements

---
*Phase: 03-game-loop*
*Completed: 2026-02-10*
