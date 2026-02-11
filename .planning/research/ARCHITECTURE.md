# Architecture: Player Message Tracking & AI Behavioral Awareness

**Domain:** Player behavior tracking integration for async Telegram social deduction game
**Researched:** 2026-02-11
**Confidence:** HIGH (direct codebase analysis of existing v1 architecture + established grammY/Supabase patterns)

## Executive Summary

This architecture adds three new capabilities to the existing Golare system: (1) capturing player group chat messages via grammY middleware, (2) storing and summarizing those messages per player per game in Supabase, and (3) feeding behavioral context into every AI generation call so Guzman can reference actual player behavior. The design prioritizes minimal disruption to the existing v1 architecture -- the existing `GuzmanContext.playerNotes` field (currently initialized empty, never populated) becomes the primary integration seam.

---

## Recommended Architecture

### High-Level Data Flow

```
Group chat message
  |
  v
[grammY middleware in bot.ts] -- captures text, sender, timestamp (fire-and-forget)
  |
  v
[Supabase: player_messages table] -- persists last ~10 per player per game
  |
  v
[Behavior Analyzer (src/lib/behavior.ts)] -- heuristic frequency/tone/silence analysis
  |
  v
[GuzmanContext.playerNotes] -- serialized behavioral summary per player
  |
  v
[AI Generation Functions] -- whispers, narratives, gap-fill, accusations
```

### Component Boundaries

| Component | Responsibility | Communicates With | New/Modified |
|-----------|---------------|-------------------|--------------|
| **Message Capture Middleware** | Intercept group text messages, extract player identity, store to DB | bot.ts (middleware registration), db/client.ts | **MODIFIED** (expand existing middleware in bot.ts line 37-42) |
| **player_messages table** | Persist raw message text per player per game with timestamps | Supabase, db/client.ts | **NEW** (DB migration + types + CRUD) |
| **Behavior Analyzer** (`src/lib/behavior.ts`) | Compute per-player stats: message count, avg length, time-since-last, tone | player_messages table | **NEW** (module) |
| **Context Builder** | Assemble behavioral summaries into GuzmanContext.playerNotes before AI calls | behavior.ts, ai-guzman.ts | **NEW** (function, lives in behavior.ts) |
| **AI Prompts** | Enhanced prompts that reference player behavioral data | ai-prompts.ts | **MODIFIED** (add behavioral context sections) |
| **Accusation Generator** | New AI generation function for Guzman group chat call-outs | ai-guzman.ts, whisper-handler.ts | **NEW** (function + gap-fill integration) |

---

## Integration Point 1: Message Capture (grammY Middleware)

### Current State

bot.ts line 37-42 already has a group message middleware:

```typescript
// 4. Group activity tracking middleware (for gap-fill -- must be before other handlers)
bot.on("message:text", async (ctx, next) => {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    trackGroupMessage(ctx.chat.id);
  }
  await next();
});
```

This middleware currently calls `trackGroupMessage(chatId)` in whisper-handler.ts which only increments an in-memory counter for gap-fill detection. It does NOT capture message content or player identity.

### Recommended Change

Expand this middleware to also persist the message. The middleware must:

1. Resolve the sender's `game_player_id` for the active game in this group
2. Store the message text (truncated to 500 chars) to `player_messages`
3. NOT block the middleware chain -- use fire-and-forget pattern

```typescript
// MODIFIED middleware in bot.ts
bot.on("message:text", async (ctx, next) => {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    trackGroupMessage(ctx.chat.id);
    // Fire-and-forget: capture message for behavioral tracking
    capturePlayerMessage(ctx).catch((err) =>
      console.warn("[middleware] Message capture failed:", err)
    );
  }
  await next();
});
```

### Critical Design Decisions

**Fire-and-forget, not blocking.** Message capture must never slow down the bot or block other handlers. The `.catch()` pattern ensures failures are logged but don't interrupt the middleware chain. This follows the established pattern used for event whispers in whisper-handler.ts (`triggerEventWhisper().catch(...)`).

**Resolve player identity with in-memory cache.** The middleware receives `ctx.from.id` (telegram_user_id) and `ctx.chat.id` (group_chat_id). To get the `game_player_id`, it needs:
1. Look up the active game for this group (`getActiveGame(group_chat_id)`)
2. Look up the game_player by telegram_user_id in that game

This is 2 DB queries per message. To keep it cheap:
- Cache the `group_chat_id -> game_id` mapping in memory (invalidate on game state change)
- If no active game, skip entirely (no DB hit)
- If player not found in game (spectator/non-player), skip

**Truncate messages.** Store max 500 characters per message. Players in group chats rarely write longer.

**Debounce storage.** Don't store every single message if a player is spamming. Store at most 1 message per player per 30 seconds. The latest message within the window overwrites.

### Middleware Placement

The middleware is already registered at position 4 in bot.ts (before all Composer handlers). This is correct -- it stays there. The only change is adding `capturePlayerMessage()` alongside the existing `trackGroupMessage()`.

### Where capturePlayerMessage Lives

Export from whisper-handler.ts alongside `trackGroupMessage`, since both are middleware-called functions for group message processing. Or create a new `src/lib/message-capture.ts` module if the logic is complex enough to warrant separation. Recommendation: keep in whisper-handler.ts for now (it already owns group message tracking), extract later if it grows.

---

## Integration Point 2: Database Schema

### New Table: player_messages

```sql
CREATE TABLE player_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Primary query: get recent messages for a player in a game
CREATE INDEX idx_player_messages_player_game
  ON player_messages (game_id, game_player_id, sent_at DESC);

-- Cleanup: delete old messages for finished games
CREATE INDEX idx_player_messages_game
  ON player_messages (game_id);
```

### Why a New Table (Not Extending Existing)

- `anonymous_whispers` -- different semantic (player-to-Guzman relay, not raw group chat)
- `whispers` -- Guzman-to-player DMs, not player group messages
- `games.guzman_context` JSONB -- too large if we embed raw messages; better to query on demand
- A dedicated table allows efficient queries (last N per player), automatic cleanup, and clear data separation

### Row Budget

With 10 players, ~10 messages each per round, 5 rounds over 5 days = ~500 rows per game maximum. Trivial for PostgreSQL. The `sent_at DESC` index makes "get last 10 for player" queries fast.

### Cleanup Strategy

When game state transitions to `finished` (in `performFinalReveal()` in game-loop.ts line 513: `await updateGame(game.id, { state: "finished" })`), schedule a cleanup that deletes all `player_messages` rows for that game_id. Alternatively, rely on CASCADE delete if games are ever pruned. For v1.1, CASCADE is sufficient.

### TypeScript Types

Add to `src/db/types.ts`:

```typescript
/** Full player_messages row */
export type PlayerMessage = {
  id: string;
  game_id: string;
  game_player_id: string;
  message_text: string;
  sent_at: string;
};

/** Insert type for player_messages */
export type PlayerMessageInsert = Omit<PlayerMessage, "id" | "sent_at">;
```

Extend the `Database` type with:

```typescript
player_messages: {
  Row: PlayerMessage;
  Insert: PlayerMessageInsert;
  Update: Partial<PlayerMessageInsert>;
  Relationships: [
    {
      foreignKeyName: "player_messages_game_id_fkey";
      columns: ["game_id"];
      referencedRelation: "games";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "player_messages_game_player_id_fkey";
      columns: ["game_player_id"];
      referencedRelation: "game_players";
      referencedColumns: ["id"];
    },
  ];
};
```

### CRUD Functions in db/client.ts

```typescript
/** Store a captured group message (fire-and-forget from middleware). */
export async function createPlayerMessage(msg: PlayerMessageInsert): Promise<void>

/** Get last N messages for a player in a game, newest first. */
export async function getRecentPlayerMessages(
  gameId: string,
  gamePlayerId: string,
  limit?: number, // default 10
): Promise<PlayerMessage[]>

/** Get recent messages for ALL players in a game (for batch behavioral analysis). */
export async function getAllRecentMessages(
  gameId: string,
  limitPerPlayer?: number, // default 10 -- app-level grouping
): Promise<PlayerMessage[]>

/** Delete all messages for a finished game (cleanup). */
export async function deletePlayerMessages(gameId: string): Promise<void>
```

---

## Integration Point 3: Behavior Analyzer

### New Module: src/lib/behavior.ts

This module takes raw messages and produces structured behavioral summaries that fit into `GuzmanContext.playerNotes`.

### Behavioral Metrics (Heuristic-First, Not AI)

Use heuristics for basic behavioral analysis. AI calls are expensive and slow -- heuristics are free and instant.

| Metric | How to Compute | What It Means |
|--------|---------------|---------------|
| **Message count** (this round) | COUNT messages since round start | Activity level |
| **Average message length** | AVG(char length) | Verbose vs terse |
| **Time since last message** | NOW() - MAX(sent_at) | Silence detection |
| **Message frequency** | count / hours_since_round_start | Engagement rate |
| **Exclamation/question ratio** | Regex count of `!` and `?` | Emotional intensity |
| **Mentions of other players** | Regex for @username patterns | Social targeting |
| **Accusation keywords** | Swedish keyword list: "golare", "misstanker", "litar inte", "shady", "sus", "sketchy" | Accusatory behavior |
| **Defense keywords** | Swedish keyword list: "litar pa", "oskyldiga", "alltid lojal", "jag lovar" | Defensive behavior |

### Tone Classification (Simple Heuristic)

```typescript
type PlayerTone = "aggressive" | "defensive" | "quiet" | "neutral" | "chaotic";

function classifyTone(messages: PlayerMessage[]): PlayerTone {
  if (messages.length === 0) return "quiet";
  // Keyword scoring against Swedish accusation/defense/chaos word lists
  // Return dominant tone
}
```

**Why not AI for tone?** gpt-4.1-nano could do this, but at ~10 players per prompt call, it adds latency and cost for minimal benefit. The heuristic classification is sufficient -- Guzman's AI generation will interpret the behavioral summary creatively.

### Output Format: Player Behavioral Summary

The behavior analyzer produces a plain-text summary per player that gets stored in `GuzmanContext.playerNotes[playerName]`:

```
"Aktiv (8 msg). Aggressiv ton -- anklagar @Sara ofta. Senaste: 'Jag litar inte pa Sara, hon var konstig.' Tyst senaste 2h."
```

Target: **max 150 chars per player** to keep total token budget manageable.

### When to Compute Behavioral Summaries

Two strategies:

1. **On-demand** (before each AI generation call): Query recent messages, compute summary, inject into prompt. Freshest data, but adds DB queries to every AI call.

2. **Periodic** (every 2 hours via scheduler): Batch-compute all summaries, persist into `GuzmanContext.playerNotes`. Reduces per-call overhead but data may be slightly stale.

**Recommendation:** On-demand for whispers and accusations (need freshness), periodic for mission narratives and gap-fill (staleness acceptable).

---

## Integration Point 4: Feeding Behavior into AI Context Window

### Current AI Context Flow

All AI generation functions in ai-guzman.ts follow this pattern:

```
buildGuzmanSystemPrompt() -> system message (~2000 chars / ~500 tokens)
buildXxxPrompt(gameContext, ...) -> user message (500-1500 chars)
```

The `gameContext: GuzmanContext` (defined in db/types.ts line 142-152) contains:
- `storyArc`: string
- `roundSummaries`: array (last 3 detailed, older compressed)
- `playerNotes`: Record<string, string> (**EMPTY -- never populated**)
- `mood`: string

### The Existing Integration Seam

In ai-prompts.ts line 150, the whisper prompt already reads playerNotes:

```typescript
const playerNote = gameContext.playerNotes[targetPlayerName] || "Ingen historik";
```

This means **whispers already have the integration seam built in**. Once we populate `playerNotes` with behavioral summaries, whisper prompts automatically include player behavior. No prompt change needed for basic whisper integration.

### Token Budget Analysis

Current token usage per AI call (estimated):

| Component | Tokens | Source |
|-----------|--------|--------|
| System prompt (Guzman persona) | ~500 | Static, unchanged |
| Round summaries (3 detailed + compressed) | ~300 | Existing GuzmanContext |
| Player behavioral summaries (10 players x ~40 tokens) | **~400** | **NEW** |
| Message quotes (2 quotes x ~50 tokens) | **~100** | **NEW** (whispers only) |
| Prompt instruction | ~200 | Existing + slight expansion |
| **Total input** | **~1500** | Well within 128K context window |
| Max output tokens | 200-800 | Unchanged per function |

At gpt-4o-mini pricing ($0.15/1M input tokens), adding ~500 tokens per call costs ~$0.000075/call, or ~$0.003 per game-day. Negligible.

### Enhanced Prompt Structure

For prompts that don't currently reference playerNotes (mission narratives, gap-fill, accusations), add a `SPELARBETEENDE` section:

```
SPELARBETEENDE:
- @Ahmed: Aktiv (8 msg), aggressiv ton, anklagar @Sara ofta
- @Sara: Tyst (1 msg), defensiv ton
- @Kalle: Normal (4 msg), neutral ton
- @Lisa: Mycket aktiv (12 msg), kaotisk ton
```

This goes into the user prompt, NOT the system prompt (system prompt is static persona).

### Modified Prompt Builders (ai-prompts.ts)

| Function | Current State | Change |
|----------|--------------|--------|
| `buildWhisperPrompt` | Already reads `playerNotes[target]` | Add ALL players' behavioral overview + 1-2 message quotes from target |
| `buildGapFillPrompt` | No player behavior | Add `SPELARBETEENDE` section |
| `buildMissionPrompt` | No player behavior | Add `GRUPPDYNAMIK` (group mood summary) section |
| `buildSurveillanceCluePrompt` | No player behavior | Add target's behavioral summary |
| **NEW: `buildAccusationPrompt`** | N/A | Full behavioral context for public call-out |

### Player Message Quoting in Whisper Prompts

The v1.1 requirement: "Whispers reference actual player messages (twisted, out of context)."

Include 1-2 actual quotes in the whisper prompt:

```
SENASTE MEDDELANDEN FRAN ${targetPlayerName}:
- "${messageText1}" (for 2 timmar sedan)
- "${messageText2}" (for 4 timmar sedan)

Anvand garna ett av dessa meddelanden, vrid det ur kontext, och bygg misstanke kring det.
```

This is the highest-impact feature -- Guzman quoting actual things players said, twisted into accusations. Deeply unsettling in a paranoia game.

---

## Integration Point 5: Accusation System (New Feature)

### What It Does

Guzman occasionally calls out players in group chat based on their behavior:
- "Jag ser att @Sara inte sagt ett ord pa 3 timmar. Vad gommer hon, bre?"
- "@Ahmed, du har anklagat alla utom @Kalle. Intressant..."
- "Nagon som skriver sa mycket som @Lisa brukar ha nat att gomma, shuno..."

### Architecture: Piggyback on Gap-Fill

The gap-fill handler in whisper-handler.ts already runs at 14:00 and 20:00 (`onGapFill` in scheduler.ts line 61). When the group is quiet, instead of always generating a generic Guzman comment, sometimes generate a behavioral accusation.

Decision logic in enhanced `runGapFill()`:

```
1. If group is quiet AND a player has behavioral anomaly -> accusation (70%)
2. If group is quiet AND no anomalies -> generic gap-fill comment (100%)
3. If group is active -> skip (existing behavior, unchanged)
```

This avoids adding a new cron job. The gap-fill infrastructure already has all the plumbing (game lookup, player names, queue access).

### Behavioral Anomaly Detection

An anomaly is any of:
- **Suspicious silence**: Player was active (5+ messages earlier), then silent for 3+ hours during active hours
- **Aggression spike**: Player's recent messages are 2x more accusatory than their average
- **Behavior change**: Player shifted from neutral/quiet to aggressive (or vice versa) within a round

### Accusation Frequency Control

Guzman should NOT spam accusations. Rules:
- Max 1 accusation per game per 4-hour window
- Never accuse the same player twice in a row
- Track last accusation timestamp and target in-memory (acceptable trade-off, same pattern as gap-fill counter)

---

## Integration Point 6: Existing System Modifications (Detailed)

### whisper-handler.ts Modifications

**`runGapFill()` enhancement:**

Currently generates a generic comment. Enhance to:
1. Before generating, fetch player behavioral summaries via behavior.ts
2. Check for behavioral anomalies
3. If anomalies detected, call `generateAccusation()` instead of `generateGapFillComment()`
4. If no anomalies, call `generateGapFillComment()` with behavioral context added

**`sendWhisper()` enhancement:**

Currently passes `roundEvents` and `otherNames` to `generateWhisperMessage()`. Enhance to:
1. Fetch target player's recent messages (2-3 quotes)
2. Populate `GuzmanContext.playerNotes` with behavioral summaries for all players
3. Pass enhanced context to the prompt builder

**`capturePlayerMessage()` addition:**

New exported function (or in a new module) called from the middleware.

### ai-guzman.ts Modifications

**New function: `generateAccusation()`**

```typescript
export async function generateAccusation(
  gameContext: GuzmanContext,
  targetPlayerName: string,
  behavioralAnomaly: string,
  playerNames: string[],
): Promise<string | null>
```

Similar to `generateGapFillComment()` but with behavioral data and a different prompt (public call-out). Returns null on failure (accusations are optional, same as gap-fill). Uses `MODEL_MAP.commentary` (gpt-4.1-nano) for cost efficiency.

**Enhanced whisper context population:**

Before calling `generateWhisperMessage()`, the caller in whisper-handler.ts populates `guzmanCtx.playerNotes` via behavior.ts. The existing whisper prompt in ai-prompts.ts already reads `playerNotes[targetPlayerName]`, so no prompt builder change is needed for basic integration.

### ai-prompts.ts Modifications

**New prompt builder:** `buildAccusationPrompt()` for public group accusations.

**Modified builders:**
- `buildGapFillPrompt()` -- add `SPELARBETEENDE` section parameter
- `buildMissionPrompt()` -- add `GRUPPDYNAMIK` parameter (group mood based on aggregate behavior)
- `buildWhisperPrompt()` -- add message quotes section

---

## Patterns to Follow

### Pattern 1: Fire-and-Forget for Non-Critical Writes

**What:** Message capture in middleware uses `.catch()` pattern, never `await`.
**When:** Any write operation that should not block the main flow.
**Why:** Established in v1 for event whispers in game-loop.ts line 631: `triggerEventWhisper(game.id, "mission_failed").catch(...)`.

### Pattern 2: Template Fallback on All AI Paths

**What:** Every AI generation function returns a fallback template if OpenAI is unavailable.
**When:** All new AI functions (accusations, enhanced whispers).
**Why:** Core v1 principle -- game must never block on AI failure. For accusations specifically, return `null` (skip) rather than a template, because a generic accusation without behavioral data would feel wrong.

### Pattern 3: Behavioral Data as Plain Text in playerNotes

**What:** Store behavioral summaries as human-readable strings in `playerNotes`, not structured JSON.
**When:** Populating GuzmanContext for AI consumption.
**Why:** The AI model receives this as prompt text. Plain text is more natural for interpretation. The existing `playerNotes` field is already `Record<string, string>`.

### Pattern 4: In-Memory Cache with DB Persistence

**What:** Cache game_id lookups in memory for middleware performance, persist raw messages to DB.
**When:** Middleware needs fast game resolution; behavioral data needs to survive restarts.
**Why:** Same pattern as the existing `groupActivity` Map in whisper-handler.ts (in-memory for performance, DB for durability).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: AI for Every Behavioral Analysis

**What:** Calling OpenAI to classify tone/sentiment for each player on every prompt call.
**Why bad:** 10 extra API calls per AI generation. At 2-3 AI generations per game event, 20-30 extra calls/day/game.
**Instead:** Heuristic tone classification (keyword matching). Let Guzman's AI generation interpret the summary creatively.

### Anti-Pattern 2: Storing Full Message History

**What:** Keeping all messages for the entire 5-day game without pruning.
**Why bad:** Could reach 500+ messages. Feeding all to AI blows token budgets and adds noise.
**Instead:** Store last ~10 messages per player. The behavioral summary captures historical patterns.

### Anti-Pattern 3: Synchronous DB Queries in Middleware

**What:** `await`-ing message storage in middleware before calling `next()`.
**Why bad:** Every group message waits for DB write (50-200ms latency on every handler).
**Instead:** Fire-and-forget with `.catch()`.

### Anti-Pattern 4: Separate Behavioral Context from GuzmanContext

**What:** Creating a parallel context object alongside `GuzmanContext`.
**Why bad:** Every AI function already receives `GuzmanContext`. Adding a second parameter means modifying every function signature.
**Instead:** Use existing `playerNotes` field. It's already passed to all prompts and already read in the whisper prompt builder.

### Anti-Pattern 5: Running Behavioral Analysis in Middleware

**What:** Computing behavioral summaries inside the message capture middleware.
**Why bad:** Heavy computation on every group message, even when no AI call is imminent.
**Instead:** Compute summaries lazily, right before AI calls need them.

---

## Component Dependency Graph & Build Order

```
Phase 1: Data Layer
  [1a] player_messages table (SQL migration)
  [1b] TypeScript types (db/types.ts)
  [1c] CRUD functions (db/client.ts)
  [1d] Capture function + expanded middleware (whisper-handler.ts + bot.ts)
        depends on: 1a, 1b, 1c

Phase 2: Analysis Layer
  [2a] behavior.ts module (heuristic analysis)
        depends on: 1c (reads messages from DB)
  [2b] buildPlayerBehaviorContext() helper
        depends on: 2a
  [2c] Populate playerNotes before whisper generation
        depends on: 2a, 2b
        integration: whisper-handler.ts sendWhisper()

Phase 3: AI Integration
  [3a] Enhanced whisper prompts with message quotes
        depends on: 1c (reads messages), 2c (playerNotes populated)
        integration: ai-prompts.ts buildWhisperPrompt()
  [3b] Enhanced gap-fill with behavioral context
        depends on: 2a, 2b
        integration: ai-prompts.ts buildGapFillPrompt()
  [3c] Accusation generator
        depends on: 2a (anomaly detection), 3b (prompt pattern)
        integration: ai-guzman.ts + whisper-handler.ts runGapFill()
  [3d] Mission narratives adapt to group mood
        depends on: 2a (aggregate mood)
        integration: ai-prompts.ts buildMissionPrompt()
```

### Suggested Implementation Sequence

1. **Data capture** (Phase 1) -- no AI changes, just storing messages. Testable independently: verify messages appear in DB when players chat in group.

2. **Behavior analysis** (Phase 2) -- still no AI changes visible to users. Verify behavioral summaries are computed correctly. Can log summaries to console for validation.

3. **Whisper integration** (Phase 3a + 2c) -- whispers already have `playerNotes` integration. This is the lowest-risk AI change and highest-impact feature (Guzman quoting actual messages, twisted). The prompt seam already exists.

4. **Gap-fill + accusations** (Phase 3b + 3c) -- these modify existing gap-fill behavior and add the public accusation feature. Higher risk (new visible behavior in group chat), but infrastructure is already in place from phases 1-2.

5. **Mission narrative adaptation** (Phase 3d) -- lightest touch, adds group mood to mission prompts. Can be last since it's enhancement, not new feature.

---

## Files Changed Summary

| File | Change Type | What Changes |
|------|-------------|-------------|
| Supabase migration | **NEW** | `player_messages` table + indexes |
| `src/db/types.ts` | MODIFIED | Add `PlayerMessage`, `PlayerMessageInsert`, extend `Database` type |
| `src/db/client.ts` | MODIFIED | Add CRUD functions for player_messages |
| `src/bot.ts` | MODIFIED | Add `capturePlayerMessage()` call in existing middleware (1 line) |
| `src/lib/behavior.ts` | **NEW** | Behavioral analysis module (heuristics, summary builder) |
| `src/lib/ai-prompts.ts` | MODIFIED | Add behavioral context to existing prompts, new `buildAccusationPrompt()` |
| `src/lib/ai-guzman.ts` | MODIFIED | Add `generateAccusation()`, enhance context population before whispers |
| `src/handlers/whisper-handler.ts` | MODIFIED | Add `capturePlayerMessage()`, enhance gap-fill with accusations, populate playerNotes before whispers |

### Files NOT Changed

- `src/handlers/start.ts` -- registration flow unaffected
- `src/handlers/lobby.ts` -- lobby flow unaffected
- `src/handlers/game-commands.ts` -- game commands unaffected
- `src/handlers/game-loop.ts` -- game loop mechanics unaffected
- `src/handlers/engagement.ts` -- engagement commands unaffected
- `src/queue/message-queue.ts` -- queue mechanics unaffected
- `src/lib/scheduler.ts` -- no new cron jobs (accusations piggyback on gap-fill)
- `src/lib/ai-client.ts` -- same models, same client
- `src/lib/game-state.ts` -- game state logic unaffected
- `src/lib/roles.ts` -- role logic unaffected
- `src/config.ts` -- no new config needed

---

## Scalability Considerations

| Concern | Current (1-2 games) | At 10 concurrent games | At 100 concurrent games |
|---------|---------------------|----------------------|------------------------|
| DB writes (messages) | ~50/day/game | ~500/day total | ~5000/day total (fine) |
| DB reads (behavioral) | ~20/day/game | ~200/day total | ~2000/day total (fine) |
| AI calls (accusations) | ~2-4/day/game | ~20-40/day total | ~200-400/day total |
| In-memory cache entries | 1-2 | 10 | 100 |
| Token budget increase per call | +400-500 tokens | Same per call | Same per call |

None of these are concerns at any realistic scale for a social Telegram game.

---

## Sources

- Direct codebase analysis: `/Users/martinnordlund/golare/src/` (all 21 TypeScript source files)
- [grammY Middleware Documentation](https://grammy.dev/guide/middleware) -- middleware chain and `next()` pattern
- [grammY Filter Queries](https://grammy.dev/guide/filter-queries) -- `bot.on("message:text")` usage
- [OpenAI Context Engineering Cookbook](https://cookbook.openai.com/examples/agents_sdk/session_memory) -- context window management strategies
- [GPT-4o-mini Pricing](https://pricepertoken.com/pricing-page/model/openai-gpt-4o-mini) -- $0.15/1M input tokens (128K context)
- [GPT-4.1 Model Family](https://openai.com/index/gpt-4-1/) -- nano model 1M token context window
