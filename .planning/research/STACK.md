# Technology Stack: v1.1 AI Behavioral Awareness

**Project:** Golare (Telegram social deduction game)
**Milestone:** v1.1 -- Player message tracking, tone analysis, AI behavioral context
**Researched:** 2026-02-11
**Overall Confidence:** HIGH

---

## Executive Decision: Zero New Dependencies

The v1.1 features (message capture, tone analysis, behavioral AI context) require **no new npm packages**. The existing stack -- grammY 1.40.0, Supabase 2.95.x, OpenAI SDK 6.x with gpt-4.1-nano -- already provides everything needed. This section explains why and how.

---

## Recommended Stack Additions

### New Libraries Required

**None.**

Every v1.1 capability maps to an existing dependency:

| v1.1 Capability | Existing Tool | How |
|-----------------|---------------|-----|
| Capture group messages | grammY middleware (already in `bot.ts`) | Extend existing `bot.on("message:text")` middleware to store messages, not just count them |
| Store messages | Supabase (PostgreSQL) | New `player_messages` table with dedicated rows per message |
| Analyze tone/frequency | OpenAI gpt-4.1-nano | Batch classify messages via structured output during whisper/narrative generation |
| Feed behavior into AI context | OpenAI prompts | Append behavioral summary to existing `buildWhisperPrompt()`, `buildGapFillPrompt()`, etc. |
| Token budget management | Character-count heuristic | 1 token ~= 4 characters for Swedish text; no need for tiktoken |

---

## Key Technical Decisions

### 1. Tone Analysis: Use gpt-4.1-nano, NOT a Dedicated NLP Library

**Decision:** Use the existing OpenAI gpt-4.1-nano model for tone classification. Do not add `multilang-sentiment`, `nlp.js`, `sentiment-swedish`, or any other NLP library.

**Rationale:**

| Factor | Dedicated NLP (AFINN-based) | gpt-4.1-nano |
|--------|----------------------------|--------------|
| Swedish orten-slang support | Terrible. AFINN wordlists use formal Swedish. "Wallah" = unknown, "shuno" = unknown, "bre" = unknown. Would misclassify nearly all game chat. | Excellent. GPT models understand Swedish slang, context, sarcasm, and code-switching. |
| Contextual understanding | Word-level polarity only. "Han golade" (game-specific) = meaningless to AFINN. | Understands game context when given system prompt. Can distinguish "golade" (game term) from hostile intent. |
| Classification granularity | Numeric score (-5 to +5). Hard to map to game-useful categories. | Can return structured categories: `aggressive`, `defensive`, `suspicious`, `joking`, `quiet`, `accusatory` -- whatever the prompt specifies. |
| Cost per message | Free (local computation) | ~$0.000003 per classification (30 input tokens + 10 output tokens at $0.10/$0.40 per 1M). Classifying 1000 messages costs $0.003. |
| Latency | <1ms | ~200ms per call, but we batch-classify and do NOT block message flow |
| New dependency | Yes (unmaintained: `sentiment-swedish` last updated 5+ years ago; `multilang-sentiment` v2.0.0 last published 4+ years ago) | No (already in stack) |
| Maintenance burden | Another library to maintain, test, keep updated | Zero -- same OpenAI client already used for whispers/narratives |

**The cost argument is decisive:** At $0.10/1M input tokens, gpt-4.1-nano is so cheap that local NLP offers negligible savings while being dramatically worse at understanding Swedish street slang in a game context. A full 5-day game with 6 players generating 50 messages each = 300 messages = $0.0009 for tone classification.

**Confidence: HIGH** -- gpt-4.1-nano pricing verified via [OpenAI pricing page](https://platform.openai.com/docs/pricing) and [GPTBreeze analysis](https://gptbreeze.io/blog/gpt-41-nano-pricing-guide/). Swedish NLP library limitations verified via npm registry (last-published dates, download counts).

### 2. Message Storage: Dedicated Table, NOT JSONB Append

**Decision:** Store messages in a new `player_messages` Supabase table with one row per message. Do not append to a JSONB array on the `games` or `game_players` table.

**Rationale:**

| Factor | JSONB Array (on game/player) | Dedicated Table |
|--------|------------------------------|-----------------|
| Query flexibility | Hard to query by time range, player, game. Requires JSONB path operators. | Standard SQL: `WHERE game_id = X AND player_id = Y AND created_at > Z` |
| Supabase client support | Append requires raw RPC (Supabase JS client has no native JSONB array append). Discussed extensively in [Supabase Discussion #18829](https://github.com/orgs/supabase/discussions/18829). | Standard `.insert()` and `.select()` with filters |
| Concurrent writes | JSONB append on a row = row-level lock contention when multiple players message simultaneously | No contention -- each INSERT is independent |
| Data growth | Unbounded JSONB array on game row = increasingly slow reads/writes | Individual rows with indexes. Can paginate, aggregate, delete old data. |
| Aggregation | Requires `jsonb_array_length()`, unnesting | Standard `COUNT()`, `GROUP BY` |
| Existing pattern | Breaks the project's established pattern (each entity has its own table: votes, whispers, surveillance, etc.) | Consistent with existing architecture |

**Schema:**

```sql
CREATE TABLE player_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id),
  game_player_id UUID NOT NULL REFERENCES game_players(id),
  round_number INTEGER NOT NULL,
  message_text TEXT NOT NULL,
  tone TEXT,  -- classified later by AI: aggressive, defensive, suspicious, joking, accusatory, neutral
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_player_messages_game_round ON player_messages(game_id, round_number);
CREATE INDEX idx_player_messages_player ON player_messages(game_player_id);
```

**Confidence: HIGH** -- follows established project patterns (every entity type gets its own table), avoids known Supabase JSONB limitations.

### 3. Token Budget: Heuristic Truncation, NOT tiktoken

**Decision:** Use character-count heuristics for token budget management. Do not add `js-tiktoken` or `@dqbd/tiktoken`.

**Rationale:**

- Swedish text averages ~1 token per 3.5-4 characters (slightly higher than English due to compound words and special characters).
- The project already uses character-based truncation (see `sanitizeForTelegram()` at 4000 chars).
- `js-tiktoken` adds 1.5MB+ to dependencies for a calculation that needs to be "roughly right, not exact."
- Current prompt budgets (800 max_tokens for narratives, 400 for whispers, 200 for commentary) leave ample room.

**Budget allocation for player behavior context:**

| AI Generation Type | Current max_tokens | Current prompt size (est.) | Available for behavior context | Character budget |
|--------------------|--------------------|---------------------------|-------------------------------|-----------------|
| Whisper (gpt-4o-mini) | 400 output | ~800 input tokens | ~600 tokens (~2400 chars) | Include last 5 messages per target + frequency stats |
| Gap-fill (gpt-4.1-nano) | 200 output | ~400 input tokens | ~400 tokens (~1600 chars) | Include group activity summary + top talker |
| Mission narrative (gpt-4o-mini) | 800 output | ~1000 input tokens | ~500 tokens (~2000 chars) | Include behavioral summary per player |
| Result reveal (gpt-4o-mini) | 800 output | ~1000 input tokens | ~500 tokens (~2000 chars) | Include team member behavior during round |

All models used (gpt-4o-mini, gpt-4.1-nano) support 128K+ context windows, so the concern is cost, not capacity. At $0.15/1M input tokens (gpt-4o-mini), adding 500 tokens of player context per generation costs $0.000075 per call. Negligible.

**Confidence: HIGH** -- token/character ratios from general knowledge, budget calculations from reading actual prompt code.

### 4. Message Capture: Extend Existing Middleware, NOT New Handler

**Decision:** Extend the existing `bot.on("message:text")` middleware in `bot.ts` (currently line 37-42, only calls `trackGroupMessage(ctx.chat.id)`) to also capture and store the actual message text.

**Critical prerequisite:** The Telegram bot's **privacy mode must be disabled** via BotFather. Currently, the bot uses `trackGroupMessage()` which only counts messages (in-memory counter), suggesting privacy mode may already be disabled. If not:

1. Message @BotFather
2. Select the bot
3. Go to Bot Settings > Group Privacy
4. Set to "Disable"
5. Remove and re-add the bot to existing groups

Without this, the bot only receives: commands, replies to the bot, and messages mentioning the bot. It will NOT see general group chat.

**Integration point:** The middleware in `bot.ts` already captures every group text message. The change is minimal:

```typescript
// Current (v1):
bot.on("message:text", async (ctx, next) => {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    trackGroupMessage(ctx.chat.id);  // just counts
  }
  await next();
});

// v1.1: also store the message
bot.on("message:text", async (ctx, next) => {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    trackGroupMessage(ctx.chat.id);
    // Fire-and-forget: do not await (must not block message processing)
    capturePlayerMessage(ctx).catch(err =>
      console.warn("[capture] Failed:", err)
    );
  }
  await next();
});
```

The `capturePlayerMessage()` function looks up the active game for this group, resolves the player, and inserts into `player_messages`. It is fire-and-forget -- capture failures must never block the bot's message handling pipeline.

**Confidence: HIGH** -- the integration point already exists in `bot.ts` line 37-42.

### 5. Behavioral Context Format: Pre-Summarized Text, NOT Raw Messages

**Decision:** Do not dump raw player messages into AI prompts. Instead, build a pre-summarized behavioral context string that includes:

- Message frequency (messages per player this round)
- Tone distribution (if classified: "Ahmed: 3 aggressive, 1 suspicious, 2 neutral")
- Key quotes (last 2-3 messages per player, truncated)
- Behavioral flags ("Sara har inte skrivit nåt denna runda", "Erik skriver mest av alla")

This keeps token usage predictable and gives the AI actionable behavioral signals rather than raw chat logs.

**Format example for whisper prompt:**

```
SPELARBETEENDE DENNA RUNDA:
- Ahmed: 5 meddelanden (mest aktiv). Ton: aggressiv, anklagande. Senast: "Jag litar inte på Sara wallah"
- Sara: 0 meddelanden (tyst). Har inte sagt nåt sedan förra omgången.
- Erik: 2 meddelanden. Ton: skämtsam. Senast: "Lugna er allihopa bre"
- Fatima: 3 meddelanden. Ton: misstänksam. Senast: "Varför ville du ha med Erik?"
```

**Confidence: HIGH** -- this is a prompt engineering pattern, not a library choice. Follows the project's existing approach of building specific context strings (see `gatherRoundEvents()` in whisper-handler.ts).

---

## Cost Impact Analysis

### Current v1 AI Cost Per Game (5 rounds, 6 players)

| Generation | Model | Calls/game | Input tokens/call | Output tokens/call | Cost/game |
|------------|-------|-----------|-------------------|-------------------|-----------|
| Mission narrative | gpt-4o-mini | 5 | ~1000 | ~500 | $0.002 |
| Result reveal | gpt-4o-mini | 5 | ~1000 | ~500 | $0.002 |
| Whispers | gpt-4o-mini | ~15 | ~800 | ~200 | $0.004 |
| Gap-fill | gpt-4.1-nano | ~10 | ~400 | ~100 | $0.0008 |
| Individual reveals | gpt-4.1-nano | 6 | ~300 | ~150 | $0.0003 |
| Surveillance clues | gpt-4.1-nano | ~6 | ~400 | ~150 | $0.0005 |
| Spaning answers | gpt-4o-mini | ~4 | ~400 | ~200 | $0.0008 |
| **v1 Total** | | | | | **~$0.01/game** |

### v1.1 Additional Cost

| Generation | Model | Calls/game | Input tokens/call | Output tokens/call | Cost/game |
|------------|-------|-----------|-------------------|-------------------|-----------|
| Tone classification (batch) | gpt-4.1-nano | ~10 batches | ~200 (batch of 5-10 msgs) | ~50 | $0.0006 |
| Behavioral context (added to existing prompts) | -- | 0 new calls | +500 tokens to ~40 existing calls | 0 | $0.003 |
| **v1.1 Additional** | | | | | **~$0.004/game** |
| **v1.1 Total** | | | | | **~$0.014/game** |

**v1.1 increases AI cost by ~40%, from $0.01 to $0.014 per game.** At 100 games/month, total AI cost is $1.40/month. This is negligible.

**Prompt caching bonus:** OpenAI's automatic prompt caching (50% discount on cached input tokens, kicks in at 1024+ tokens) will apply to the Guzman system prompt, which is repeated across all calls and is ~800 tokens. This could reduce costs by an additional 15-25% on calls where the system prompt is cached.

**Confidence: HIGH** -- pricing from [OpenAI pricing](https://openai.com/api/pricing/), call counts estimated from code analysis.

---

## Existing Stack (Unchanged for v1.1)

These are already validated and installed. Do NOT re-research or modify.

| Technology | Version | Purpose |
|------------|---------|---------|
| grammY | 1.40.0 | Telegram bot framework |
| @grammyjs/auto-retry | 2.0.2 | Automatic retry on rate limits |
| @grammyjs/transformer-throttler | 1.2.1 | Outgoing request throttling |
| @supabase/supabase-js | 2.95.3 | PostgreSQL database client |
| OpenAI SDK | 6.21.0 | AI generation (gpt-4o-mini, gpt-4.1-nano) |
| Zod | 4.3.6 | Schema validation, structured outputs |
| Croner | 10.0.1 | Cron scheduling |
| dotenv | 17.2.4 | Environment variable loading |
| TypeScript | 5.9.3 | Language |
| Node.js | 22.x | Runtime |
| tsx | 4.21.0 | Dev TS execution |

---

## What NOT to Add (and Why)

| Library | Why Tempting | Why Wrong for Golare v1.1 |
|---------|-------------|---------------------------|
| `sentiment` / `multilang-sentiment` / `sentiment-swedish` | "Free local tone analysis!" | AFINN wordlists do not understand Swedish orten-slang. `sentiment-swedish` last updated 5+ years ago. `multilang-sentiment` last published 4 years ago (v2.0.0). Would misclassify game-specific language. gpt-4.1-nano costs $0.0006/game for the same task with far better accuracy. |
| `nlp.js` (AXA Group) | "40-language NLP suite with sentiment!" | Massive dependency (50+ sub-packages). Way overbuilt for classifying 50 short messages per game. Adds complexity for negligible cost savings vs gpt-4.1-nano. |
| `js-tiktoken` / `@dqbd/tiktoken` | "Precise token counting for budget management" | Adds 1.5MB+ dependency. Character heuristic (chars / 4) is sufficient. The project already uses character-based truncation. Exact token counts are unnecessary when budgets have wide margins. |
| `compromise` / `natural` | "English NLP for text analysis" | English-focused. Swedish is the primary language. These would add dependencies that don't even apply. |
| `@supabase/realtime-js` | "Listen for new messages in real-time" | The bot already receives all messages via grammY middleware. Supabase Realtime would be a redundant second channel. |
| `bull` / `bullmq` | "Queue tone analysis jobs" | Over-engineering. Fire-and-forget async calls are sufficient. 50 messages/game do not need a job queue with Redis. |
| `redis` / `ioredis` | "Cache player behavioral summaries" | In-memory Map or direct DB query is fine for the expected scale. Adding Redis infrastructure for caching ~6 player summaries per game is absurd. |

---

## Integration Points Summary

| Existing Code | What Changes for v1.1 | Scope |
|---------------|----------------------|-------|
| `bot.ts` (line 37-42) | Extend group message middleware to also store message text (fire-and-forget) | 5 lines |
| `db/types.ts` | Add `PlayerMessage` type and table definition to Database type | ~30 lines |
| `db/client.ts` | Add `insertPlayerMessage()`, `getPlayerMessagesForRound()`, `getPlayerMessageStats()` | ~60 lines |
| `lib/ai-prompts.ts` | Add `buildBehavioralContext()` function; modify `buildWhisperPrompt()`, `buildGapFillPrompt()`, `buildMissionPrompt()`, `buildResultPrompt()` to include behavioral context | ~80 lines |
| `lib/ai-guzman.ts` | Add `classifyMessageTone()` function using gpt-4.1-nano structured output | ~40 lines |
| `handlers/whisper-handler.ts` | Pass behavioral context to whisper generation; use message stats for gap-fill triggers | ~20 lines |
| Supabase migrations | New `player_messages` table with indexes | 1 migration file |

**Total estimated new/changed code:** ~240 lines across 7 files + 1 migration. No new dependencies.

---

## Sources

- [OpenAI Pricing](https://openai.com/api/pricing/) -- gpt-4o-mini: $0.15/$0.60 per 1M tokens, gpt-4.1-nano: $0.10/$0.40 per 1M tokens
- [GPT-4.1-nano Pricing Guide](https://gptbreeze.io/blog/gpt-41-nano-pricing-guide/) -- $0.10 input, $0.40 output per 1M tokens, 75% cached discount
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) -- automatic, 50% discount on cached input tokens at 1024+ tokens
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) -- Zod schema integration, strict mode
- [Supabase JSONB Discussion #18829](https://github.com/orgs/supabase/discussions/18829) -- JSONB array append limitations in Supabase JS client
- [Telegram Bot Privacy Mode](https://www.teleme.io/articles/group_privacy_mode_of_telegram_bots?hl=en) -- must be disabled for bot to see all group messages
- [Telegram Bot Features](https://core.telegram.org/bots/features) -- privacy mode behavior in groups
- [multilang-sentiment npm](https://www.npmjs.com/package/multilang-sentiment) -- v2.0.0, last published 4 years ago
- [sentiment-swedish GitHub](https://github.com/AlexGustafsson/sentiment-swedish) -- AFINN-based, last updated 5+ years ago
- [GPT-4.1-nano for Classification](https://help.apiyi.com/en/openai-small-models-gpt-4-1-mini-nano-guide-en.html) -- recommended for sentiment/classification tasks

---

*Stack research for: Golare v1.1 -- AI Behavioral Awareness*
*Researched: 2026-02-11*
