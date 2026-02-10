# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** The social deduction experience -- paranoia, accusations, and bluffing between friends -- driven by an AI game master that actively stirs conflict and keeps every player engaged.
**Current focus:** Phase 2: Game Lobby

## Current Position

Phase: 2 of 5 (Game Lobby)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-02-10 -- Phase 1 (Foundation) complete and verified. All 5 requirements passed.

Progress: [==........] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 10min
- Total execution time: 0.52 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 31min | 10min |

**Recent Trend:**
- Last 5 plans: 01-01 (7min), 01-02 (3min), 01-03 (21min)
- Trend: stable (01-03 included human verification checkpoint)

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
- Placeholder rules callback ("Reglerna kommer snart, bre!") -- real /regler in Phase 2
- dotenv as runtime dependency for .env loading (Node.js does not auto-load .env)
- Handler modules as Composer instances registered via bot.use()
- Bot startup order: config -> bot -> plugins -> queue -> handlers -> error handler -> shutdown -> start

### Pending Todos

None yet.

### Blockers/Concerns

- Bot cannot DM users who haven't /start'd -- shapes entire join flow (addressed in Phase 1)
- OpenAI cost management needed from first AI call (addressed in Phase 4)
- 64-byte callback data limit for inline buttons -- use server-side lookup with hash keys

## Session Continuity

Last session: 2026-02-10
Stopped at: Phase 1 complete and verified. Ready to plan Phase 2 (Game Lobby).
Resume file: None
