# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The social deduction experience -- paranoia, accusations, and bluffing between friends -- driven by an AI game master that actively stirs conflict and keeps every player engaged.
**Current focus:** v1.1 — AI Behavioral Awareness

## Current Position

Phase: 01-data-pipeline
Plan: 02 complete. Phase 01 done (2/2 plans).
Status: Plan 01-02 executed. Message capture middleware wired. Data pipeline phase complete.
Last activity: 2026-02-11 — 01-02 message capture middleware complete

Progress: [##........] 20% (v1.1 — 1/5 phases, 2 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 6min
- Total execution time: 1.60 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3/3 | 31min | 10min |
| 02-game-lobby | 3/3 | 12min | 4min |
| 03-game-loop | 4/4 | 26min | 6.5min |
| 04-ai-guzman | 3/3 | 12min | 4min |
| 05-engagement | 2/2 | 10min | 5min |
| **v1.1** | | | |
| 01-data-pipeline | 2/2 | 5min | 2.5min |

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
- In-memory Map cache for game ID with 5-min TTL + explicit invalidation on state transitions
- Bot admin check at /nyttspel (not every message) -- lightweight DATA-04 gate

### Pending Todos

None.

### Blockers/Concerns

- In-memory Maps for Sista Chansen/whisper state lost on restart (v1 trade-off, revisit if problematic)
- Global mutable botRef for scheduler access (revisit if architecture evolves)

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 01-02-PLAN.md. Phase 01-data-pipeline complete (2/2 plans). Ready for phase 02.
Resume file: None
