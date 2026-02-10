---
phase: 02-game-lobby
plan: 02
subsystem: game-logic, handlers
tags: [crypto, fisher-yates, role-assignment, telegram-dm, grammy, composer]

# Dependency graph
requires:
  - phase: 02-game-lobby
    plan: 01
    provides: "games/game_players tables, CRUD functions, lobbyHandler with start callback, getGamePlayersWithInfo"
provides:
  - "Role assignment engine with crypto-random Fisher-Yates shuffle (assignRoles, ROLE_BALANCING)"
  - "Role reveal DM templates in Guzman voice (Akta, Golare with identity list, Hogra Hand with Spaning)"
  - "Game start monologue template for group announcement"
  - "Complete game start flow: assign roles -> save to DB -> send simultaneous DMs -> group monologue"
  - "/avbryt command for admin game cancellation"
  - "setPlayerRole database helper"
  - "gameCommandsHandler Composer"
affects: [03-game-flow, 04-ai-guzman]

# Tech tracking
tech-stack:
  added: [node:crypto randomInt]
  patterns: [crypto-random shuffle for security-critical randomness, Promise.all for simultaneous DM delivery]

key-files:
  created:
    - "src/lib/roles.ts"
    - "src/handlers/game-commands.ts"
  modified:
    - "src/lib/messages.ts"
    - "src/handlers/lobby.ts"
    - "src/db/client.ts"
    - "src/bot.ts"

key-decisions:
  - "node:crypto randomInt for shuffle (cryptographically secure role assignment)"
  - "Promise.all for simultaneous DMs via separate MessageQueue lanes per chat"
  - "Catch-and-log per DM (partial failure does not revert game state)"
  - "Reuse existing game variable from start callback instead of re-fetching for group monologue"

patterns-established:
  - "Role DM pattern: build playerInfoMap from getGamePlayersWithInfo, switch on role for DM text, send via MessageQueue to dm_chat_id"
  - "Game commands as separate Composer (gameCommandsHandler) registered after lobbyHandler"
  - "Admin permission check pattern: ctx.from.id !== game.admin_user_id for command guards"

# Metrics
duration: 4min
completed: 2026-02-10
---

# Phase 2 Plan 2: Role Assignment & Game Start Summary

**Crypto-random role assignment engine with Fisher-Yates shuffle, simultaneous role reveal DMs in Guzman voice, and /avbryt game cancellation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-10T12:53:39Z
- **Completed:** 2026-02-10T12:57:13Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Role assignment engine with balancing table for 4-10 players (crypto-random Fisher-Yates shuffle)
- Role reveal DMs in full Guzman voice: Akta brief, Golare with other Golare identities, Hogra Hand with Spaning confirmation
- Complete game start flow wired into lobby start callback: roles assigned, saved to DB, DMs sent simultaneously via Promise.all, dramatic group monologue posted
- /avbryt command for admin game cancellation with lobby message cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Role assignment engine and role reveal message templates** - `6e33a45` (feat)
2. **Task 2: Wire role assignment into game start flow, add /avbryt command** - `5d2bac0` (feat)

## Files Created/Modified
- `src/lib/roles.ts` - Role assignment engine with ROLE_BALANCING table and assignRoles function using crypto shuffle
- `src/lib/messages.ts` - Added ROLE_REVEAL_AKTA, ROLE_REVEAL_GOLARE, ROLE_REVEAL_HOGRA_HAND, GAME_START_MONOLOGUE, GAME_CANCELLED, GAME_CANCEL_CONFIRM
- `src/handlers/lobby.ts` - Updated start callback with full role assignment, DB save, simultaneous DM delivery, and group monologue
- `src/handlers/game-commands.ts` - New /avbryt command handler as Composer
- `src/db/client.ts` - Added setPlayerRole helper and PlayerRole import
- `src/bot.ts` - Registered gameCommandsHandler after lobbyHandler

## Decisions Made
- Used node:crypto randomInt for Fisher-Yates shuffle instead of Math.random (security-critical: role assignment must be unpredictable)
- DMs sent via Promise.all with per-DM catch -- partial DM failure logs error but does not revert game state (some players may already have received DMs)
- Reused existing `game` variable from getGameById call rather than re-fetching for the group monologue send

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed variable name collision in start callback**
- **Found during:** Task 2 (wiring role assignment into lobby.ts)
- **Issue:** Plan called for `const game = await getGameById(gameId)` to get group_chat_id for the monologue, but `game` was already declared at the top of the start callback scope
- **Fix:** Removed the redundant re-fetch and used the existing `game` variable (which already has `group_chat_id`)
- **Files modified:** src/handlers/lobby.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 5d2bac0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial scope -- eliminated redundant DB call. No scope creep.

## Issues Encountered
None -- plan executed cleanly with one minor variable scoping fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Role assignment and game start flow complete, ready for Phase 3 (game flow: missions, voting, execution)
- All role types (akta, golare, hogra_hand) properly assigned and persisted
- DM delivery infrastructure proven (MessageQueue per-chat lanes)
- /avbryt provides escape hatch for testing and debugging

## Self-Check: PASSED

All 7 files verified present on disk. Both task commits (6e33a45, 5d2bac0) verified in git log. TypeScript compilation passes with zero errors.

---
*Phase: 02-game-lobby*
*Completed: 2026-02-10*
