# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** The social deduction experience -- paranoia, accusations, and bluffing between friends -- driven by an AI game master that actively stirs conflict and keeps every player engaged.
**Current focus:** Planning next milestone

## Current Position

Phase: N/A — between milestones
Plan: N/A
Status: v1.1 shipped, ready to plan next milestone
Last activity: 2026-02-12 — v1.1 milestone complete

Progress: v1 ✅ | v1.1 ✅ | next: /gsd:new-milestone

## Performance Metrics

**Velocity:**
- Total plans completed: 23
- Average duration: 5min
- Total execution time: ~2 hours

**By Milestone:**

| Milestone | Phases | Plans | Total Time | Avg/Plan |
|-----------|--------|-------|------------|----------|
| v1 MVP | 5 | 15 | 1.5 hours | 6min |
| v1.1 AI Behavioral Awareness | 5 | 8 | 20min | 2.5min |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Key patterns established in v1:
- Database-first state, NOT sessions
- All outbound group messages through MessageQueue.send()
- Handler modules as Composer instances via bot.use()
- Template fallbacks on all AI paths
- Tiered AI models (gpt-4o-mini / gpt-4.1-nano)

v1.1 additions:
- Ring buffer pruning via PostgreSQL trigger
- Fire-and-forget message capture (never blocks handler chain)
- Heuristic Swedish keyword tone classification (zero ML deps)
- playerNotes as behavioral data integration seam
- Null fallback for accusations (never fabricates)
- Round-based whisper escalation (vague → specific → pointed)

### Pending Todos

None.

### Blockers/Concerns

- In-memory Maps for Sista Chansen/whisper/accusation state lost on restart (v1 trade-off, revisit if problematic)
- Global mutable botRef for scheduler access (revisit if architecture evolves)

## Session Continuity

Last session: 2026-02-12
Stopped at: v1.1 milestone complete. Ready for next milestone planning.
Resume file: None
