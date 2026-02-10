# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** The social deduction experience -- paranoia, accusations, and bluffing between friends -- driven by an AI game master that actively stirs conflict and keeps every player engaged.
**Current focus:** Phase 4: AI Guzman (IN PROGRESS)

## Current Position

Phase: 4 of 5 (AI Guzman)
Plan: 1 of 3 in current phase (1 done)
Status: In Progress
Last activity: 2026-02-10 -- Phase 4 Plan 01 (AI Foundation) complete.

Progress: [========..] 78%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 7min
- Total execution time: 1.24 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 31min | 10min |
| 02-game-lobby | 3/3 | 12min | 4min |
| 03-game-loop | 4/4 | 26min | 6.5min |
| 04-ai-guzman | 1/3 | 5min | 5min |

**Recent Trend:**
- Last 5 plans: 03-02 (6min), 03-03 (4min), 03-04 (9min), 04-01 (5min)
- Trend: consistent

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
- Shared handleVoteResult function for both callback and scheduler vote resolution paths
- deleteVotesForRound on Capo rotation to allow fresh voting cycle
- Callback data uses full round UUID (nt:{uuid}:{idx}) -- well within 64-byte limit
- Toggleable inline keyboard: [x]/[ ] prefix per button, rebuild on each toggle
- Shared resolveExecution helper for both early resolution and 21:00 scheduler
- Default to Sakra (loyalty assumed) at 18:00 for missing mission actions
- Game state set to finished on win (Sista Chansen intercepts in Plan 04)
- getPhaseDisplayName maps round phases to Swedish for /status display
- Module-level botRef set in createScheduleHandlers for resolveExecution to access bot instance
- In-memory Maps for Sista Chansen transient state (DM message IDs, timeouts, candidates) -- ephemeral, not DB
- Candidates = all players minus guessers to prevent information leakage
- Game stays active during Sista Chansen; transitions to finished only after performFinalReveal
- Optional OPENAI_API_KEY -- game runs on templates when key is missing (graceful degradation)
- gpt-4o-mini for narrative/whisper tiers, gpt-4.1-nano for commentary (cost optimization)
- zodResponseFormat for structured whisper output (truth_level enum)
- Narrative context compression: keep last 3 rounds detailed, drop beats for older rounds
- client.chat.completions.parse() in OpenAI SDK v6 (not deprecated beta path)

### Pending Todos

None yet.

### Blockers/Concerns

- Bot cannot DM users who haven't /start'd -- shapes entire join flow (addressed in Phase 1)
- OpenAI cost management needed from first AI call (addressed in Phase 4)
- 64-byte callback data limit for inline buttons -- use server-side lookup with hash keys

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 04-01-PLAN.md (AI Foundation). Plans 02-03 remaining in Phase 4.
Resume file: None
