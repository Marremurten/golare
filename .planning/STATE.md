# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The social deduction experience -- paranoia, accusations, and bluffing between friends -- driven by an AI game master that actively stirs conflict and keeps every player engaged.
**Current focus:** v1.1 — AI Behavioral Awareness

## Current Position

Phase: 01-data-pipeline
Plan: 01 complete, ready for 02
Status: Plan 01-01 executed. player_messages data layer complete.
Last activity: 2026-02-11 — 01-01 player_messages data layer complete

Progress: [..........] 0% (v1.1 — 0/5 phases, 1 plan complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 6min
- Total execution time: 1.55 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 31min | 10min |
| 02-game-lobby | 3/3 | 12min | 4min |
| 03-game-loop | 4/4 | 26min | 6.5min |
| 04-ai-guzman | 3/3 | 12min | 4min |
| 05-engagement | 2/2 | 10min | 5min |
| **v1.1** | | | |
| 01-data-pipeline | 1/? | 2min | 2min |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Key patterns established in v1:
- Database-first state, NOT sessions
- All outbound group messages through MessageQueue.send()
- Handler modules as Composer instances via bot.use()
- Template fallbacks on all AI paths
- Tiered AI models (gpt-4o-mini / gpt-4.1-nano)

v1.1 decisions:
- Ring buffer pruning via PostgreSQL trigger (not application code)
- Fire-and-forget insert for message capture (no select return needed)

### Pending Todos

None.

### Blockers/Concerns

- In-memory Maps for Sista Chansen/whisper state lost on restart (v1 trade-off, revisit if problematic)
- Global mutable botRef for scheduler access (revisit if architecture evolves)

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 01-01-PLAN.md. Ready for 01-02 (message capture middleware).
Resume file: None
