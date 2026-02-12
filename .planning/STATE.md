# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The social deduction experience -- paranoia, accusations, and bluffing between friends -- driven by an AI game master that actively stirs conflict and keeps every player engaged.
**Current focus:** v1.1 — AI Behavioral Awareness

## Current Position

Phase: 05-mission-adaptation
Plan: 01 of 01 complete.
Status: Phase 05 complete -- mission narratives enriched with mood-aware theming and behavioral commentary.
Last activity: 2026-02-12 — 05-01 complete, verified

Progress: [##########] 100% (v1.1 -- 5/5 phases complete, 8 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 22
- Average duration: 6min
- Total execution time: 1.80 hours

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
| 02-behavioral-analysis | 1/1 | 2min | 2min |
| 03-whisper-integration | 2/2 | 4min | 2min |
| 04-gap-fill-accusations | 2/2 | 7min | 3.5min |
| 05-mission-adaptation | 1/1 | 2min | 2min |

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
- Round-based whisper escalation: vague (1-2), specific (3), pointed (4-5) -- solves thin-data problem
- FORSAKRAN as 4th whisper strategy -- trust/reassurance as manipulation alongside truth/half-truth/lie
- Role-aware prompt calibration: PlayerRole determines Guzman tone (aggressive/seductive/respectful), never content
- Verbatim safety check: 8-char threshold with single retry, return anyway on second failure (CONST-04)
- Reassurance truth level mapped to "truth" at ai-guzman boundary (no DB/type migration needed)
- Accusation generation returns null on AI failure (no template -- never fabricates constraint)
- GroupMood computed at call time from playerNotes, never stored
- Gap-fill always provocative regardless of mood; mood only adapts angle
- Flat max 2 accusations per round across ALL rounds (no escalation)
- Accusation fires skip gap-fill for that cron slot (no double messages)
- Fresh analyzeBehavior at cron time, not stale GuzmanContext.playerNotes
- Mood-adaptive gating: tense=always, calm=never, active=when quiet
- Soft mood-to-theme mapping for missions: tense=betrayal, calm=urgency, active=complexity (not deterministic)
- Behavioral data hard-capped at 500 chars in mission prompt (CONST-02)
- 70/30 split: mission content vs group dynamics in narrative

### Pending Todos

None.

### Blockers/Concerns

- In-memory Maps for Sista Chansen/whisper state lost on restart (v1 trade-off, revisit if problematic)
- Global mutable botRef for scheduler access (revisit if architecture evolves)

## Session Continuity

Last session: 2026-02-12
Stopped at: Completed 05-01-PLAN.md. Phase 05 complete -- mission narratives enriched with group dynamics and mood. v1.1 AI Behavioral Awareness complete (all 5 phases done).
Resume file: None
