# Milestone v1: MVP

**Status:** ✅ SHIPPED 2026-02-11
**Phases:** 1-5
**Total Plans:** 15

## Overview

Golare is an async Telegram social deduction game with an AI game master (Guzman). The v1 roadmap delivered infrastructure first, then a working game lobby, then the complete 5-round game loop with template messages, then layered AI personality on top, and finally added the engagement mechanics that make async viable. Each phase produced a verifiable, playable increment. By Phase 3 the game was fully playable (with templates); Phases 4-5 added the soul and the competitive moat.

## Phases

### Phase 1: Foundation

**Goal**: Bot connects to Telegram, persists all state in Supabase, queues messages with rate limiting, and handles the DM permission flow so every downstream feature has reliable infrastructure.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, SETUP-01
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Project setup, grammY bot skeleton, Supabase schema + client, Swedish message templates
- [x] 01-02-PLAN.md -- Per-chat message queue with rate limiting, DM permission flow (deep links, callouts, reminders)
- [x] 01-03-PLAN.md -- /start command handler with deep link detection, bot wiring, end-to-end verification

**Completed:** 2026-02-10

### Phase 2: Game Lobby

**Goal**: An admin can start a game in a group, players join, roles are assigned secretly via DM with correct balancing, and all players can access rules and status at any time.
**Depends on**: Phase 1
**Requirements**: SETUP-02, SETUP-03, SETUP-04, SETUP-05, SETUP-06, AI-06, UX-01, UX-02, UX-03
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- DB schema (games + game_players), lobby handler (/nyttspel, join/leave/start buttons)
- [x] 02-02-PLAN.md -- Role assignment engine, secret role DMs, game start monologue, /avbryt
- [x] 02-03-PLAN.md -- Paginated /regler, /status with DM role info, replace placeholder rules

**Completed:** 2026-02-10

### Phase 3: Game Loop

**Goal**: A complete 5-round game plays through the full daily cycle -- mission posting, Capo nomination, team voting, secret execution, and result reveal -- on an automated schedule, with all edge cases (failed votes, Kaos-mataren, Sista Chansen) handled via template messages.
**Depends on**: Phase 2
**Requirements**: LOOP-01 through LOOP-10, INFRA-06
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md -- DB schema (rounds/votes/missions), types, CRUD, FSM, Croner scheduler, template messages
- [x] 03-02-PLAN.md -- Mission posting, Capo nomination UX, team voting with Kaos-mataren
- [x] 03-03-PLAN.md -- Mission execution (Sakra/Gola DMs), result reveal, win condition tracking
- [x] 03-04-PLAN.md -- Symmetrisk Sista Chansen, dramatic reveal sequence, end-of-game flow

**Completed:** 2026-02-10

### Phase 4: AI Guzman

**Goal**: Guzman comes alive as an AI-driven persona -- generating unique mission narratives, dramatic result reveals, manipulative private whispers, and reactive gap-fill commentary -- with template fallbacks ensuring the game never breaks if OpenAI is unavailable.
**Depends on**: Phase 3
**Requirements**: INFRA-05, AI-01, AI-02, AI-03, AI-04, AI-05
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- OpenAI client, Guzman persona prompts, AI generation module with template fallbacks, DB schema for narrative context and whispers
- [x] 04-02-PLAN.md -- AI-generated mission narratives and dramatic result reveals integrated into game loop
- [x] 04-03-PLAN.md -- Viskningar (whisper DMs) with scheduled + event triggers, gap-fill commentary

**Completed:** 2026-02-10

### Phase 5: Engagement

**Goal**: Non-team players have meaningful actions every phase -- anonymous whispers, surveillance, and investigation -- plus anti-blowout mechanics and a dramatic role reveal at game end, making the async format engaging for every player every day.
**Depends on**: Phase 4
**Requirements**: ENGAGE-01, ENGAGE-02, ENGAGE-03, ENGAGE-04, ENGAGE-05
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md -- Anonymous whispers (/viska) and surveillance (/spana): DB tables, AI relay with role hints, engagement Composer handler, freeform text capture
- [x] 05-02-PLAN.md -- Spaning (/spaning) investigation with role-based truthfulness, anti-blowout double-point scoring, one-by-one dramatic role reveal

**Completed:** 2026-02-11

---

## Milestone Summary

**Key Decisions:**
- grammY over Telegraf (Telegraf EOL Feb 2025; grammY has native Supabase adapter, active dev, better TS)
- Database-first state, NOT sessions (race condition risk with concurrent players)
- Template fallbacks before AI (game must never block on OpenAI failure)
- Message queue is foundational (Telegram 20 msg/min per group rate limit)
- Custom FSM over XState (8 linear states, zero-dependency)
- node:crypto randomInt for Fisher-Yates shuffle (security-critical role assignment)
- Croner 10.x for zero-dependency ESM-native timezone-aware cron scheduling
- gpt-4o-mini for narrative/whisper tiers, gpt-4.1-nano for commentary (cost optimization)
- Optional OPENAI_API_KEY -- game runs on templates when key is missing (graceful degradation)
- In-memory Maps for transient state (Sista Chansen, pending whispers) -- acceptable v1 trade-off

**Issues Resolved:**
- Telegram DM permission flow solved via deep links with group callout
- Supabase v2.95 type inference limitation solved via type assertions on .select('*')
- 64-byte callback data limit managed via uuid-based callback patterns
- Race conditions solved via upsert with onConflict and UNIQUE constraints
- AI cost managed via tiered model selection (gpt-4o-mini vs gpt-4.1-nano)

**Issues Deferred:**
- Global mutable botRef for scheduler access (acceptable v1 pattern)
- In-memory Map state lost on restart for Sista Chansen (v1 trade-off)

**Technical Debt Incurred:**
- Global mutable `let botRef: Bot | null` for scheduler-handler bridge (info-level)
- In-memory Map for Sista Chansen DM state tracking (lost on restart; v1 acceptable)
- `sleep` via setTimeout for dramatic reveal sequence (intentional UX)

---

_For current project status, see .planning/ROADMAP.md_
