# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The social deduction experience -- paranoia, accusations, and bluffing between friends -- driven by an AI game master that actively stirs conflict and keeps every player engaged.
**Current focus:** v1.1 — AI Behavioral Awareness

## Current Position

Phase: 02-behavioral-analysis
Plan: 01 complete.
Status: Plan 02-01 executed. Behavioral analysis module created and wired into updateNarrativeContext.
Last activity: 2026-02-11 — 02-01 behavioral analysis module complete

Progress: [###.......] 30% (v1.1 — 3 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 18
- Average duration: 6min
- Total execution time: 1.63 hours

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
| 02-behavioral-analysis | 1/? | 2min | 2min |

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
- Heuristic Swedish keyword matching for tone classification (zero ML deps, CONST-01)
- Anomaly detection relative to player's own history across rounds (not group baseline)
- Non-critical behavioral analysis: failure never blocks game loop (CONST-04)

### Pending Todos

None.

### Blockers/Concerns

- In-memory Maps for Sista Chansen/whisper state lost on restart (v1 trade-off, revisit if problematic)
- Global mutable botRef for scheduler access (revisit if architecture evolves)

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 02-01-PLAN.md. Behavioral analysis module created and wired.
Resume file: None
