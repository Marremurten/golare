# Domain Pitfalls: v1.1 AI Behavioral Awareness

**Domain:** Adding player message tracking, tone analysis, and AI behavioral awareness to an existing Telegram social deduction game
**Researched:** 2026-02-11
**Confidence:** HIGH (Telegram constraints, existing codebase integration verified via source review), MEDIUM (tone analysis accuracy, token budget based on research + pricing data)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken gameplay, or cost spirals if not caught early.

### Pitfall 1: Token Budget Blowout from Injecting Player Messages into AI Context

**What goes wrong:** Each AI call (whispers, narratives, gap-fill, surveillance) now includes a "player behavior summary" alongside the existing GuzmanContext. With 10 players, each contributing ~10 stored messages, that is 100 messages (~50-100 tokens each) = 5,000-10,000 additional tokens per AI call. The existing GuzmanContext already consumes ~500-1,500 tokens per call (round summaries, mood, story arc, few-shot examples in system prompt). Adding raw player messages doubles or triples input token costs per call.

**Why it happens:** The natural instinct is to pass all tracked messages directly into prompts: "here is what each player said." But the Guzman system prompt alone is ~1,200 tokens (the few-shot examples are large). The existing code sets `max_tokens` at 200-800 per call, but input tokens are already at 1,500-3,000. Adding 5,000-10,000 tokens of raw player messages means input tokens jump to 8,000-13,000 per call. At gpt-4o-mini pricing ($0.15/1M input), this is still cheap per call -- but there are 30-50 AI calls per game across whispers, narratives, gap-fill, and commentary. That is 240K-650K input tokens per game versus the current ~75K-150K. A 3-5x cost increase.

**Consequences:**
- Cost per game rises from ~$0.01-0.02 to ~$0.05-0.10 (manageable individually, but 5x multiplier)
- Worse: response latency increases linearly with input tokens. Current calls at 2,000-3,000 input tokens return in 1-2s. At 10,000+ tokens, expect 3-5s. Players notice.
- gpt-4.1-nano commentary calls (currently 200 tokens budget) become disproportionately expensive if bloated with player message context

**Prevention:**
- NEVER pass raw player messages to AI prompts. Instead, pre-compute a compressed behavioral summary per player: 1-2 sentences covering tone, frequency, notable quotes. This summary should be under 50 tokens per player, ~500 tokens total for 10 players.
- Use a two-stage approach: (1) periodic summary generation using gpt-4.1-nano (cheap: $0.02/1M input) to digest raw messages into behavioral notes, (2) feed only the compressed notes into narrative/whisper prompts.
- Store summaries in the existing `GuzmanContext.playerNotes` field (already exists but is currently empty). This field was designed for this purpose.
- Budget guard: sum `(system_prompt_tokens + context_tokens + player_summary_tokens)` before each AI call. If over 4,000 input tokens, truncate player summaries first.
- Track per-game token usage (the v1 pitfall about cost tracking still applies -- add a counter now if not present).

**Warning signs:** AI call latency increasing from ~1.5s to ~4s; per-game OpenAI cost tracking shows 3x+ increase; gap-fill commentary (gpt-4.1-nano, 200 max_tokens) starts timing out.

**Detection:** Add logging of input token count per AI call. Alert if any call exceeds 6,000 input tokens.

**Phase to address:** First phase (message storage). Design the compression pipeline before storing messages, so the schema supports both raw messages and compressed summaries.

---

### Pitfall 2: Telegram Privacy Mode Blocks Message Capture

**What goes wrong:** The bot is added to a group but has privacy mode enabled (the default). It only receives commands (`/nyttspel`, `/status`) and messages that reply to the bot. All regular player-to-player conversation in the group is invisible to the bot. The new message tracking feature captures zero organic messages. The behavioral awareness feature has no data to work with.

**Why it happens:** Telegram bots have privacy mode enabled by default. In this mode, bots only see: (1) commands directed at them, (2) messages replying to the bot's messages, (3) service messages. The existing `trackGroupMessage()` middleware in `bot.ts` (line 37-42) only increments a counter -- it works because the gap-fill feature only needs "is the group quiet?" (message count), not message content. But for behavioral awareness, the bot needs actual message text and sender identity.

**Consequences:**
- The existing `trackGroupMessage(ctx.chat.id)` call fires for messages the bot actually receives. With privacy mode ON and the bot as admin, it sees everything. But if the bot is NOT an admin, it misses most messages.
- The current code at `bot.ts` line 37 checks for group/supergroup chat type -- this is correct. But if the bot loses admin status mid-game (group owner changes settings), message capture silently stops.
- The v1 codebase does NOT currently validate bot admin status at game start.

**Prevention:**
- The bot MUST be a group admin to receive all messages. This is already implied by the v1 architecture (the bot sends messages to groups, needs to pin messages, etc.), but it is not enforced.
- Add an admin status check at game creation (`/nyttspel`). If the bot is not admin, refuse to start and tell the user to make it admin.
- Add a periodic health check: during active games, verify the bot can still see messages (if the message counter stops incrementing during game hours, something is wrong).
- Alternatively, disable privacy mode via @BotFather. This makes the bot receive ALL messages in ALL groups it is in, even where no game is active. This creates unnecessary processing and potential privacy concerns. Admin-based approach is cleaner.
- Document the admin requirement clearly in the onboarding flow.

**Warning signs:** `trackGroupMessage()` counter stays at 0 or very low during active game hours; gap-fill fires constantly because the bot thinks the group is quiet; player behavioral summaries are empty or only contain command messages.

**Detection:** Log message count per group per hour. If count is 0 during game hours (09:00-21:00) for a group with an active game, emit a warning.

**Phase to address:** First phase. Gate the entire feature on bot admin verification.

---

### Pitfall 3: Freeform Text Handler Conflict -- Message Capture vs Whisper Input

**What goes wrong:** A new middleware is added to capture all group messages for behavioral tracking. But the existing engagement handler (`engagement.ts` line 571-663) has a freeform text handler that captures DM text as whisper content. If the new message-tracking middleware is registered in the wrong order or processes DM messages, it could: (a) consume the update before the whisper handler sees it, (b) store private whisper content as "player messages" in the tracking database, or (c) both handlers try to process the same update.

**Why it happens:** grammY processes middleware in registration order. The current `bot.ts` registers:
1. Group activity tracking middleware (line 37-42) -- fires for ALL `message:text`, calls `next()`
2. startHandler, lobbyHandler, gameCommandsHandler, gameLoopHandler
3. engagementHandler (contains freeform text handler as LAST item)

The freeform text handler at `engagement.ts:571` checks `chatType("private")` and only processes if there is a `pendingWhisper`. It calls `next()` if there is no pending whisper. This architecture is correct but fragile.

**Consequences:**
- If a new message-tracking middleware is registered as a Composer that listens to `message:text` (both group AND private), it could capture whisper text content and store it as a "player message."
- If the new middleware does NOT call `next()` for private messages, it breaks the whisper flow.
- If the new middleware is registered AFTER the engagement handler, it never sees group messages because the engagement handler only passes through private messages without pending whispers.

**Prevention:**
- The new message tracking middleware MUST only capture group messages. Filter strictly: `ctx.chat?.type === "group" || ctx.chat?.type === "supergroup"`. Never process private messages.
- Register the new middleware BEFORE the engagement handler (where the existing `trackGroupMessage` middleware is -- line 37-42 of `bot.ts`). Expand the existing middleware rather than adding a new one.
- Always call `await next()` after capturing the message data. Message tracking is an observer, not a consumer.
- Add a unit test that verifies: (1) a private whisper message does NOT appear in the tracking database, (2) the whisper flow still works after adding tracking middleware.

**Warning signs:** Players' private whisper text appearing in behavioral tracking data; whisper handler suddenly not receiving freeform text; engagement commands breaking silently.

**Detection:** In the message tracking insert, assert `chat.type !== 'private'` and log an error if a private message slips through.

**Phase to address:** First phase (message capture middleware). The middleware registration order is the first thing to get right.

---

### Pitfall 4: Players Feel Surveilled -- The "Creepiness" Problem

**What goes wrong:** Guzman starts making comments like "Jag sag att du skrev 'jag litar pa Ahmed' klockan 14:32, bre..." Players realize the bot is reading and analyzing their every message. The game stops feeling like a fun social deduction experience and starts feeling like surveillance. Players self-censor, reducing engagement -- the opposite of the desired effect. Some players may leave the game or group entirely.

**Why it happens:** The feature's goal is to make Guzman reactive to player behavior. The naive implementation quotes messages directly, references timestamps, or makes observations that are too specific. This feels invasive because players do not expect a game bot to be reading their casual conversation. Social deduction games thrive on free-flowing discussion; surveillance chills that discussion.

**Consequences:**
- Players type less, reducing the data the feature depends on (self-defeating feedback loop)
- Players may feel the bot violates their privacy expectations
- Game atmosphere shifts from "paranoid fun" to "uncomfortable monitoring"
- Swedish gaming communities may react negatively (Swedish culture has strong privacy norms)

**Prevention:**
- NEVER quote player messages verbatim in AI output. Guzman should reference behavior patterns, not specific messages. "Jag har markt att du blivit tystare, bre..." NOT "Du skrev 'jag vet inte vem som golade' for 10 minuter sen..."
- NEVER reference timestamps or message counts in player-facing output. The AI should speak in vague behavioral terms.
- Frame it in-game: Guzman is a paranoid crime boss who "has eyes everywhere" -- his awareness is a character trait, not a technical feature. "Mina kontakter sager att du pratat mycket med Ahmed..." feels in-character. "Jag har analyserat dina 7 meddelanden och beraknat att din ton ar 63% aggressiv" feels robotic.
- Add explicit prompt instructions to the AI: "Reference player behavior in vague, character-appropriate terms. NEVER quote exact messages. NEVER mention message counts or timestamps. Speak from Guzman's 'gut feeling', not from data analysis."
- Consider a brief in-game disclosure at game start: "Guzman ser allt som skrivs i gruppen..." -- this sets expectations and makes it part of the game fiction.

**Warning signs:** Players asking "can the bot read our messages?"; players switching to voice notes or external chats for game discussion; reduced message frequency in groups with the feature active.

**Detection:** Compare average messages-per-player-per-day before and after feature launch. A significant drop signals the chilling effect.

**Phase to address:** Second phase (AI integration). Must be baked into prompt engineering from the start, not patched after players complain.

---

## Moderate Pitfalls

### Pitfall 5: Tone Analysis Unreliability in Swedish Slang Context

**What goes wrong:** The tone analysis classifies a player's message "wallah bror du ar sketchy" as "aggressive/negative" when it is actually playful banter in the game's intended register. Or it classifies "jag vet inte bre, kanner mig osaker" as "neutral" when the player is expressing genuine suspicion. The AI then makes whispers and accusations based on incorrect tone assessments, producing nonsensical Guzman behavior.

**Why it happens:** Swedish sentiment analysis tools are limited. The game's register -- orten-svenska with heavy slang -- is an extremely niche dialect that sits outside the training data for most NLP models, including GPT-4o-mini. Research confirms that "sarcasm, coded language, cultural slang, and subtextual insults frequently evade model detection." Swedish slang compounds this: "shuno" (listen), "para" (money/stress), "beckna" (sell/deal) have connotations that standard Swedish models miss entirely.

**Consequences:**
- False aggressive: Guzman accuses a player of being suspicious based on normal banter, breaking immersion
- False quiet: A highly active player is classified as "quiet" because their messages are short/slangy
- Tone-based whisper targeting becomes random rather than meaningful, undermining the feature's value
- Players who use more slang (the intended playstyle) get worse AI responses than players who write "properly"

**Prevention:**
- Do NOT use a separate sentiment analysis model/library. Use the LLM itself (gpt-4.1-nano is cheap enough) with game-context-aware prompts. Include the game's slang dictionary in the analysis prompt.
- Classify into game-relevant categories, NOT generic sentiment: "accusatory" / "defensive" / "quiet" / "alliance-building" / "neutral" / "chaotic". These map to game behaviors, not emotional states.
- Use behavioral signals alongside tone: message frequency, response patterns (who replies to whom), question-asking vs statement-making. These are language-agnostic and harder to misclassify.
- Implement a confidence threshold: if the LLM's tone classification is uncertain, default to "neutral" rather than guessing. Guzman acting on uncertain data is worse than Guzman not reacting.
- Include 3-5 few-shot examples of game-context Swedish slang in the analysis prompt, showing correct classifications.

**Warning signs:** Guzman makes accusations that players find random or unfair; players saying "why did Guzman say that? I wasn't even doing anything"; tone classifications clustering into one category (everything is "neutral" or everything is "aggressive").

**Detection:** Log tone classifications alongside the original messages. Review a sample of 20 classifications per game. If accuracy (human-judged) is below 60%, the prompt needs rework.

**Phase to address:** Second phase (AI integration). Prompt engineering for tone analysis is the hardest part of this milestone.

---

### Pitfall 6: Database Growth from Storing Every Group Message

**What goes wrong:** With 10 players each sending 20-50 messages per day over a 5-day game, that is 1,000-2,500 messages per game. Each message row stores: game_id, player_id, message_text, timestamp, tone classification, message metadata. At ~500 bytes per row, a single game generates ~0.5-1.25 MB. After 100 games, the table has 100K-250K rows and 50-125 MB. Queries slow down. The Supabase free tier's 500 MB database fills up.

**Why it happens:** The natural impulse is to store every message "just in case." But unlike structured game events (votes, nominations), player messages are high-volume, low-structure data. The project requirement says "last ~10 per player, stored in DB" -- but if the cleanup is deferred or buggy, messages accumulate.

**Consequences:**
- Database bloat on Supabase free tier (500 MB limit)
- Queries for "get latest 10 messages per player" become slow without proper indexing
- Old game message data serves no purpose but consumes storage
- If the table lacks proper indexes on (game_id, player_id, created_at), the AI context-building query becomes a full table scan

**Prevention:**
- Enforce the "last ~10 per player" limit at write time, not as a deferred cleanup. Use a Supabase database function or trigger: on INSERT, DELETE the oldest message for that (game_id, player_id) if count > 10.
- Add a composite index on `(game_id, player_id, created_at DESC)` from day one.
- Clean up all messages for a game when the game finishes (`state = 'finished'`). The behavioral data has no value after the game ends unless you are building analytics (out of scope for v1.1).
- Consider an in-memory sliding window as primary storage, with DB as backup. Store the last 10 messages per player in a `Map<string, Message[]>` keyed by game_player_id. Only write to DB periodically (every 5 minutes) or on bot shutdown. This reduces write load by 90%.
- If using DB as primary storage, batch INSERTs where possible (collect messages, flush every 30 seconds).

**Warning signs:** Database size growing faster than expected; query latency on the player_messages table exceeding 100ms; Supabase dashboard showing table as largest by size.

**Detection:** Monitor `SELECT count(*) FROM player_messages` and `SELECT pg_total_relation_size('player_messages')` weekly.

**Phase to address:** First phase (schema design). The cleanup mechanism must be designed alongside the table, not after.

---

### Pitfall 7: Capturing Bot's Own Messages as Player Messages

**What goes wrong:** The message tracking middleware fires for ALL group messages, including those sent by the bot itself (Guzman's narratives, gap-fills, whisper relays). These get stored as "player messages" and fed into the AI context. Guzman starts referencing his own previous messages as if a player said them. Or the message count for gap-fill detection becomes inaccurate because the bot's own messages count toward "group activity."

**Why it happens:** The existing `trackGroupMessage` middleware at `bot.ts:37-42` does NOT filter out bot messages. It only checks chat type. Currently this is not a problem because it only counts messages (for gap-fill quiet detection), and the bot's own messages making the group "not quiet" is actually correct behavior. But when storing message text and attributing it to players, bot messages must be excluded.

**Consequences:**
- AI context pollution: Guzman's own messages appear as "player behavior," creating a feedback loop
- Message frequency stats are inflated (bot sends 10+ messages per day to a game group)
- The behavioral summary includes Guzman's narrative text, which is nonsensical as "player behavior"
- Potential for the AI to reference its own previous output as player quotes

**Prevention:**
- Filter out the bot's own messages in the tracking middleware: `if (ctx.from?.id === ctx.me.id) return next()` or check `ctx.from?.is_bot`.
- Also filter out messages from other bots in the group (some groups have multiple bots).
- Store the bot's user ID at startup and check against it. grammY provides `bot.botInfo.id` after initialization.
- The existing middleware at `bot.ts:37` can be expanded: add `if (ctx.from?.is_bot) { await next(); return; }` before the tracking logic.

**Warning signs:** Behavioral summaries containing narrative-style text that sounds like Guzman; message counts per player showing impossibly high numbers; AI prompts containing repeated text from previous Guzman outputs.

**Detection:** Add a `is_bot` check assertion in the message storage path. Log any attempt to store a bot message.

**Phase to address:** First phase (message capture). Simple filter, but critical to get right from the start.

---

### Pitfall 8: Summary Staleness -- Behavioral Data Becomes Outdated Between Analysis Runs

**What goes wrong:** Player behavioral summaries are generated at fixed intervals (e.g., every 2 hours by the scheduler). A player who was quiet all morning sends 15 excited messages in 30 minutes. But the next whisper is generated using the old "quiet" summary. Guzman comments on the player being silent when they were just the most active person in the group. The mismatch feels broken.

**Why it happens:** There is a tension between real-time analysis (expensive: one AI call per message) and batch analysis (cheap but stale). If summaries are updated too infrequently, the AI acts on outdated behavioral data. If updated too frequently, the cost and latency budget is exceeded.

**Consequences:**
- Guzman's behavior contradicts what players just witnessed ("why did Guzman say Ahmed is quiet? He just sent 10 messages!")
- Players learn to "game" the system: be quiet during analysis windows, then speak freely
- Whisper targeting based on "quiet players" misses the mark

**Prevention:**
- Use a hybrid approach: (1) real-time numeric signals (message count, recency of last message) computed on-the-fly from the stored messages, (2) periodic AI-generated tone summaries updated every 2-3 hours.
- When building AI context for a whisper or narrative, compute fresh frequency stats from the last 10 messages (cheap DB query), and combine with the latest AI tone summary.
- Trigger a summary refresh when a player's message count changes significantly (e.g., >5 new messages since last summary). This can be done with a simple counter check, no AI call needed for the trigger.
- For gap-fill commentary, the existing `trackGroupMessage` counter (in-memory, real-time) already provides freshness. Extend this pattern: maintain in-memory counters per player, not just per group.

**Warning signs:** Guzman making comments that contradict recent visible behavior; players expressing confusion about Guzman's awareness.

**Detection:** Compare the behavioral summary timestamp with the most recent message timestamp for each player. If the delta exceeds 3 hours during game hours, flag as stale.

**Phase to address:** Second phase (AI integration). The refresh strategy needs to balance cost vs freshness.

---

## Minor Pitfalls

### Pitfall 9: Non-Player Messages in the Tracking Table

**What goes wrong:** A group with an active game also has members who are NOT playing. Their messages get captured and potentially attributed to game analysis. Guzman references behavior from someone not even in the game. Or: a player leaves the game mid-match but continues chatting in the group; their messages are still tracked.

**Prevention:**
- At message capture time, check if the sender is an active game player in this group. This requires a DB lookup (getPlayerByTelegramId + getPlayerActiveGame). To avoid a DB call per message, maintain an in-memory set of active player telegram_user_ids per group, refreshed at game start and whenever a game state changes.
- When a game ends, clear the active player set for that group.

**Warning signs:** Behavioral summaries mentioning people not in the game; AI prompts containing messages from non-players.

**Phase to address:** First phase (message capture). Build the player filter into the middleware.

---

### Pitfall 10: Message Edits and Deletions Not Handled

**What goes wrong:** A player writes something incriminating, then edits or deletes the message. The bot still has the original text stored. If Guzman references the original text (even vaguely), the player knows the bot captured it before their edit. This feels invasive and raises trust concerns.

**Prevention:**
- For v1.1, the simplest approach is to ignore edits and deletions. Store the original message and use it. This is acceptable because: (a) the AI should never quote messages verbatim anyway (Pitfall 4), (b) in a social deduction game, saying something and then "unsaying" it is itself suspicious behavior, (c) handling edits adds complexity without clear value.
- If handling edits becomes necessary later: listen for `edited_message` updates in grammY and update the stored text. Listen for `message` with `delete_chat_message` service messages (only available in supergroups with proper permissions).

**Phase to address:** Defer to v1.2 unless playtesting reveals it as a problem.

---

### Pitfall 11: Behavioral Awareness Creates Information Leakage About Roles

**What goes wrong:** Guzman is supposed to be role-blind in his public commentary. But the behavioral analysis inadvertently reveals role-correlated patterns. Example: Golare tend to be quieter during execution phases (they already know the outcome). If Guzman says "Jag markte att Lisa var tyst under stoten..." and Lisa is a Golare, this is effectively a role reveal through behavioral analysis.

**Prevention:**
- AI prompts for public-facing messages (group commentary, gap-fill) must NEVER include role information. This is already the v1 design -- extend it: the behavioral summary fed to public-facing prompts must also exclude any role-correlated metadata.
- The behavioral analysis itself should not correlate behavior with roles. Store and analyze behavior by player, NOT by role.
- When generating public accusations, the AI must be instructed: "Base accusations on observable behavior patterns that ANY player could exhibit, not on patterns that correlate with a specific role."
- Test: generate 10 public commentaries. If a human observer can guess roles better-than-chance from Guzman's comments alone, the prompts need adjustment.

**Warning signs:** Players accurately guessing roles based on Guzman's behavioral commentary; Golare being disproportionately called out.

**Phase to address:** Second phase (AI prompt engineering). Critical prompt constraint.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Message Storage (Schema)** | Storing raw messages without cleanup mechanism | Design DELETE trigger/function alongside CREATE TABLE. Enforce 10-message-per-player cap at DB level. |
| **Message Storage (Schema)** | Missing composite index on (game_id, player_id, created_at) | Add index in the same migration as the table creation. |
| **Message Capture (Middleware)** | Capturing bot messages, non-player messages, or DM messages | Filter: `is_bot === false`, `chat.type === group/supergroup`, sender is active game player. |
| **Message Capture (Middleware)** | Breaking the engagement handler's freeform text flow | Register tracking middleware BEFORE engagement handler. Always call `next()`. Only process group messages. |
| **Message Capture (Middleware)** | Privacy mode blocking message visibility | Check bot admin status at game creation. Log message counts for anomaly detection. |
| **Behavioral Analysis (AI)** | Token budget blowout from raw messages in prompts | Pre-compress messages into per-player summaries (<50 tokens each). Never pass raw messages to narrative/whisper prompts. |
| **Behavioral Analysis (AI)** | Tone misclassification in Swedish slang context | Use game-context-aware prompts with slang examples. Classify into game-relevant categories. Default to "neutral" on low confidence. |
| **Behavioral Analysis (AI)** | Summary staleness between scheduled analysis runs | Hybrid approach: real-time frequency counters + periodic AI tone summaries. Fresh stats at whisper generation time. |
| **AI Integration (Prompts)** | Quoting player messages verbatim (creepiness) | Explicit prompt instructions: NEVER quote messages. Reference "gut feeling" and vague patterns only. |
| **AI Integration (Prompts)** | Role information leaking through behavioral patterns | Public-facing prompts must never include role data. Behavioral summaries are role-agnostic. |
| **AI Integration (Prompts)** | Guzman's behavioral commentary being generic/useless | Include specific behavioral data (active/quiet, accusatory/defensive) in prompts. Provide few-shot examples of good behavioral commentary. |

---

## Integration Risk Matrix

| Existing Component | Integration Risk | Specific Concern | Mitigation |
|---|---|---|---|
| `bot.ts` middleware chain (line 37-42) | MEDIUM | New tracking middleware must extend existing `trackGroupMessage` without breaking handler order | Expand existing middleware block; do not add a new Composer for tracking |
| `engagement.ts` freeform handler (line 571-663) | HIGH | DM text handler must not be affected by group message tracking | Strict `group/supergroup` filter on tracking middleware; test whisper flow after integration |
| `GuzmanContext.playerNotes` (types.ts line 150) | LOW | Field exists but is empty. Perfect slot for behavioral summaries. | Use as-is; type already supports `Record<string, string>` |
| `ai-prompts.ts` whisper prompt (line 144-176) | MEDIUM | Already references `playerNote` variable but with fallback "Ingen historik" | Replace fallback with behavioral summary. Prompt needs expansion for behavioral context. |
| `whisper-handler.ts` gap-fill (line 308-354) | MEDIUM | Gap-fill already uses `gatherRoundEvents()` for context. Behavioral data should augment, not replace. | Add behavioral summary as additional context in `generateGapFillComment` call |
| `ai-client.ts` MODEL_MAP | LOW | May need a new tier for analysis calls, or reuse `commentary` tier for cheap analysis | Use `commentary` tier (gpt-4.1-nano at $0.02/1M) for behavioral analysis |
| `message-queue.ts` rate limits | LOW | More AI calls = more outbound messages. But whisper/narrative frequency is scheduler-driven, not message-count-driven. | No change needed unless adding new message types (e.g., proactive Guzman callouts) |
| `scheduler.ts` cron jobs | LOW | May need a new job for periodic behavioral analysis | Add one cron (e.g., every 2 hours during game hours) for summary refresh |
| `db/client.ts` query patterns | MEDIUM | New queries for message storage and retrieval. Must match existing patterns (type assertions on `.select('*')`) | Follow established Supabase v2.95 patterns from existing code |

---

## Cost Projection

| Scenario | Current (v1) | With Raw Messages | With Compressed Summaries |
|----------|---|---|---|
| Input tokens/game (5 rounds) | ~75K-150K | ~240K-650K | ~100K-200K |
| AI calls/game | 30-50 | 30-50 + 5-10 analysis | 30-50 + 5-10 analysis |
| Cost/game (gpt-4o-mini + nano) | ~$0.01-0.02 | ~$0.05-0.10 | ~$0.02-0.04 |
| Analysis call cost (nano only) | N/A | N/A | ~$0.001/call |
| **Total monthly (50 games)** | **$0.50-1.00** | **$2.50-5.00** | **$1.00-2.00** |

The compressed summary approach keeps costs at ~2x baseline, versus ~5x for raw message injection. This is the recommended approach.

---

## Sources

### Telegram Bot API (HIGH confidence)
- [Telegram Bot Features - Privacy Mode](https://core.telegram.org/bots/features) -- Verified: bots with privacy mode enabled only see commands/replies unless made admin
- [Telegram Bots FAQ](https://core.telegram.org/bots/faq) -- Bot admin status grants all-message access
- [grammY Middleware Documentation](https://grammy.dev/guide/middleware) -- Middleware registration order determines processing priority

### OpenAI Pricing (HIGH confidence)
- [OpenAI API Pricing](https://platform.openai.com/docs/pricing) -- gpt-4o-mini: $0.15/1M input, $0.60/1M output; gpt-4.1-nano: $0.02/1M input, $0.15/1M output
- [OpenAI Context Engineering](https://cookbook.openai.com/examples/agents_sdk/session_memory) -- Context summarization as alternative to full history
- [GPT-4.1 Nano Pricing Guide](https://gptbreeze.io/blog/gpt-41-nano-pricing-guide/) -- Nano as cost-effective analysis tier

### Tone Analysis (MEDIUM confidence)
- [KBLab Swedish Sentiment Classifier](https://kb-labb.github.io/posts/2023-06-16-a-robust-multi-label-sentiment-classifier-for-swedish/) -- Swedish NLP tools exist but not trained on slang
- [Toxic Behavior Detection in Gaming Chats](https://deepnote.com/explore/toxic-behavior-detection-in-gaming-chats) -- Gaming context reduces false positives by 43%
- [LLM Tone Bias Research](https://arxiv.org/html/2512.19950v1) -- LLMs carry tone biases, particularly in specialized contexts

### Codebase (HIGH confidence -- direct source review)
- `bot.ts` lines 37-42: existing group message tracking middleware
- `engagement.ts` lines 571-663: freeform text handler (whisper capture) -- MUST NOT be disrupted
- `ai-prompts.ts` line 150: `playerNotes` already used in whisper prompt, currently empty
- `db/types.ts` line 150: `GuzmanContext.playerNotes: Record<string, string>` -- ready for behavioral data
- `whisper-handler.ts` lines 50-96: existing gap-fill activity tracking pattern (in-memory counter + threshold)

---

*Pitfalls research for: v1.1 AI Behavioral Awareness milestone*
*Researched: 2026-02-11*
