# Phase 1: Data Pipeline - Research

**Researched:** 2026-02-11
**Domain:** grammY middleware, Supabase PostgreSQL, Telegram Bot API (admin/privacy mode)
**Confidence:** HIGH

## Summary

Phase 1 captures player group messages and stores them in a ring buffer (last ~10 per player per game), with filtering and admin verification. The existing codebase already has the middleware hook point (bot.ts line 37-42), the database patterns (Supabase typed client), and the fire-and-forget pattern (whisper-handler.ts `triggerEventWhisper`). The entire phase uses existing stack -- grammY middleware, Supabase PostgreSQL, and established TypeScript patterns.

The three technical challenges are: (1) resolving a Telegram user to a `game_player_id` efficiently in middleware without blocking, (2) implementing a ring buffer with automatic pruning in PostgreSQL, and (3) checking the bot's own admin status at game creation using `getChatMember` with the bot's own user ID. All three have well-established patterns documented below.

**Primary recommendation:** Extend the existing `bot.on("message:text")` middleware with a fire-and-forget `capturePlayerMessage()` call, create a `player_messages` table with an AFTER INSERT trigger for automatic pruning, and add a bot admin check in the lobby handler's `/nyttspel` command using `ctx.api.getChatMember(chatId, ctx.me.id)`.

## Standard Stack

### Core (All Existing -- Zero New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | ^1.40.0 | Bot framework, middleware chain, Telegram API | Already in use; provides `ctx.from`, `ctx.me`, `ctx.api.getChatMember()` |
| @supabase/supabase-js | ^2.95.3 | PostgreSQL client, typed queries | Already in use; provides `.from().insert()`, `.select()`, `.delete()` |
| TypeScript | ^5.9.3 | Type safety | Already in use; ESM with NodeNext module resolution |

### Supporting (All Existing)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @grammyjs/auto-retry | ^2.0.2 | API retry on 429 | Already configured in bot.ts; handles rate limits on getChatMember calls |
| @grammyjs/transformer-throttler | ^1.2.1 | API throttling | Already configured in bot.ts; applies to all bot.api calls |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL trigger for pruning | Application-level prune after insert | Trigger is atomic and cannot be forgotten; app-level adds latency to fire-and-forget path |
| In-memory game_id cache | Fresh DB query per message | Cache avoids 1 DB query per group message; acceptable staleness (game_id changes rarely) |
| @grammyjs/chat-members plugin | Raw getChatMember API call | Plugin adds a dependency (violates CONST-01) and requires context type changes; raw API call is 3 lines |

**Installation:** None needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure (Changes Only)

```
src/
  bot.ts                    # MODIFY: add capturePlayerMessage() call in existing middleware
  db/
    schema.sql              # MODIFY: add player_messages table + prune trigger
    types.ts                # MODIFY: add PlayerMessage type + Database extension
    client.ts               # MODIFY: add CRUD functions for player_messages
  lib/
    message-capture.ts      # NEW: capturePlayerMessage() + in-memory game_id cache + filtering
  handlers/
    lobby.ts                # MODIFY: add bot admin check in /nyttspel command
```

### Pattern 1: Fire-and-Forget Middleware Extension

**What:** Capture message data without blocking the grammY middleware chain.
**When to use:** Any side-effect in middleware that is not critical to the handler chain.
**Why:** Established pattern in this codebase (see `triggerEventWhisper().catch()` in game-loop.ts).

```typescript
// In bot.ts, expand existing middleware at line 37-42
// Source: existing codebase pattern
bot.on("message:text", async (ctx, next) => {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    trackGroupMessage(ctx.chat.id);
    // Fire-and-forget: capture message for behavioral tracking
    capturePlayerMessage(ctx).catch((err) =>
      console.warn("[capture] Message capture failed:", err)
    );
  }
  await next();
});
```

### Pattern 2: PostgreSQL Ring Buffer via AFTER INSERT Trigger

**What:** Automatically delete oldest rows when a player exceeds ~10 messages per game.
**When to use:** Any table that needs bounded row count per logical group.
**Why:** Trigger is atomic (cannot be forgotten), runs in the same transaction, and keeps the application layer simple.

```sql
-- Source: PostgreSQL docs (plpgsql-trigger) + standard ring buffer pattern
CREATE OR REPLACE FUNCTION prune_player_messages()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM player_messages
  WHERE id IN (
    SELECT id FROM player_messages
    WHERE game_id = NEW.game_id
      AND game_player_id = NEW.game_player_id
    ORDER BY sent_at DESC
    OFFSET 10
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prune_player_messages
  AFTER INSERT ON player_messages
  FOR EACH ROW
  EXECUTE FUNCTION prune_player_messages();
```

### Pattern 3: In-Memory Cache for Game ID Lookup

**What:** Cache `group_chat_id -> game_id` mapping to avoid a DB query per group message.
**When to use:** High-frequency lookups (every group message) where data changes infrequently.
**Why:** Game ID only changes when a game starts/finishes (rare); message frequency can be high. Same pattern as `groupActivity` Map in whisper-handler.ts.

```typescript
// Source: existing pattern in whisper-handler.ts (groupActivity Map)
const gameIdCache = new Map<number, { gameId: string; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function resolveGameId(groupChatId: number): Promise<string | null> {
  const cached = gameIdCache.get(groupChatId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.gameId;
  }
  const game = await getActiveGame(groupChatId);
  if (game) {
    gameIdCache.set(groupChatId, { gameId: game.id, cachedAt: Date.now() });
    return game.id;
  }
  gameIdCache.delete(groupChatId);
  return null;
}
```

### Pattern 4: Bot Self-Admin Check via getChatMember

**What:** Check if the bot itself has admin status in the group at game creation time.
**When to use:** At `/nyttspel` command, before creating the game.
**Why:** Bot must be admin to see all group messages (Telegram privacy mode). Without admin, message capture is blind.

```typescript
// Source: Telegram Bot API docs + grammY ctx.me
async function isBotAdmin(ctx: Context, chatId: number): Promise<boolean> {
  try {
    const botMember = await ctx.api.getChatMember(chatId, ctx.me.id);
    return botMember.status === "administrator" || botMember.status === "creator";
  } catch {
    return false;
  }
}
```

### Anti-Patterns to Avoid

- **Synchronous DB write in middleware:** Never `await` the message storage before calling `next()`. Every group message would add 50-200ms latency to all handlers.
- **Storing unlimited messages:** Without pruning, a 5-day game with 10 players could accumulate 500+ rows per game. The ring buffer keeps it bounded at ~100 rows per game (10 per player).
- **Using chat-members plugin:** Would add a new dependency (violates CONST-01) and require context type changes across the entire bot.
- **Querying game_player_id on every message:** Without caching, each message triggers 2 DB queries (getActiveGame + getGamePlayerByTelegramId). The game_id cache reduces this to 1 query (the player lookup).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ring buffer pruning | Manual DELETE after each INSERT in application code | PostgreSQL AFTER INSERT trigger | Trigger is atomic, cannot be forgotten, handles concurrent inserts correctly |
| Rate limiting on getChatMember | Custom retry/backoff | @grammyjs/auto-retry (already configured) | Already handles 429 errors with exponential backoff |
| Message throttling | Custom delay logic | @grammyjs/transformer-throttler (already configured) | Already applies to all bot.api calls |
| Player identity resolution | Full DB query each time | In-memory cache with TTL | Game ID changes ~once per 5 days; messages come every few seconds |

**Key insight:** The existing grammY plugins (auto-retry, throttler) already handle the Telegram API rate limiting that the admin check introduces. No new rate-limiting code needed.

## Common Pitfalls

### Pitfall 1: Telegram Privacy Mode Blindness

**What goes wrong:** Bot is added to group without admin status. Middleware runs, but receives no messages (or only commands/replies to bot). `player_messages` table stays empty. The entire v1.1 behavioral awareness feature silently fails.
**Why it happens:** Telegram privacy mode is enabled by default. Non-admin bots only see commands, replies to the bot, and service messages.
**How to avoid:** Check bot admin status at game creation (`/nyttspel`). If not admin, warn the user with clear instructions. Store the check result but do not block game creation (the game can still function without message capture -- it just won't have behavioral data).
**Warning signs:** `player_messages` table has zero rows after a game has been running for hours.

### Pitfall 2: Fire-and-Forget Swallowing Critical Errors

**What goes wrong:** `capturePlayerMessage().catch()` silently swallows database errors (e.g., connection failure, schema mismatch). No visibility into message capture health.
**Why it happens:** `.catch()` logs a warning but the error disappears. If DB is down, every message capture fails silently.
**How to avoid:** Log the error class (not just message). Include rate-limited error logging (don't log 100 identical errors per minute). Consider a simple counter: if capture failures exceed N in a row, log an ERROR-level message.
**Warning signs:** Console shows repeated `[capture] Message capture failed:` warnings.

### Pitfall 3: Middleware Ordering After Refactor

**What goes wrong:** Message capture middleware is moved or another middleware is inserted before it, causing messages to be missed or captured at the wrong point in the chain.
**Why it happens:** The middleware at line 37-42 in bot.ts must run before all Composer handlers (position 4 currently). If someone adds a new `bot.use()` before it, the ordering breaks.
**How to avoid:** Add a clear comment: `// MUST be before all Composer handlers -- captures raw group messages`. Keep the middleware in its current position. Don't move it into a Composer (Composers can be reordered).
**Warning signs:** Some messages not appearing in `player_messages` despite active game.

### Pitfall 4: Supabase Type Assertion on New Table

**What goes wrong:** Supabase v2.95 `select('*')` returns `{}` instead of typed rows for the new `player_messages` table. Code compiles but data is untyped at runtime.
**Why it happens:** Known Supabase v2.95 generic constraint issue with joined selects. The codebase already works around this with `as` type assertions (e.g., `data as PlayerRow` in client.ts).
**How to avoid:** Follow the established pattern: use `type` aliases (not `interface`), and apply `as` type assertions on all `.select('*')` returns. This is documented in the project memory.
**Warning signs:** TypeScript errors about `{}` type, or runtime `undefined` on typed properties.

### Pitfall 5: Cache Staleness on Game End

**What goes wrong:** Game ends or is cancelled, but the in-memory `gameIdCache` still holds the old game_id. New messages get stored against a finished game.
**Why it happens:** Cache TTL is 5 minutes, but game state changes are immediate.
**How to avoid:** Invalidate the cache entry when game state changes. Add `gameIdCache.delete(groupChatId)` in the game end/cancel code paths. Or: check game state in the capture function after resolving game_id from cache and skip if finished/cancelled.
**Warning signs:** `player_messages` rows with `game_id` pointing to a finished game.

### Pitfall 6: Command Messages Stored as Player Messages

**What goes wrong:** `/status`, `/regler`, and other command messages are stored in `player_messages`, polluting behavioral analysis with bot interaction rather than player conversation.
**Why it happens:** The `message:text` filter matches ALL text messages, including those that start with `/`.
**How to avoid:** In `capturePlayerMessage()`, filter out messages that start with `/`. Also filter out messages from bots (`ctx.from.is_bot`). This is requirement DATA-03.
**Warning signs:** `player_messages` contains entries like "/status" or "/regler".

## Code Examples

### Complete Message Capture Function

```typescript
// Source: codebase patterns (fire-and-forget, cache, filtering)
// File: src/lib/message-capture.ts

import type { Context } from "grammy";
import { getActiveGame, getGamePlayerByTelegramId } from "../db/client.js";

// In-memory cache: group_chat_id -> game_id
const gameIdCache = new Map<number, { gameId: string; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Invalidate the game_id cache for a group.
 * Call when game state changes (start, finish, cancel).
 */
export function invalidateGameCache(groupChatId: number): void {
  gameIdCache.delete(groupChatId);
}

/**
 * Capture a player's group message for behavioral tracking.
 * Fire-and-forget from middleware -- must never throw to caller.
 *
 * Filters (DATA-03):
 * - Skip bot messages (ctx.from.is_bot)
 * - Skip commands (text starts with /)
 * - Skip if no active game
 * - Skip if sender is not a game player
 */
export async function capturePlayerMessage(ctx: Context): Promise<void> {
  // Filter: must have from and message text
  if (!ctx.from || !ctx.message?.text) return;

  // Filter: skip bot messages
  if (ctx.from.is_bot) return;

  // Filter: skip commands
  if (ctx.message.text.startsWith("/")) return;

  const groupChatId = ctx.chat!.id;
  const text = ctx.message.text.slice(0, 500); // Truncate to 500 chars

  // Resolve game_id (cached)
  const cached = gameIdCache.get(groupChatId);
  let gameId: string | null = null;

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    gameId = cached.gameId;
  } else {
    const game = await getActiveGame(groupChatId);
    if (game && game.state === "active") {
      gameId = game.id;
      gameIdCache.set(groupChatId, { gameId: game.id, cachedAt: Date.now() });
    } else {
      gameIdCache.delete(groupChatId);
      return; // No active game
    }
  }

  // Resolve game_player_id
  const gamePlayer = await getGamePlayerByTelegramId(gameId, ctx.from.id);
  if (!gamePlayer) return; // Not a game player (spectator)

  // Store message (fire-and-forget -- trigger handles ring buffer pruning)
  await createPlayerMessage({
    game_id: gameId,
    game_player_id: gamePlayer.id,
    message_text: text,
  });
}
```

### Complete Database Schema

```sql
-- File: append to src/db/schema.sql

-- ---------------------------------------------------------------------------
-- Player messages: ring buffer of group chat messages for behavioral tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_player_id   UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  message_text     TEXT NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query: recent messages per player per game (ordered by sent_at DESC)
CREATE INDEX IF NOT EXISTS idx_player_messages_player_game
  ON player_messages (game_id, game_player_id, sent_at DESC);

-- Ring buffer pruning: keep only last ~10 messages per player per game
CREATE OR REPLACE FUNCTION prune_player_messages()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM player_messages
  WHERE id IN (
    SELECT id FROM player_messages
    WHERE game_id = NEW.game_id
      AND game_player_id = NEW.game_player_id
    ORDER BY sent_at DESC
    OFFSET 10
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prune_player_messages
  AFTER INSERT ON player_messages
  FOR EACH ROW
  EXECUTE FUNCTION prune_player_messages();
```

### Bot Admin Check in Lobby

```typescript
// Source: Telegram Bot API docs + grammY ctx.me
// File: modify in src/handlers/lobby.ts

/**
 * Check if the bot itself has admin status in a group.
 * Required for message visibility (Telegram privacy mode).
 */
async function isBotAdmin(
  ctx: Context,
  chatId: number,
): Promise<boolean> {
  try {
    const botMember = await ctx.api.getChatMember(chatId, ctx.me.id);
    return botMember.status === "administrator" || botMember.status === "creator";
  } catch {
    return false;
  }
}

// In /nyttspel handler, after checking user is group admin:
const botAdmin = await isBotAdmin(ctx, ctx.chat.id);
if (!botAdmin) {
  await ctx.reply(
    "Yo, jag behover adminrattigheterna i gruppen for att kunna se " +
    "alla meddelanden. Gor mig till admin forst, sen kor vi. 🔧"
  );
  return;
}
```

### CRUD Functions for player_messages

```typescript
// Source: existing codebase patterns in db/client.ts

/**
 * Store a captured group message. Called fire-and-forget from middleware.
 * Ring buffer pruning is handled by the database trigger.
 */
export async function createPlayerMessage(
  msg: PlayerMessageInsert,
): Promise<void> {
  const { error } = await supabase
    .from("player_messages")
    .insert(msg);

  if (error) {
    throw new Error(`createPlayerMessage failed: ${error.message}`);
  }
}

/**
 * Get the last N messages for a player in a game, newest first.
 * Used by behavioral analysis (Phase 2) to build player summaries.
 */
export async function getRecentPlayerMessages(
  gameId: string,
  gamePlayerId: string,
  limit: number = 10,
): Promise<PlayerMessage[]> {
  const { data, error } = await supabase
    .from("player_messages")
    .select("*")
    .eq("game_id", gameId)
    .eq("game_player_id", gamePlayerId)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`getRecentPlayerMessages failed: ${error.message}`);
  }

  return (data ?? []) as PlayerMessage[];
}

/**
 * Get recent messages for ALL players in a game.
 * Used for batch behavioral analysis before AI generation calls.
 */
export async function getAllRecentMessages(
  gameId: string,
): Promise<PlayerMessage[]> {
  const { data, error } = await supabase
    .from("player_messages")
    .select("*")
    .eq("game_id", gameId)
    .order("sent_at", { ascending: false });

  if (error) {
    throw new Error(`getAllRecentMessages failed: ${error.message}`);
  }

  return (data ?? []) as PlayerMessage[];
}
```

### TypeScript Types

```typescript
// Source: existing type patterns in db/types.ts

/** Full player_messages row */
export type PlayerMessage = {
  id: string;
  game_id: string;
  game_player_id: string;
  message_text: string;
  sent_at: string;
};

/** Insert type for player_messages (id and sent_at auto-generated) */
export type PlayerMessageInsert = Omit<PlayerMessage, "id" | "sent_at">;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory message counter only | DB-persisted message capture with ring buffer | v1.1 (this phase) | Enables behavioral analysis in Phase 2 |
| No bot admin check | Admin check at game creation | v1.1 (this phase) | Prevents silent message capture failure |
| No message filtering in middleware | Filter bots, commands, non-players, DMs | v1.1 (this phase) | Clean data for behavioral analysis |

**Existing code that stays unchanged:**
- `trackGroupMessage()` in whisper-handler.ts -- still needed for gap-fill activity detection (different purpose: hourly message count, not message content)
- `groupActivity` Map in whisper-handler.ts -- still tracks gap-fill timing
- All handler Composers -- no changes to game mechanics

## Open Questions

1. **Should bot admin check block game creation or just warn?**
   - What we know: DATA-04 says "verify bot has admin status in group at game creation." The game functions fine without message capture (v1 works without it). v1.1 features just won't have behavioral data.
   - What's unclear: Whether to hard-block (`return` after warning) or soft-warn (create game anyway, log warning). Hard-block is safer for v1.1 feature completeness.
   - Recommendation: **Hard-block.** The admin check should be a prerequisite for game creation. If the bot isn't admin, message capture won't work, and the entire v1.1 AI behavioral awareness pipeline is useless. Better to fix the setup than run a game with broken features. Use a clear Swedish warning message with instructions.

2. **Should `capturePlayerMessage` live in a new module or whisper-handler.ts?**
   - What we know: The prior architecture research recommends keeping it in whisper-handler.ts alongside `trackGroupMessage`. However, the capture function has its own concerns (caching, filtering, DB writes) that are distinct from whisper generation.
   - What's unclear: Whether the complexity warrants a new file.
   - Recommendation: **New module `src/lib/message-capture.ts`.** The function has its own cache, filtering logic, and DB calls. It's cleanly separable. The whisper-handler.ts is already 430 lines. Phase 2 will add behavioral analysis that reads from this data -- better to have a clear module boundary now.

3. **Cache invalidation timing**
   - What we know: Game state changes happen at game start, game end, and game cancel. The cache needs invalidation at these points.
   - What's unclear: Whether to actively invalidate or rely on TTL.
   - Recommendation: **Both.** Active invalidation via `invalidateGameCache()` at state change points + TTL as safety net. The function should be called from lobby.ts (game start), game-loop.ts (game end), and game-commands.ts (game cancel).

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `/Users/martinnordlund/golare/src/` -- all 21 TypeScript source files read and analyzed
- `.planning/research/ARCHITECTURE.md` -- prior v1.1 architecture research (comprehensive, same session)
- [Telegram Bot Features - Privacy Mode](https://core.telegram.org/bots/features) -- bot admin always receives all messages
- [PostgreSQL Trigger Functions Documentation](https://www.postgresql.org/docs/current/plpgsql-trigger.html) -- AFTER INSERT trigger pattern, RETURN NULL for after triggers
- [grammY Middleware Documentation](https://grammy.dev/guide/middleware) -- middleware chain, `next()` pattern
- [grammY Filter Queries](https://grammy.dev/guide/filter-queries) -- `bot.on("message:text")` filter
- [grammY API Reference](https://grammy.dev/ref/core/api) -- `getChatMember`, `ctx.me`
- [grammY Context Guide](https://grammy.dev/guide/context) -- `ctx.from.is_bot`, `ctx.me.id`, `ctx.message.text`

### Secondary (MEDIUM confidence)
- [PostgreSQL Trigger for Deleting Old Records](https://www.the-art-of-web.com/sql/trigger-delete-old/) -- AFTER INSERT trigger pattern for row cleanup
- [Supabase Triggers Documentation](https://supabase.com/docs/guides/database/postgres/triggers) -- trigger support in Supabase-hosted PostgreSQL

### Tertiary (LOW confidence)
- None. All findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, versions confirmed from package.json
- Architecture: HIGH -- patterns derived from direct codebase analysis of v1, all integration points verified
- Database schema: HIGH -- follows established patterns (trigger, indexes, type aliases), verified against PostgreSQL docs
- Bot admin check: HIGH -- Telegram Bot API documentation confirms privacy mode behavior and getChatMember API
- Pitfalls: HIGH -- derived from actual code inspection and known Supabase v2.95 issues documented in project memory

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days -- stable domain, no fast-moving APIs)
