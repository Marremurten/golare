# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** The social deduction experience -- paranoia, accusations, and bluffing between friends -- driven by an AI game master that actively stirs conflict and keeps every player engaged.
**Current focus:** Phase 3: Game Loop

## Current Position

Phase: 3 of 5 (Game Loop)
Plan: 1 of 4 in current phase
Status: Executing
Last activity: 2026-02-10 -- Phase 3 Plan 01 (Game Loop Foundation) complete.

Progress: [=====.....] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 7min
- Total execution time: 0.84 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 31min | 10min |
| 02-game-lobby | 3/3 | 12min | 4min |
| 03-game-loop | 1/4 | 7min | 7min |

**Recent Trend:**
- Last 5 plans: 02-01 (4min), 02-02 (4min), 02-03 (4min), 03-01 (7min)
- Trend: consistent (larger plan took proportionally longer)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- grammY over Telegraf (Telegraf EOL Feb 2025; grammY has native Supabase adapter)
- Database-first state, NOT sessions (race condition risk with concurrent players)
- Template fallbacks before AI (game must never block on OpenAI failure)
- Message queue is foundational (Telegram 20 msg/min per group rate limit)
- Custom FSM over XState (8 linear states, zero-dependency)
- Use type aliases instead of interfaces for Supabase Database types (interfaces lack implicit index signatures needed by Supabase generics)
- Type assertions on .select('*') return values (Supabase v2.95 resolves select() as {} without column-level type inference)
- All outbound group messages route through MessageQueue.send(), never direct bot.api.sendMessage
- Deep link payload format: g_{chatId} for positive, g_n{absId} for negative group IDs
- Singleton factory for MessageQueue (createMessageQueue at startup, getMessageQueue everywhere else)
- InlineKeyboard with Regler button on all /start welcome messages (direct and deep link)
- Placeholder rules callback replaced with real rules:roller routing in Phase 2 Plan 03
- dotenv as runtime dependency for .env loading (Node.js does not auto-load .env)
- Handler modules as Composer instances registered via bot.use()
- Bot startup order: config -> bot -> plugins -> queue -> handlers -> error handler -> shutdown -> start
- Start button visible to all but handler checks game.admin_user_id (Telegram doesn't support per-user inline keyboards)
- Callback data format: action:uuid (join:, leave:, start:) -- all under 64 bytes
- Upsert with onConflict for addPlayerToGame to handle double-click race conditions
- Admin name looked up from players table by admin_user_id, not from callback ctx.from
- node:crypto randomInt for Fisher-Yates shuffle (security-critical role assignment)
- Promise.all for simultaneous DM delivery via separate MessageQueue lanes per chat
- Catch-and-log per DM -- partial DM failure does not revert game state
- Game commands as separate Composer (gameCommandsHandler) registered after lobbyHandler
- Paginated inline keyboard navigation via callback data (rules:page pattern)
- Dual-context commands: /regler and /status work in both group and DM with different behavior
- Module-level constants for rules page strings to avoid self-reference in MESSAGES object
- getPlayerActiveGame returns Game + GamePlayer tuple for efficient DM status display
- Croner 10.x for zero-dependency ESM-native timezone-aware cron scheduling
- Pure FSM functions (no class, no side effects) for testable phase transitions
- UNIQUE constraint on sista_chansen(game_id) for atomic first-guess-wins
- Global scheduler (not per-game) with DB queries per tick for restart safety
- Upsert with onConflict for castVote and castMissionAction (double-click safety)

### Pending Todos

None yet.

### Blockers/Concerns

- Bot cannot DM users who haven't /start'd -- shapes entire join flow (addressed in Phase 1)
- OpenAI cost management needed from first AI call (addressed in Phase 4)
- 64-byte callback data limit for inline buttons -- use server-side lookup with hash keys

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 03-01-PLAN.md (Game Loop Foundation). Ready for 03-02-PLAN.md.
Resume file: None
