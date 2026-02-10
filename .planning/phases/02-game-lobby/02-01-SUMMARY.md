---
phase: 02-game-lobby
plan: 01
subsystem: database, handlers
tags: [supabase, grammy, inline-keyboard, callback-query, lobby, telegram]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "players table, registerPlayer, getPlayerByTelegramId, MessageQueue, Composer handler pattern, bot.ts startup"
provides:
  - "games and game_players database tables with indexes and constraints"
  - "Game, GamePlayer, GameState, PlayerRole type aliases"
  - "8 game CRUD functions (createGame, getActiveGame, getGameById, updateGame, addPlayerToGame, removePlayerFromGame, getGamePlayers, getGamePlayersWithInfo)"
  - "lobbyHandler Composer with /nyttspel command and join/leave/start callback handlers"
  - "LOBBY_* message templates in Guzman voice"
  - "LOBBY_ERROR error variants"
affects: [02-game-lobby, 03-game-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Callback query regex matching with prefix:payload format (join:{gameId})"
    - "ctx.editMessageText for live-updating inline keyboard messages"
    - "isMessageNotModifiedError helper to suppress benign edit race errors"
    - "isGroupAdmin helper via getChatMember for Telegram admin verification"
    - "Partial unique index for one-active-game-per-group constraint"

key-files:
  created:
    - "src/handlers/lobby.ts"
  modified:
    - "src/db/schema.sql"
    - "src/db/types.ts"
    - "src/db/client.ts"
    - "src/lib/messages.ts"
    - "src/lib/errors.ts"
    - "src/bot.ts"
    - "src/handlers/start.ts"

key-decisions:
  - "Start button visible to all players but handler checks admin_user_id -- simpler than per-user keyboards which Telegram doesn't support without separate messages"
  - "Admin check for start uses stored game.admin_user_id rather than re-checking Telegram admin status -- game creator should control start"
  - "Upsert with onConflict for addPlayerToGame to handle double-click race conditions gracefully"
  - "Admin name for lobby header looked up from players table by admin_user_id -- avoids stale names from callback context"

patterns-established:
  - "Callback data format: action:uuid (e.g. join:abc-123, leave:abc-123, start:abc-123) -- all under 64 bytes"
  - "Lobby message pattern: send via MessageQueue, store message_id in game row, edit via ctx.editMessageText in callback handlers"
  - "Error suppression: isMessageNotModifiedError catches benign Telegram 400 errors from concurrent edits"

# Metrics
duration: 4min
completed: 2026-02-10
---

# Phase 2 Plan 1: Game Lobby Summary

**Game lobby with /nyttspel command, join/leave inline buttons updating live, and start transition using Supabase games/game_players schema**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-10T12:45:18Z
- **Completed:** 2026-02-10T12:49:27Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- games and game_players tables with partial unique index enforcing one active game per group
- 8 game CRUD functions with type assertions matching Phase 1 Supabase pattern
- Complete lobby handler: /nyttspel creates lobby, join/leave update live, start transitions to active
- 10 LOBBY_* message templates in Guzman voice with proper Swedish characters

## Task Commits

Each task was committed atomically:

1. **Task 1: Database schema, types, and game CRUD functions** - `532c68d` (feat)
2. **Task 2: Lobby handler with /nyttspel, join, leave, start callbacks** - `d34e1ab` (feat)

## Files Created/Modified
- `src/db/schema.sql` - Added games and game_players table DDL with indexes, triggers, and partial unique index
- `src/db/types.ts` - Added GameState, PlayerRole, Game, GameInsert, GamePlayer, GamePlayerInsert types; updated Database type
- `src/db/client.ts` - Added 8 game CRUD functions: createGame, getActiveGame, getGameById, updateGame, addPlayerToGame, removePlayerFromGame, getGamePlayers, getGamePlayersWithInfo
- `src/handlers/lobby.ts` - New file: lobbyHandler Composer with /nyttspel command and join/leave/start callback handlers
- `src/lib/messages.ts` - Added 10 LOBBY_* templates; fixed Phase 1 Swedish characters
- `src/lib/errors.ts` - Added LOBBY_ERROR array with 5 variants; fixed Phase 1 Swedish characters
- `src/bot.ts` - Imported and registered lobbyHandler after startHandler
- `src/handlers/start.ts` - Fixed Swedish character usage (Okand -> Okand)

## Decisions Made
- Start button visible to all players but handler checks admin_user_id -- simpler than per-user keyboards which Telegram doesn't support without separate messages
- Admin check for start uses stored game.admin_user_id rather than re-checking Telegram admin status -- game creator should control start
- Upsert with onConflict for addPlayerToGame to handle double-click race conditions gracefully
- Admin name for lobby header looked up from players table by admin_user_id -- avoids stale names from callback context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed admin name in join callback using wrong context**
- **Found during:** Task 2 (Lobby handler implementation)
- **Issue:** Join callback used ctx.from (the joining player) to get the admin name for the lobby header, which would display the wrong name
- **Fix:** Look up admin name from players table using game.admin_user_id, matching the pattern already used in the leave callback
- **Files modified:** src/handlers/lobby.ts
- **Verification:** Code review confirmed ctx.from is now only used for the joining player's actions, admin name comes from DB lookup
- **Committed in:** d34e1ab (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential correctness fix. No scope creep.

## Issues Encountered
- Pre-existing uncommitted Swedish character fixes (aao -> aao) in Phase 1 files were included in Task 2 commit since those files were being modified anyway. These were correct fixes aligned with project memory requirements.

## User Setup Required
None - no external service configuration required. The games and game_players tables need to be created in Supabase by running the updated schema.sql.

## Next Phase Readiness
- Game schema and lobby flow complete, ready for Plan 02 (role assignment and DM delivery)
- The start callback currently transitions to "active" and edits the lobby message; Plan 02 will add role assignment and DM sending after the state transition
- All CRUD functions needed by Plans 02 and 03 are already exported

## Self-Check: PASSED

- All 8 files verified present on disk
- Both task commits (532c68d, d34e1ab) found in git log
- `npx tsc --noEmit` passes with zero errors

---
*Phase: 02-game-lobby*
*Completed: 2026-02-10*
