# Project Research Summary

**Project:** Golare v1.1 — AI Behavioral Awareness
**Domain:** Async Telegram social deduction game with AI game master behavioral tracking
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

The v1.1 milestone adds player behavior awareness to Guzman, the AI game master. Currently, Guzman operates on game state data only (votes, scores, teams) but cannot see what players actually write in group chat. This milestone closes that gap by capturing player messages, analyzing behavioral patterns, and feeding that context into all AI generation calls. The core insight: this requires **zero new dependencies** — the existing stack (grammY 1.40.0, Supabase 2.95.x, OpenAI SDK with gpt-4.1-nano) already provides everything needed.

The recommended approach is a three-layer architecture: (1) lightweight middleware extension to capture group messages via grammY's existing hook, (2) dedicated `player_messages` table in Supabase with automatic 10-message-per-player pruning, and (3) heuristic-first behavioral analysis that feeds pre-compressed summaries into the existing `GuzmanContext.playerNotes` field (already present but empty in v1). AI-generated tone classification uses gpt-4.1-nano at $0.0006/game — cheaper than adding an NLP library and dramatically more accurate for Swedish slang context.

The key risk is token budget blowout. Naively injecting raw player messages into AI prompts would triple input token costs from ~75K-150K per game to ~240K-650K. Prevention: never pass raw messages to prompts. Instead, pre-compress into ~50-token behavioral summaries per player. This keeps total cost increase at 2x ($0.01 to $0.02 per game) while delivering the core "Guzman is listening" experience. Secondary risks include privacy mode blocking message capture (requires bot admin status verification at game start), middleware conflicts with existing whisper handlers (solved by strict chat type filtering), and the "creepiness" problem (prevented by prompt rules: never quote messages verbatim, only reference vague behavioral patterns).

## Key Findings

### Recommended Stack

No new npm packages required. Every v1.1 capability maps to an existing dependency: grammY middleware captures messages, Supabase stores them in a new `player_messages` table, OpenAI gpt-4.1-nano classifies tone via batch prompts, and behavioral summaries slot into the existing `GuzmanContext.playerNotes` field that whisper prompts already read (but was never populated in v1).

**Core technologies:**
- **grammY 1.40.0** — extend existing `bot.on("message:text")` middleware to capture message text, not just count messages
- **Supabase 2.95.x** — new `player_messages` table with composite index on (game_id, game_player_id, sent_at DESC) for fast "last 10 per player" queries
- **OpenAI gpt-4.1-nano** — batch tone classification at $0.10/1M input tokens; far cheaper and more accurate than Swedish NLP libraries for orten-slang context
- **Character-count heuristics** — token budgeting via "1 token ≈ 4 chars" rule; no need for tiktoken dependency (1.5MB overhead for minimal benefit)

**Key decision: Use AI for tone, not a dedicated NLP library.** AFINN-based sentiment tools (`sentiment-swedish`, `multilang-sentiment`) do not understand Swedish street slang ("wallah", "shuno", "bre" all unknown tokens). They also lack game context (cannot distinguish "golade" as game term vs hostile intent). gpt-4.1-nano with game-aware prompts costs $0.0006 per classification batch but handles slang, sarcasm, and code-switching. At 1000 messages per game, total classification cost is $0.003 — negligible compared to the development and maintenance burden of an unmaintained NLP library.

**Cost impact:** v1.1 increases AI cost from $0.01 to $0.014 per game (40% increase). At 100 games/month, total AI cost is $1.40/month. Automatic prompt caching (50% discount on repeated system prompts) may reduce this by another 15-25%.

### Expected Features

The research identified three feature tiers: table stakes (required for any behavioral AI to function), differentiators (what makes Guzman feel genuinely aware), and anti-features (tempting but harmful).

**Must have (table stakes):**
- **Message capture middleware** — intercept group text messages, store sender ID + text + timestamp (already ~80% implemented via existing `trackGroupMessage` middleware; just needs expansion from counting to capturing)
- **Per-player message ring buffer** — store last ~10 messages per player per game in dedicated DB table (NOT JSONB append; concurrent write contention and query pain)
- **Chat context builder** — assemble behavioral summaries into prompt-injectable strings capped at ~500 tokens total for all players (analogous to existing `gatherRoundEvents()`)
- **Message content filtering** — strip bot commands, system messages, sticker-only, and <3 char messages before storage
- **Player activity stats** — derived metrics: message count, time-since-last, avg length, keyword flags (accusatory/defensive)

**Should have (differentiators):**
- **Oblique message references in whispers** — Guzman's DM whispers paraphrase/twist things players said in group, never direct quotes ("Du sa natt intressant till gruppen forut..." NOT "Du skrev 'X' klockan Y")
- **Silence-calling in group** — publicly call out players who haven't written in 6+ hours ("Varfor ar du sa tyst, [Name]? Nagon som tiger har natt att gomma")
- **Activity-adapted mission narratives** — mission posts reference recent group energy (arguing vs dead quiet)
- **Mood-aware gap-fill** — gap-fill commentary adapts to group mood (accusatory vs friendly vs nervous)
- **Behavioral profiles in GuzmanContext** — AI-generated summaries updated after each round ("Ahmed: most vocal accuser. Sara: deflects with humor. Ali: unusually quiet since round 3")
- **Accusation tracking** — heuristic detection when players accuse each other by name + suspicious keywords

**Defer (v2+):**
- **Twisted references** — Guzman fabricating/exaggerating player statements (needs careful prompt engineering to avoid confusion between intentional fabrication and AI hallucination)
- **Cross-game behavioral memory** — player tendencies across multiple games

**Anti-features (deliberately avoid):**
- **Direct quoting** — feels like surveillance, not instinct; breaks ambiguity
- **Expose activity stats to players** — turns game from social deduction into activity optimization
- **Real-time reactive messages** — notification fatigue; reactions should occur in scheduled outputs (whispers, gap-fill) to create paranoia delay
- **Full message history storage** — cost explosion; last ~10 per player is sufficient
- **Per-message AI analysis** — expensive and slow; batch at generation time instead

### Architecture Approach

Three-layer integration with minimal disruption to existing v1 architecture. The existing `GuzmanContext.playerNotes` field (initialized empty, never populated) becomes the primary seam — all AI prompts already pass this field, and the whisper prompt already reads it.

**Major components:**
1. **Message Capture Middleware (bot.ts)** — expand existing line 37-42 group message middleware to also store message content (fire-and-forget pattern, never blocks); resolves player identity via cached game_id lookup; filters out bot messages, non-players, and DMs
2. **Behavioral Analyzer (new lib/behavior.ts)** — heuristic-first analysis: message count, avg length, time-since-last, exclamation/question ratio, Swedish keyword matching (accusatory: "golare", "misstanker"; defensive: "litar pa", "oskyldiga"); produces plain-text summaries capped at 150 chars per player
3. **Enhanced AI Prompts (ai-prompts.ts)** — inject behavioral context into existing prompts via new `SPELARBETEENDE` section; modify whisper prompts to include 1-2 message quotes from target; add new `buildAccusationPrompt()` for public call-outs; never quote verbatim, always paraphrase/twist
4. **Database Layer (player_messages table)** — dedicated table with composite index; CRUD functions following established Supabase patterns (type assertions on `.select('*')`); automatic cleanup on game finish via CASCADE delete
5. **Accusation System** — piggybacked onto existing gap-fill handler (runs 14:00 and 20:00); when group quiet AND behavioral anomaly detected, call `generateAccusation()` instead of generic gap-fill; max 1 accusation per 4-hour window

**Key patterns to follow:**
- Fire-and-forget for non-critical writes (message capture uses `.catch()`, never `await`)
- Template fallback on all AI paths (accusations return `null` on failure rather than generic template)
- Behavioral data as plain text in playerNotes (not structured JSON; more natural for LLM consumption)
- In-memory cache with DB persistence (cache game_id lookups, persist messages)

**Anti-patterns to avoid:**
- AI for every behavioral analysis (heuristics for basic stats, AI only for tone/summaries)
- Storing full message history (ring buffer of ~10 per player)
- Synchronous DB queries in middleware (fire-and-forget with `.catch()`)
- Separate behavioral context from GuzmanContext (use existing `playerNotes` field)

### Critical Pitfalls

1. **Token budget blowout** — injecting raw messages into AI prompts triples input tokens (75K → 240K per game). Prevention: pre-compress to ~50-token summaries per player; never pass raw messages to prompts; budget guard before each AI call.

2. **Privacy mode blocks message capture** — Telegram bots default to privacy mode (only see commands/replies); bot misses all organic chat. Prevention: verify bot admin status at game start; refuse to create game if not admin; monitor message counts during game hours for anomalies.

3. **Middleware conflict with whisper handler** — new message tracking interferes with existing DM-based whisper input (engagement.ts lines 571-663). Prevention: strict chat type filter (`group/supergroup` only); register tracking in existing middleware slot (line 37-42), not as new Composer; always call `next()`.

4. **Creepiness problem** — Guzman quoting exact messages feels like surveillance, causing self-censorship and reduced engagement. Prevention: NEVER quote verbatim; reference vague behavioral patterns only; frame as Guzman's "gut feeling"; add prompt instruction: "speak from instinct, not data analysis."

5. **Tone analysis unreliability** — Swedish slang classification ("wallah bror du ar sketchy" misread as aggressive). Prevention: use game-context-aware gpt-4.1-nano prompts with slang examples; classify into game-relevant categories (accusatory/defensive/neutral), not generic sentiment; default to "neutral" on low confidence.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Pipeline
**Rationale:** Message capture and storage must work before any AI integration can function. This phase has zero user-facing changes — it just starts collecting data. Testable independently: verify messages appear in DB when players chat.

**Delivers:**
- `player_messages` table with indexes and cleanup trigger
- Extended middleware in bot.ts (fire-and-forget capture)
- CRUD functions in db/client.ts
- Message filtering (bot messages, non-players, DMs excluded)
- Bot admin status verification at game creation

**Addresses features:**
- T1: Message capture middleware
- T2: Per-player message ring buffer
- T5: Message content filtering

**Avoids pitfalls:**
- Pitfall 2 (privacy mode) via admin check
- Pitfall 3 (middleware conflict) via strict chat type filtering
- Pitfall 6 (database growth) via cleanup mechanism in schema
- Pitfall 7 (bot's own messages) via `is_bot` filter

**Research flag:** Standard pattern (grammY middleware + Supabase CRUD). No deeper research needed.

### Phase 2: Behavioral Analysis
**Rationale:** With messages stored, build the heuristic analysis layer that computes player stats and feeds the AI context builder. Still no user-facing changes — output is console logs for validation.

**Delivers:**
- `lib/behavior.ts` module with heuristic analysis (frequency, tone keywords, silence detection)
- `buildPlayerBehaviorContext()` helper that assembles summaries
- Population of `GuzmanContext.playerNotes` before whisper generation
- Token budget guards (cap summaries at 50 tokens per player)

**Addresses features:**
- T3: Player activity stats
- T4: Chat context builder
- D7: Accusation tracking (heuristic detection)

**Avoids pitfalls:**
- Pitfall 1 (token blowout) via pre-compression
- Pitfall 5 (tone unreliability) via heuristic-first approach
- Pitfall 8 (summary staleness) via hybrid real-time counters + periodic AI summaries

**Research flag:** Standard pattern (behavioral heuristics + LLM summaries). Tone classification prompts need testing but no domain research required.

### Phase 3: Whisper Integration
**Rationale:** Whispers already have the `playerNotes` integration seam built in (ai-prompts.ts line 150). This is the lowest-risk AI change and highest-impact feature (Guzman quoting actual messages, twisted). Infrastructure from Phase 1-2 in place.

**Delivers:**
- Enhanced whisper prompts with message quotes (1-2 per target, paraphrased)
- Behavioral context for all players in whisper generation
- Prompt instructions: never quote verbatim, always oblique references

**Addresses features:**
- D1: Oblique message references in whispers
- D6: Behavioral profiles in GuzmanContext (whisper-specific)

**Avoids pitfalls:**
- Pitfall 4 (creepiness) via explicit prompt rules

**Research flag:** Prompt engineering experimentation needed. May need 2-3 iterations to get oblique reference tone right. Not domain research — just prompt tuning.

### Phase 4: Gap-Fill & Accusations
**Rationale:** These modify existing gap-fill behavior and add the public accusation feature. Higher risk (new visible behavior in group chat) but infrastructure is in place. Accusations piggyback on gap-fill schedule (no new cron job).

**Delivers:**
- Enhanced gap-fill with behavioral context and mood awareness
- Behavioral anomaly detection (suspicious silence, aggression spike)
- `generateAccusation()` function with 4-hour cooldown
- Frequency control (max 1 accusation per game per window)

**Addresses features:**
- D2: Silence-calling in group
- D5: Mood-aware gap-fill
- D4: Behavioral whisper triggers (via anomaly detection)

**Avoids pitfalls:**
- Pitfall 11 (role leakage) via role-blind public prompts

**Research flag:** Standard pattern (extending existing gap-fill). No research needed.

### Phase 5: Mission Narrative Adaptation
**Rationale:** Lightest touch — adds group mood to mission prompts. Enhancement, not new feature. Can be last since it's additive.

**Delivers:**
- `GRUPPDYNAMIK` section in mission prompts (group mood based on aggregate behavior)
- Mission narratives reference recent group energy (arguing vs quiet)

**Addresses features:**
- D3: Activity-adapted mission narratives

**Avoids pitfalls:**
- None specific (already avoided in earlier phases)

**Research flag:** No research needed (prompt enhancement only).

### Phase Ordering Rationale

- **Data first (Phase 1):** Cannot do AI integration without stored messages. This phase is testable in isolation and has no user-facing impact — ideal for validating the foundation.

- **Analysis second (Phase 2):** Behavioral summaries are needed before modifying any AI prompts. Building the analysis layer separately allows validation via console logs before risking AI output quality.

- **Whispers third (Phase 3):** The existing `playerNotes` seam in whisper prompts (line 150 of ai-prompts.ts) makes this the lowest-risk AI integration. Whispers are DM-only, so failed experiments don't disrupt group chat.

- **Gap-fill fourth (Phase 4):** Public-facing messages (group chat) are higher risk than DMs. Only attempt after whisper integration is validated. Accusations piggyback on existing gap-fill infrastructure.

- **Missions last (Phase 5):** Pure enhancement with no new infrastructure. Can defer if earlier phases take longer than expected.

- **Pitfall avoidance:** This ordering front-loads the critical pitfalls (token budget, privacy mode, middleware conflicts) in Phases 1-2 where there are no user-facing changes yet. AI integration (Phases 3-5) happens only after the data pipeline is proven stable.

### Research Flags

Phases likely needing experimentation during planning:
- **Phase 3 (Whisper Integration):** Prompt engineering for oblique references needs 2-3 iterations. The "twisted, not quoted" tone is novel. Low risk (DM-only) but needs testing.

Phases with standard patterns (no research needed):
- **Phase 1 (Data Pipeline):** grammY middleware + Supabase CRUD — well-documented, established patterns in existing codebase
- **Phase 2 (Behavioral Analysis):** Heuristic analysis + LLM summarization — standard context engineering
- **Phase 4 (Gap-Fill & Accusations):** Extending existing gap-fill handler — infrastructure already present
- **Phase 5 (Mission Adaptation):** Prompt enhancement only — no new patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies required. All capabilities map to existing stack (grammY, Supabase, OpenAI). Cost projections based on verified OpenAI pricing. |
| Features | MEDIUM | Novel domain (no direct comparable for AI behavior tracking in social deduction). Feature set synthesized from AI NPC research, LLM agent studies, and chat memory best practices. Table stakes well-validated; differentiators need testing. |
| Architecture | HIGH | Direct codebase analysis of all 21 TypeScript files. Integration points verified: existing middleware hook (bot.ts:37-42), empty `playerNotes` field (types.ts:150), whisper prompt seam (ai-prompts.ts:150). Minimal disruption to v1 architecture. |
| Pitfalls | HIGH | Telegram privacy mode constraints verified via official docs. Token budget calculations based on verified pricing + existing prompt analysis. Middleware conflicts mapped via source review. Tone analysis concerns validated via Swedish NLP research. |

**Overall confidence:** HIGH

### Gaps to Address

- **Oblique reference tone tuning:** The "twisted, not quoted" style for message references is novel and needs prompt experimentation. Not a research gap — just implementation tuning. Recommendation: Phase 3 includes 2-3 prompt iterations with playtest validation.

- **Swedish slang tone classification accuracy:** Heuristic keywords are a starting point, but real-world accuracy in orten-svenska context needs validation. Recommendation: log tone classifications alongside original messages during Phase 2; human-review a sample of 20 classifications per game; adjust keyword lists and AI prompts based on misclassifications.

- **Behavioral anomaly detection thresholds:** "Suspicious silence" = how many hours? "Aggression spike" = how much increase over baseline? These thresholds need empirical tuning. Recommendation: Phase 4 starts with conservative values (6hr silence, 2x aggression); adjust based on false positive rate.

- **Cost tracking implementation:** The v1 codebase does not currently track per-game token usage. This was flagged as a pitfall in v1 planning but may not have been implemented. Recommendation: verify cost tracking exists before Phase 1; if missing, add as prerequisite.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `/Users/martinnordlund/golare/src/` (all 21 TypeScript source files, especially bot.ts, ai-prompts.ts, db/types.ts, whisper-handler.ts, engagement.ts)
- [OpenAI API Pricing](https://platform.openai.com/docs/pricing) — gpt-4o-mini: $0.15/$0.60 per 1M tokens, gpt-4.1-nano: $0.10/$0.40 per 1M tokens
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) — automatic 50% discount on cached input tokens at 1024+ tokens
- [Telegram Bot Features - Privacy Mode](https://core.telegram.org/bots/features) — bots with privacy mode enabled only see commands/replies unless admin
- [grammY Middleware Documentation](https://grammy.dev/guide/middleware) — middleware chain and `next()` pattern
- [Supabase JSONB Discussion #18829](https://github.com/orgs/supabase/discussions/18829) — JSONB array append limitations

### Secondary (MEDIUM confidence)
- [LLM Chat History Summarization Guide (mem0.ai)](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) — sliding window and summarization patterns
- [Microscopic Analysis on LLM Players via Social Deduction Game (arXiv)](https://arxiv.org/html/2408.09946v1) — behavioral metrics (accusation rate, vote rate)
- [On the Importance of Reactions in Game AI (gamedeveloper.com)](https://www.gamedeveloper.com/design/you-had-me-at-aaaahhh-on-the-importance-of-reactions-in-game-ai) — cooldowns, variety, annoyance thresholds
- [Inworld AI: Fourth Wall and NPC Design](https://inworld.ai/blog/ai-npcs-and-the-future-of-video-games) — player profiles, relationship progression
- [GPT-4.1-nano Pricing Guide](https://gptbreeze.io/blog/gpt-41-nano-pricing-guide/) — nano as cost-effective classification tier
- [KBLab Swedish Sentiment Classifier](https://kb-labb.github.io/posts/2023-06-16-a-robust-multi-label-sentiment-classifier-for-swedish/) — Swedish NLP limitations with slang

### Tertiary (LOW confidence)
- [Social Deduction Game Design Fundamentals (BKGameDesign)](https://bkgamedesign.medium.com/social-deduction-game-design-fundamentals-a4cbae378005) — player behavior observation as core mechanic (general design principles, not specific to AI implementation)

---
*Research completed: 2026-02-11*
*Ready for roadmap: yes*
