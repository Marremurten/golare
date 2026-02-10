# Project Research Summary

**Project:** Golare
**Domain:** Telegram Bot Social Deduction Game
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

Golare is an async text-based social deduction game in Telegram that occupies a unique market position. Every existing Telegram social deduction bot (WerewolfBot with 5.9M+ players, Mafia bots, Avalon bots) operates synchronously — games last 5-30 minutes with all players online simultaneously. Golare's 5-day async format with fixed daily events (09:00, 12:00, 15:00, 18:00, 21:00) has zero direct competitors. This is both the biggest opportunity and the biggest design risk.

The recommended technical approach is modern, battle-tested, and cost-efficient: grammY (not Telegraf, which reached end-of-support in Feb 2025), OpenAI SDK with GPT-4o for AI game master (Guzman), Supabase for state persistence, and node-cron for scheduling. The critical architectural decision is database-first state management — Telegraf sessions suffer from documented race conditions and data loss on restart. The critical design challenge is anti-passivity: async games die if players have nothing to do for 12 hours between events. Golare solves this with AI-driven whispers, anonymous player messages, and surveillance mechanics.

Key risks center on Telegram platform constraints (rate limits, DM permissions, 64-byte callback data limits), AI cost management (without controls, GPT-4o costs can spiral to $50-200/day at scale), and maintaining the AI persona over multi-round games. All risks have documented mitigation strategies. The game is architecturally sound and technically feasible with the specified stack.

## Key Findings

### Recommended Stack

**Critical recommendation: Use grammY instead of Telegraf.** Telegraf reached end-of-support in Feb 2025, last published 2 years ago, and lacks ecosystem support. grammY (1.2M weekly downloads, published daily) is the actively-maintained successor built by a core Telegraf contributor. It has official Supabase session adapter, superior TypeScript support, and tracks the latest Bot API.

**Core technologies:**
- **grammY 1.40.0** — Telegram bot framework with official Supabase integration
- **OpenAI SDK 6.19.0** — AI game master, structured outputs via Zod
- **Supabase 2.95.x** — PostgreSQL database, session persistence, connection pooling
- **Zod 4.3.x** — Schema validation for AI responses and config
- **node-cron 4.2.x** — Scheduled daily events (no Redis needed for 5 fixed times)
- **Pino 10.3.x** — Fast JSON logging (5x faster than Winston)

**Key plugins:**
- `@grammyjs/storage-supabase` — Official session adapter
- `@grammyjs/conversations` — Multi-step interaction flows
- `@grammyjs/menu` — Inline keyboard management
- `@grammyjs/runner` — Concurrent message processing

**Runtime:** Node.js 22.x LTS (active until April 2027, native `--env-file` support).

**Development:** TypeScript 5.9.x, tsx (not ts-node due to ESM issues), Vitest (native TS/ESM support), Biome (replaces ESLint + Prettier).

**Confidence:** HIGH — All recommendations verified via npm registry, GitHub activity, official comparison docs.

### Expected Features

**Table stakes (users expect these):**
- Secret role assignment via DM (Akta/Golare/Hogra Hand)
- Team-aware information (Golare know each other)
- Capo rotation + team nomination
- Group voting with inline buttons (JA/NEJ)
- Secret mission execution ([Sakra]/[Gola])
- Win condition tracking (best of 5)
- Kaos-mataren (3 rejected nominations = auto-fail)
- Role reveal at game end
- Game state persistence (survives bot restart)
- /regler and /status commands
- Onboarding intro sequence

**Differentiators (competitive advantage):**
- **Async 5-day format** — No Telegram competitor does this. Creates sustained paranoia and fits into real life.
- **AI Game Master (Guzman)** — GPT-4o powered persona that generates dramatic narratives, not mechanical announcements. No competitor has AI-driven game master.
- **AI Viskningar (whispers)** — Between events, Guzman DMs players with manipulative suspicions/lies. Creates engagement when game would otherwise be silent.
- **Anti-passivity system** — Non-team players can send anonymous messages via Guzman and surveil team members. Solves the #1 async problem: idle players forget the game exists.
- **Symmetrisk Sista Chansen** — Both sides get endgame comeback chance. Avalon only gives evil the assassination; Golare balances it.
- **Themed immersion** — Swedish suburb criminal underworld with authentic slang (bre, shuno, aina, para). Generic bots can't match this.
- **Spaning (investigation)** — One-shot investigation per player creates tactical scarcity. Higher stakes than Werewolf's renewable Seer checks.

**Anti-features (commonly requested but harmful):**
- Player elimination mid-game (4 days watching is unacceptable in async)
- 60+ roles like WerewolfBot (complexity explosion; 3 roles correct for v1)
- Real-time synchronous mode (different game engine; splits focus)
- Voice messages (deferred to v2; high complexity for polish feature)
- Multiple concurrent games per group (state management nightmare)
- Public vote tallies during voting (kills social deduction via bandwagoning)

**Competitive moat:** The combination of async format + AI game master + anti-passivity system creates an experience that cannot be replicated by WerewolfBot adding new roles.

**Confidence:** HIGH for core mechanics (well-understood genre patterns), MEDIUM for async-specific patterns (fewer direct comparables).

### Architecture Approach

**Event-driven game engine with database-first state.** The game engine is a pure function: receives an event and current state, returns new state plus side effects (messages to send, DB writes). This makes game logic testable without mocking Telegram APIs.

**Critical patterns:**

1. **Database-first state (not Telegraf sessions)** — Sessions are in-memory by default (lost on restart) and suffer from documented race conditions when multiple players act simultaneously. Use Supabase as single source of truth, keyed by `chatId`. Implement atomic operations (voting, phase transitions) via Supabase RPC functions.

2. **Dual-channel message dispatch** — Bot operates across group chat (public) and private DMs (secret) simultaneously. Group messages always work; private messages require user to have /start'd the bot first (hard Telegram constraint). Mitigation: require deep link onboarding during join phase.

3. **Custom state machine (not XState)** — Game has 8 states (IDLE, LOBBY, MISSION, NOMINATION, VOTING, EXECUTION, RESULT, ENDED) and 10 transitions. A simple transition table is more readable and serializable than XState's actor model. Reserve XState for genuinely parallel/hierarchical states.

4. **Scheduled phase advancement via DB scan** — node-cron triggers at fixed times (09:00, 12:00, 15:00, 18:00, 21:00 CET) but has no persistence. Scheduler should query database for games needing advancement rather than tracking state in memory. This survives restarts and DST transitions.

5. **Message queue with rate limiting** — Telegram enforces 20 msg/min per group, 30 msg/sec globally, ~1 msg/sec to individual chats. Never call Telegram API directly from game logic. Implement queue with token bucket algorithm.

6. **AI context windowing** — GPT-4o has 128K context but cost scales with tokens. Use rolling summary: last 10-15 messages + compressed game state summary (~700 tokens total). Summarize earlier rounds rather than including full transcript.

**Project structure:**
- `bot/` — Telegram-specific code (handlers, middleware, keyboards)
- `game/` — Pure game logic (engine, state machine, phases, rules)
- `ai/` — OpenAI integration (prompts, context builder, response parser)
- `db/` — Supabase client and query functions
- `scheduler/` — node-cron jobs and phase trigger logic
- `messages/` — Message formatting and sending abstraction

**Strict separation:** Game engine knows nothing about Telegram. It receives typed events (`PLAYER_JOIN`, `VOTE_CAST`, `PHASE_TIMEOUT`) and returns typed actions (`SEND_GROUP_MSG`, `SEND_PRIVATE_MSG`, `UPDATE_STATE`). Bot handlers translate between Telegram updates and game domain.

**Database schema:** Use normalized relational tables (games, players, rounds, votes, mission_actions, chat_messages), NOT a single JSONB blob. JSONB makes queries like "find all games where player X is active" extremely difficult and prevents row-level security. Reserve JSONB for truly ephemeral phase-specific data (`phase_data` column).

**Confidence:** HIGH — Telegram, Supabase, and OpenAI patterns are well-documented. Custom state machine follows established FSM patterns.

### Critical Pitfalls

**Top 5 pitfalls with prevention strategies:**

1. **Telegram Rate Limits Silently Break Game Flow**
   - **Problem:** 20 msg/min per group, 30 msg/sec global, 1 msg/sec to DMs. Night phase with 8 players (8 DMs + 1 group message) takes ~9 seconds minimum. Exceeding limits causes 429 errors; some players get messages, others don't, creating inconsistent state.
   - **Prevention:** Implement message queue with rate-aware batching from Phase 1. Budget message slots per game phase. Combine info into fewer, longer messages. Never call Telegram API directly.
   - **Phase to address:** Phase 1 (Core Infrastructure)

2. **Telegraf Session Race Conditions Corrupt Game State**
   - **Problem:** Two players vote simultaneously. Both read session state showing 3 votes, both write back 4 votes. Last write wins; one vote lost. Documented issue with no built-in fix.
   - **Prevention:** Do NOT use Telegraf sessions for game state. Store in Supabase with atomic operations (`UPDATE ... SET votes = votes + 1`). Use database functions for complex transitions.
   - **Phase to address:** Phase 1 (Core Infrastructure)

3. **OpenAI Token Costs Spiral Out of Control**
   - **Problem:** Without controls, GPT-4o costs $0.50-2.00 per game. At 100 games/day, that's $50-200/day. Input tokens grow with game history; by round 5, calls reach 4,000-8,000 tokens.
   - **Prevention:** Use GPT-4o-mini for routine tasks (vote summaries, acknowledgments). Implement aggressive context windowing (last 2 rounds only). Cache system prompts. Set per-game token budgets with circuit breakers. Track cost per game from first AI call.
   - **Phase to address:** Phase 2 (AI Integration)

4. **Players Can't Receive DMs (Bot Can't Initiate Conversations)**
   - **Problem:** Telegram bots cannot DM users who haven't first messaged the bot privately. Player joins game in group but hasn't /start'd the bot. Game starts, role assignment DM fails. Player never learns their role.
   - **Prevention:** Require deep link onboarding: when player joins, send group message with button linking to `t.me/BotName?start=join_GAMEID`. Store `has_dm_access` flag. Block game start until all players confirmed DM access.
   - **Phase to address:** Phase 1 (Core Infrastructure)

5. **AI Character Drift — Guzman Breaks Persona**
   - **Problem:** Guzman starts with authentic Swedish slang and gangster persona. By round 3, speaking generic English, using "I'd be happy to help" phrasing, breaking character.
   - **Prevention:** Place persona description at BOTH beginning (system) and end (last user message) of each API call. Include 2-3 few-shot examples in system prompt. Keep curated Swedish slang dictionary. Never generate "meta" explanations via AI (hardcode those). Test over 5+ rounds.
   - **Phase to address:** Phase 2 (AI Integration)

**Moderate pitfalls:**
- 64-byte callback data limit (use server-side lookup with hash keys)
- Message length limits fragment narratives (set `max_tokens` ~1000, split at sentence boundaries)
- Supabase free tier auto-pauses after 7 days (upgrade to Pro before launch or implement heartbeat)
- Metagaming via screenshot sharing (design DMs with plausible deniability, accept as unsolvable technical problem)
- Small player count breaks balance (minimum 5 players, test extensively at each count)

**Confidence:** HIGH for technical constraints (Telegram, OpenAI, Supabase docs verified), MEDIUM for UX patterns (based on community evidence).

## Implications for Roadmap

### Suggested Phase Structure

The research reveals clear dependency chains and critical-path items. Recommend **4 phases**:

#### Phase 1: Core Infrastructure (Foundation)
**Rationale:** Every downstream feature depends on reliable Telegram integration, database persistence, and message delivery. The critical architectural decisions (DB-first state, message queue, DM permission flow) must be made before any game logic.

**Delivers:**
- grammY bot setup with Supabase session storage
- Database schema (games, players, rounds, votes, mission_actions)
- Message queue with Telegram rate limit handling
- Deep link onboarding flow for DM permissions
- Basic commands (/start, /nyttspel, /join, /status)
- Game context middleware (loads state from DB)
- Error handling middleware

**Pitfalls to avoid:**
- Using Telegraf sessions instead of DB (#2)
- Skipping message queue (#1)
- Not handling DM permission flow (#4)
- Direct Telegram API calls without rate limiting

**Features from FEATURES.md:** T1 (role assignment DM), T7 (state persistence), T8 (/regler), T9 (/status), T13 (onboarding)

**Test criteria:**
- Concurrent votes from 8 players don't cause race conditions
- Bot restart mid-lobby doesn't lose player list
- Fresh user who hasn't /start'd bot gets clear onboarding prompt

#### Phase 2: Game Engine + AI Integration
**Rationale:** With infrastructure solid, build the core game loop and AI persona simultaneously. These are the two highest-value features that define Golare's identity. The game must work with template fallbacks before AI is fully polished (reduces debugging surface area).

**Delivers:**
- Custom state machine (8 phases, valid transitions)
- Game engine (event processor with typed inputs/outputs)
- Role assignment logic (Akta, Golare, Hogra Hand)
- Nomination, voting, execution, result phases
- Capo rotation + Kaos-mataren (3 NEJ = auto-fail)
- Win condition tracking (best of 5)
- OpenAI integration with Guzman persona
- AI context builder (game state summary + message history)
- Structured outputs via Zod schemas
- AI fallback templates for every game moment
- Cost tracking (log tokens per call, aggregate per game)

**Pitfalls to avoid:**
- AI cost spiral (#3)
- Character drift (#5)
- Coupling game logic to Telegram types
- Synchronous AI calls blocking message handlers

**Features from FEATURES.md:** T2-T6 (core game loop), T10 (inline buttons), T11 (Kaos-mataren), T12 (Capo rotation), D2 (AI game master), D6 (themed immersion)

**Test criteria:**
- Complete 5-round game with template fallbacks (no AI)
- GPT-4o persona maintains Swedish slang through 5 rounds
- Average cost per game under $0.20 with current token budget

#### Phase 3: Async-Specific Features
**Rationale:** With working synchronous core, layer on the features that make async viable: anti-passivity mechanics, scheduled events, and endgame twists. These features are Golare's competitive moat against synchronous bots.

**Delivers:**
- node-cron scheduler (09:00, 12:00, 15:00, 18:00, 21:00 CET)
- DB-scan phase advancement (survives restarts)
- AI Viskningar (whispers between events)
- Anti-passivity: anonymous messages via Guzman
- Anti-passivity: surveillance mechanic
- Spaning (one-shot investigation)
- Symmetrisk Sista Chansen (double endgame)
- Anti-blowout (double points final rounds)
- AI gap-fill commentary (optional, may defer to v1.x)

**Pitfalls to avoid:**
- Scheduled events fire incorrectly (#5 from Pitfalls)
- In-memory scheduling without DB persistence
- Timezone bugs during DST transitions
- Notification fatigue from too-frequent whispers

**Features from FEATURES.md:** D1 (async format), D3 (whispers), D4 (anti-passivity), D5 (Symmetrisk), D7 (anti-blowout), D8 (Spaning), D9 (gap-fill)

**Test criteria:**
- Schedule cron job, kill process, restart, verify game resumes correctly
- 5-day game simulation (compressed timescale) with AI whispers
- Non-team players have meaningful actions every phase

#### Phase 4: Polish + Launch
**Rationale:** Game is playable. Focus on production readiness, observability, and initial user feedback.

**Delivers:**
- Role reveal at game end
- Game summary/recap (end-of-game narrative)
- Reminder notifications (approaching deadlines)
- Structured logging with game_id, phase, player_count
- Error monitoring (alert on 429s, AI failures, stuck games)
- Load testing (5 concurrent games, 8 players each)
- Supabase Pro upgrade or heartbeat mechanism
- Production deployment (webhook mode for lower latency)

**Pitfalls to avoid:**
- Supabase free tier auto-pause (#9 from Pitfalls)
- Performance untested with real concurrent users
- No observability (problems reported by users, not detected)

**Features from FEATURES.md:** T6 (role reveal), v1.x features (reminders, recap, stats)

**Test criteria:**
- 5 concurrent games run smoothly without rate limit errors
- Supabase project does not auto-pause
- Alert fires when game stuck in same phase for 2x expected duration

### Phase Ordering Rationale

**Why this order:**
- **Phase 1 before 2:** Game logic cannot be tested without DB persistence and message delivery infrastructure. Refactoring from sessions to DB mid-development is costly.
- **Phase 2 split:** Game engine + AI together because AI fallback templates inform game engine output format. Testing game without AI forces template design early.
- **Phase 3 after 2:** Async features (scheduling, whispers) depend on working core loop. Can't test "whisper between rounds" without functional rounds.
- **Phase 4 last:** Polish features (reminders, recap) need real user feedback to calibrate timing and tone. Build these after playtesting.

**Critical path:** Phase 1 → Phase 2 → Phase 3. Phase 4 can partially overlap with Phase 3 (observability can be added earlier).

### Research Flags

**Phases needing `/gsd:research-phase` during planning:**

- **Phase 2 (AI Integration):** Deep research needed on:
  - Prompt engineering for Swedish persona stability
  - Token optimization strategies (which tasks use mini vs 4o)
  - Structured output schemas for game-mechanical AI responses
  - Cost forecasting at 10x/100x usage

- **Phase 3 (Async Features):** Moderate research needed on:
  - Notification timing (when to whisper without annoying)
  - Surveillance mechanic UX (how to present cryptic clues)
  - Scheduling edge cases (DST, missed crons, restart recovery)

**Phases with well-documented patterns (skip research):**

- **Phase 1 (Core Infrastructure):** Telegram bot patterns, Supabase CRUD, message queues are commodity patterns. Implementation guides exist.
- **Phase 4 (Polish):** Load testing, logging, deployment are standard DevOps. No game-specific research needed.

### Dependencies and Blockers

**Hard dependencies:**
- Phase 2 blocked by Phase 1 (need DB + message queue)
- Phase 3 blocked by Phase 2 (need working game loop)
- Phase 4 blocked by Phase 3 (need complete game to polish)

**Soft dependencies:**
- AI cost tracking (Phase 2) should start in Phase 1 (add DB table early)
- Observability (Phase 4) can start in Phase 2 (log game events from beginning)

**External dependencies:**
- OpenAI API key (get before Phase 2)
- Supabase project setup (before Phase 1)
- Telegram bot token (before Phase 1)
- Production domain/SSL for webhooks (before Phase 4 deployment)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | grammY, Supabase, OpenAI SDK verified via npm registry, GitHub activity, official docs. All versions compatible with Node 22 LTS. |
| Features | HIGH (core), MEDIUM (async) | Social deduction table stakes well-understood. Async format novel; fewer direct comparables for anti-passivity mechanics. |
| Architecture | HIGH | Event-driven game engine, DB-first state, dual-channel messaging are proven patterns. grammY + Supabase integration documented. |
| Pitfalls | HIGH (technical), MEDIUM (UX) | Telegram rate limits, session races, DM permissions, AI costs verified via official docs and community issues. UX pitfalls based on competitor analysis and community patterns. |

**Overall confidence: HIGH**

**Gaps to address during planning:**

1. **AI persona stability over 5-day games** — Research covers multi-round drift but not multi-day async with long pauses. May need experimentation during Phase 2.

2. **Notification frequency sweet spot** — Research identifies notification fatigue risk but doesn't prescribe exact timing. Requires user testing in Phase 3.

3. **Small player count balance (4-5 players)** — Research flags this as risky but doesn't provide specific balance parameters. Playtest data needed in Phase 3.

4. **Actual OpenAI cost at scale** — Token estimates provided but real costs depend on prompt length and player chattiness. Monitor closely in Phase 2, may need Phase 2.5 optimization sprint.

5. **Metagaming prevalence** — Research identifies screenshot-sharing as unsolvable but doesn't quantify how common it will be. Accept as design constraint; observe in beta.

**None of these gaps block roadmap creation.** They are validation points for later phases.

## Sources

Research synthesized from 4 domain-specific files:

### STACK.md Sources
- grammY official docs, npm registry, GitHub activity
- OpenAI Node.js SDK docs, structured outputs guide
- Supabase client docs, connection management, pricing
- Node.js LTS schedule, native --env-file support
- Stack comparison: grammY vs Telegraf, Pino vs Winston, tsx vs ts-node

### FEATURES.md Sources
- Telegram bot competitors: WerewolfBot (5.9M+ players), Avalon Discord bots, Secret Hitler
- Social deduction theory: Blood on the Clocktower mechanics, The Resistance rules
- Async game design: "What Makes Social Games Social?" (Gamedeveloper.com)
- Metagaming prevention: BGG threads on cheating in social deduction

### ARCHITECTURE.md Sources
- Telegram Bot API official docs (rate limits, DM restrictions, callback data limits)
- Telegraf session race condition GitHub issues (#1372, #2055)
- Supabase JSONB docs, realtime architecture, connection pooling
- OpenAI context summarization cookbook, conversation state guide
- node-cron docs, scheduler comparison (Better Stack)

### PITFALLS.md Sources
- Telegram rate limits reference (limits.tginfo.me)
- OpenAI pricing breakdown (pricepertoken.com)
- Supabase billing FAQ, free tier pausing behavior
- Timezone handling in cron jobs (dev.to, CronMonitor)
- Social deduction optimal strategy papers (arXiv), metagaming analyses

**All sources cross-referenced and verified as of 2026-02-10.**

---

## Ready for Roadmap

**Research status:** COMPLETE

**Synthesis quality:** All 4 research files read and integrated. Key findings extracted, patterns identified across research, roadmap implications derived from combined analysis.

**Recommended next step:** Proceed to requirements definition with high confidence. Phase structure (4 phases), critical path (1→2→3→4), and research flags documented. No blocking gaps identified.

**Roadmapper can now:**
- Structure phases based on dependency chain
- Prioritize features using table stakes vs differentiators framework
- Schedule deep research for Phase 2 (AI) and Phase 3 (async) during planning
- Reference pitfall-to-phase mapping for risk mitigation planning
- Use confidence assessment to identify validation points

---
*Research completed: 2026-02-10*
*Ready for roadmap: yes*
