# Phase 1: Foundation - Research

**Researched:** 2026-02-10
**Domain:** Telegram bot infrastructure (grammY + Supabase + message queue + deep linking)
**Confidence:** HIGH

## Summary

Phase 1 delivers the infrastructure layer for a Telegram bot game: connecting via grammY, persisting player state in Supabase, rate-limiting outbound messages, and handling the DM permission flow via deep links. The technology choices are mature and well-documented. grammY (v1.40.0) is the actively maintained successor to Telegraf (EOL Feb 2025) with strong TypeScript support, a plugin ecosystem that directly addresses rate limiting, and official documentation covering every pattern this phase needs. Supabase JS (v2.95.x) provides a typed PostgreSQL client that works naturally on the server side with the service_role key for bot-to-database operations.

The main architectural decisions are: (1) use grammY's `auto-retry` plugin as the foundation for rate limit handling, augmented by a per-chat message queue for the 20 msg/min group constraint; (2) store player data directly in Supabase via the JS client with `service_role` key (no auth layer needed -- the bot IS the server); (3) implement deep linking via `https://t.me/<bot>?start=<payload>` with `ctx.match` to distinguish group-referral `/start` from direct `/start`.

**Primary recommendation:** Use grammY long polling with `auto-retry` plugin, Supabase JS with `service_role` key and `persistSession: false`, and a lightweight in-memory per-chat message queue that respects the 20 msg/min group limit. Keep it simple -- no Redis, no BullMQ, no external queue for v1.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Welcome experience (/start): Brief intro + confirmation with Guzman persona. Context-aware response (deep link vs direct). Include one inline button (e.g. "Regler")
- DM permission flow: Guzman calls out unregistered players by name in group with deep link. Soft timeout (~5 min reminder). Group announcement when player completes /start ("X ar inne")
- Bot language: Swedish throughout. Swedish commands (/regler, /nyttspel, /status). Guzman always in character. Emojis used liberally. Core slang: bre, shuno, aina, para
- Error messaging: Always tell player (in character). On /start failure ask retry. Varied reactions (3-5 lines per error type). Queue delay acknowledgment (~5s threshold)

### Claude's Discretion
- Exact welcome message copy (within constraints above)
- Loading/typing indicators
- Database schema design and table structure
- Message queue implementation details (priority, retry internals)
- Deep link parameter format
- Exact timeout duration for the DM reminder

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | 1.40.0 | Telegram Bot framework | Actively maintained, TypeScript-first, rich plugin ecosystem, official Telegram Bot API support |
| @supabase/supabase-js | 2.95.x | PostgreSQL client for Supabase | Typed queries, upsert support, works server-side with service_role key |
| @grammyjs/auto-retry | 2.0.2 | Automatic 429 retry handler | Official grammY plugin, handles rate limit errors by sleeping and retrying |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @grammyjs/transformer-throttler | latest | Proactive rate limiting via Bottleneck | Use alongside auto-retry for belt-and-suspenders rate limiting |
| typescript | 5.x | Type safety | Required for grammY's typed context and Supabase's generated types |
| tsx | latest | TypeScript runner (no compile step) | Dev mode execution; faster than ts-node with ESM |
| dotenv | - | NOT NEEDED | Node.js 20.6+ has native `--env-file` support |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory queue | BullMQ + Redis | Overkill for single-process bot with <30 msg/s; adds Redis dependency |
| transformer-throttler | Custom Bottleneck setup | throttler provides sensible defaults matching Telegram limits |
| dotenv | Native --env-file | Native is simpler, one less dependency; use `--env-file=.env` flag |

**Installation:**
```bash
npm install grammy @supabase/supabase-js @grammyjs/auto-retry @grammyjs/transformer-throttler
npm install -D typescript @types/node tsx supabase
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  bot.ts              # Bot instance creation, plugin registration, graceful shutdown
  config.ts           # Environment variables, Supabase URL/key, bot token
  db/
    client.ts         # Supabase createClient with service_role key
    schema.sql        # SQL migration for players table
    types.ts          # Generated Supabase types (via CLI)
  queue/
    message-queue.ts  # Per-chat rate-limited message queue
  handlers/
    start.ts          # /start command handler (registration + deep link detection)
    dm-flow.ts        # Deep link generation, group callout, completion announcement
  lib/
    messages.ts       # Swedish message templates (Guzman persona)
    errors.ts         # Error message variants (3-5 per type)
```

### Pattern 1: Bot Setup with Plugins
**What:** Create bot instance, register API transformers, install middleware, handle graceful shutdown.
**When to use:** Always -- this is the entry point.
**Example:**
```typescript
// Source: https://grammy.dev/plugins/auto-retry, https://grammy.dev/advanced/flood
import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";

const bot = new Bot(process.env.BOT_TOKEN!);

// Rate limiting: throttler prevents hitting limits, auto-retry handles 429s
bot.api.config.use(apiThrottler());
bot.api.config.use(autoRetry({
  maxRetryAttempts: 3,
  maxDelaySeconds: 60,
}));

// Error handler
bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Telegram API error:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Network error:", e);
  } else {
    console.error("Unexpected error:", e);
  }
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

await bot.start();
```

### Pattern 2: Supabase Server Client
**What:** Create Supabase client for server-side bot usage with service_role key (bypasses RLS).
**When to use:** All database operations from the bot process.
**Example:**
```typescript
// Source: https://supabase.com/docs/reference/javascript/installing
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
```

### Pattern 3: Deep Link Detection in /start
**What:** Use `ctx.match` to detect whether /start came from a deep link or direct message.
**When to use:** /start command handler.
**Example:**
```typescript
// Source: https://grammy.dev/guide/commands
bot.command("start", async (ctx) => {
  const deepLinkPayload = ctx.match; // empty string if direct /start
  const userId = ctx.from!.id;       // number (safe for JS -- Telegram limits to 52-bit)
  const chatId = ctx.chat!.id;       // number

  if (deepLinkPayload) {
    // User came from group deep link, e.g. "game_<gameId>" or "join_<groupChatId>"
    await handleDeepLinkStart(ctx, deepLinkPayload);
  } else {
    // Direct /start -- generic Guzman welcome
    await handleDirectStart(ctx);
  }
});
```

### Pattern 4: Composer-Based Module Organization
**What:** Use grammY `Composer` to organize handlers by feature.
**When to use:** When splitting handlers across files.
**Example:**
```typescript
// Source: https://grammy.dev/advanced/structuring
// handlers/start.ts
import { Composer } from "grammy";

export const startHandler = new Composer();

startHandler.command("start", async (ctx) => {
  // Registration logic
});

// bot.ts
import { startHandler } from "./handlers/start.js";
bot.use(startHandler);
```

### Pattern 5: InlineKeyboard for Buttons
**What:** Create inline keyboards with callback data for interactive messages.
**When to use:** Welcome message "Regler" button, DM flow actions.
**Example:**
```typescript
// Source: https://grammy.dev/plugins/keyboard
import { InlineKeyboard } from "grammy";

const welcomeKeyboard = new InlineKeyboard()
  .text("Regler", "show_rules");

await ctx.reply("Yo bre, valkommen!", {
  reply_markup: welcomeKeyboard,
});

// Handle button press
bot.callbackQuery("show_rules", async (ctx) => {
  await ctx.answerCallbackQuery(); // Required: removes loading state
  await ctx.reply("Reglerna ar...");
});
```

### Anti-Patterns to Avoid
- **Storing state in memory/sessions:** Race conditions with concurrent players. Use Supabase for ALL state.
- **Using anon key for bot:** Bot is the server -- use `service_role` key to bypass RLS. No user auth needed.
- **Ignoring 429 errors:** Never ignore or silently drop messages. Use auto-retry + queue.
- **Sending messages without queue:** Even with auto-retry, rapid sequential sends to one group will hit 20 msg/min. Queue is mandatory.
- **Using BigInt for Telegram IDs in JavaScript:** Telegram IDs are limited to 52 significant bits, which fits safely in JavaScript `number`. No BigInt needed. Store as `bigint` in PostgreSQL for safety, but use `number` in JS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limit handling | Custom sleep/retry logic | `@grammyjs/auto-retry` | Handles 429 + 5xx + network errors with exponential backoff |
| API request throttling | Manual timers per chat | `@grammyjs/transformer-throttler` | Uses Bottleneck with defaults matching Telegram's documented limits (30/s global, 20/min per group) |
| Telegram type definitions | Manual API types | `@grammyjs/types` (bundled with grammy) | Auto-generated from Telegram Bot API spec, always current |
| Supabase TypeScript types | Manual interfaces | `npx supabase gen types typescript` | Generated from actual DB schema, catches drift |
| Inline keyboard building | Manual JSON reply_markup | `InlineKeyboard` class from grammy | Fluent API, handles row layout, type-safe callback data |

**Key insight:** grammY's plugin ecosystem solves the two hardest infrastructure problems (rate limiting and error recovery) out of the box. The message queue is the only custom code needed, and it's a thin layer on top of these plugins.

## Common Pitfalls

### Pitfall 1: Telegram's 20 msg/min Group Limit
**What goes wrong:** Bot sends burst of messages to a group (e.g., announcing multiple player registrations) and gets 429'd. Auto-retry handles it but introduces visible delays.
**Why it happens:** Telegram enforces 20 messages per minute per group chat, independent of global 30 msg/s limit.
**How to avoid:** Implement a per-chat message queue that spaces messages at minimum 3-second intervals for groups. Auto-retry is the safety net, not the primary strategy.
**Warning signs:** 429 errors in logs with `retry_after` values; messages arriving out of order.

### Pitfall 2: ctx.from and ctx.chat May Be Undefined
**What goes wrong:** Bot crashes with "Cannot read property 'id' of undefined" on certain update types.
**Why it happens:** Not all Telegram updates have `from` or `chat` fields. Channel posts, for example, lack `from`.
**How to avoid:** Always use narrowing: `bot.command("start")` already guarantees `ctx.msg` exists, but add explicit checks for `ctx.from` in handlers that might receive varied update types.
**Warning signs:** Uncaught TypeError in production logs.

### Pitfall 3: Deep Link Payload Character Restrictions
**What goes wrong:** Deep link URL doesn't work because payload contains invalid characters.
**Why it happens:** Telegram only allows `A-Z, a-z, 0-9, _ and -` in start parameters (up to 64 chars).
**How to avoid:** Use simple alphanumeric payloads like `join_123456` or base64url encoding for complex data. No spaces, no special characters.
**Warning signs:** Users clicking deep link but bot receiving empty `ctx.match`.

### Pitfall 4: Callback Data 64-Byte Limit
**What goes wrong:** Inline button fails silently or throws BUTTON_DATA_INVALID error.
**Why it happens:** Telegram limits `callback_data` to 1-64 bytes (UTF-8 encoded). Swedish characters (a, o, etc.) take 2 bytes each.
**How to avoid:** Use short English keys for callback data (e.g., `rules`, `join_123`), never embed full data. For complex state, use server-side lookup with short hash keys.
**Warning signs:** 400 errors when sending keyboards with long callback data strings.

### Pitfall 5: Supabase Service Role Key Exposure
**What goes wrong:** Service role key committed to git or exposed in client code, allowing unrestricted database access.
**Why it happens:** Confusion between anon key (safe to expose) and service_role key (bypasses all RLS).
**How to avoid:** Store in `.env` file, add `.env` to `.gitignore`, use `--env-file=.env` flag. Never import in any client-side code.
**Warning signs:** Key visible in git history; unexpected database modifications.

### Pitfall 6: Not Answering Callback Queries
**What goes wrong:** Loading spinner persists on inline button indefinitely.
**Why it happens:** Every callback query MUST be answered with `ctx.answerCallbackQuery()`, even if no notification is shown.
**How to avoid:** Always call `answerCallbackQuery()` first in callback handlers, before any async work that might throw.
**Warning signs:** Users reporting "stuck" buttons; Telegram showing loading indicators that never resolve.

### Pitfall 7: Bot Cannot DM Users Who Haven't /start'd
**What goes wrong:** `bot.api.sendMessage(userId, ...)` throws "Forbidden: bot was blocked by the user" or "Forbidden: bot can't initiate conversation with a user".
**Why it happens:** Telegram requires users to explicitly start a conversation with a bot before the bot can send DMs.
**How to avoid:** This is by design and shapes the entire join flow. Track `has_started_bot` in the database. Use group deep links to guide users to private chat.
**Warning signs:** Failed DM sends in logs for users who haven't registered.

## Code Examples

### Player Registration (Upsert Pattern)
```typescript
// Source: https://supabase.com/docs/reference/javascript/upsert
async function registerPlayer(telegramUserId: number, chatId: number, username?: string) {
  const { data, error } = await supabase
    .from("players")
    .upsert(
      {
        telegram_user_id: telegramUserId,
        dm_chat_id: chatId,
        username: username ?? null,
        registered_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Deep Link URL Generation
```typescript
// Source: https://core.telegram.org/bots/features (deep linking)
function createDeepLink(botUsername: string, payload: string): string {
  // Payload: A-Z, a-z, 0-9, _, - only. Max 64 chars.
  return `https://t.me/${botUsername}?start=${payload}`;
}

// Example: link for group game join
// createDeepLink("GolareBot", "join_-100123456789")
// Result: https://t.me/GolareBot?start=join_-100123456789
```

### Per-Chat Message Queue (Simplified)
```typescript
// Custom implementation -- no library does exactly this
interface QueuedMessage {
  chatId: number;
  text: string;
  options?: object;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

class MessageQueue {
  private queues = new Map<number, QueuedMessage[]>();
  private processing = new Set<number>();
  private readonly minIntervalMs: number;

  constructor(
    private bot: Bot,
    options?: { minIntervalMs?: number }
  ) {
    // 20 msg/min = 1 msg per 3 seconds for groups
    this.minIntervalMs = options?.minIntervalMs ?? 3000;
  }

  async send(chatId: number, text: string, options?: object): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const queue = this.queues.get(chatId) ?? [];
      queue.push({ chatId, text, options, resolve, reject });
      this.queues.set(chatId, queue);
      this.processQueue(chatId);
    });
  }

  private async processQueue(chatId: number) {
    if (this.processing.has(chatId)) return;
    this.processing.add(chatId);

    const queue = this.queues.get(chatId);
    while (queue && queue.length > 0) {
      const msg = queue.shift()!;
      try {
        const result = await this.bot.api.sendMessage(msg.chatId, msg.text, msg.options);
        msg.resolve(result);
      } catch (err) {
        msg.reject(err);
      }
      if (queue.length > 0) {
        await new Promise(r => setTimeout(r, this.minIntervalMs));
      }
    }

    this.processing.delete(chatId);
  }
}
```

### Supabase Schema (SQL Migration)
```sql
-- supabase/migrations/001_create_players.sql
CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  dm_chat_id      BIGINT NOT NULL,
  username        TEXT,
  first_name      TEXT,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by Telegram user ID
CREATE INDEX idx_players_telegram_user_id ON players (telegram_user_id);

-- RLS disabled -- bot uses service_role key which bypasses RLS anyway
-- If you enable RLS later, the service_role key still bypasses it
```

### Graceful Shutdown Pattern
```typescript
// Source: https://grammy.dev/advanced/reliability
import { Bot, GrammyError, HttpError } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

// ... register handlers ...

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error handling update ${ctx.update.update_id}:`, err.error);
});

// Graceful shutdown on process signals
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

console.log("Bot starting...");
await bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started`);
  },
});
```

### TypeScript Type Generation
```bash
# Generate types from Supabase database schema
npx supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_ID" \
  --schema public \
  > src/db/types.ts
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Telegraf framework | grammY | Telegraf EOL Feb 2025 | Must use grammY -- Telegraf unmaintained |
| dotenv package | `node --env-file=.env` | Node.js 20.6+ (2023) | One less dependency |
| ts-node for TypeScript | tsx runner | 2024 | Better ESM support, faster, drop-in replacement |
| Per-token rate limiting | Per-chat rate limiting | Telegram layer 167, Feb 2025 | Queue must be keyed by chat_id, not global |
| Supabase JS v1 | Supabase JS v2 (2.95.x) | 2022 | Breaking API changes; v2 required for current features |
| Node.js 18 | Node.js 20+ | Supabase dropped Node 18 in v2.79.0 | Must use Node.js 20+ for both Supabase and native .env |

**Deprecated/outdated:**
- Telegraf: EOL February 2025. Do not use.
- `supabase-js` v1: Major API differences. Use v2.
- `ts-node` with ESM: Known compatibility issues. Use `tsx` instead.
- `dotenv` package: Unnecessary with Node.js 20.6+.

## Open Questions

1. **Message queue: in-memory vs database-backed?**
   - What we know: In-memory queue is simpler and sufficient for single-process bot. Database-backed survives restarts but adds complexity.
   - What's unclear: Whether queued messages should survive bot restarts (losing a few queued messages on restart vs. replay risk).
   - Recommendation: Start with in-memory. If messages are lost on restart in practice, add a `pending_messages` table later. The auto-retry plugin handles transient failures regardless.

2. **Transformer-throttler: needed alongside auto-retry?**
   - What we know: auto-retry is reactive (handles 429 after the fact). transformer-throttler is proactive (prevents 429 by queuing). grammY docs recommend using both.
   - What's unclear: Whether the custom per-chat queue makes transformer-throttler redundant for group messages.
   - Recommendation: Use both. transformer-throttler handles global/private rate limits; custom queue handles the stricter group 20 msg/min limit. Belt and suspenders.

3. **Deep link payload format for group referral**
   - What we know: Payload must be A-Z, a-z, 0-9, _, - only. Max 64 chars. Need to identify which group the user came from.
   - What's unclear: Whether to encode group chat_id directly (can be negative and long, e.g., `-100123456789`) or use a lookup key.
   - Recommendation: Use format `g_<groupChatId>` where the negative sign is handled by the prefix `g_`. Group chat IDs starting with `-100` can be stored as the numeric part only: `g_100123456789`. This fits well within 64 chars and uses only allowed characters.

## Sources

### Primary (HIGH confidence)
- grammY official docs (https://grammy.dev/) -- Bot setup, commands, error handling, structuring, flood limits
- grammY auto-retry plugin docs (https://grammy.dev/plugins/auto-retry) -- Configuration options, retry behavior
- grammY transformer-throttler docs (https://grammy.dev/plugins/transformer-throttler) -- Bottleneck integration, default limits
- grammY keyboard plugin docs (https://grammy.dev/plugins/keyboard) -- InlineKeyboard API, callback queries
- Telegram Bot API docs (https://core.telegram.org/bots/api) -- Rate limits, callback_data limits, deep linking
- Telegram Bot Features (https://core.telegram.org/bots/features) -- Deep link format, start parameter constraints
- Telegram Bot API dialog IDs (https://core.telegram.org/api/bots/ids) -- 52-bit ID limit confirmation
- Supabase JS docs (https://supabase.com/docs/reference/javascript/installing) -- Client setup, operations
- Supabase API keys docs (https://supabase.com/docs/guides/api/api-keys) -- service_role vs anon key

### Secondary (MEDIUM confidence)
- npm package pages -- Version numbers verified (grammy 1.40.0, @supabase/supabase-js 2.95.x, @grammyjs/auto-retry 2.0.2)
- Node.js native .env support -- Multiple verified sources confirming --env-file flag in Node.js 20.6+

### Tertiary (LOW confidence)
- Per-chat rate limiting change in Telegram layer 167 (Feb 2025) -- Single source, consistent with Telegram's general direction but not verified against official changelog

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries verified via official docs and npm
- Architecture: HIGH -- Patterns directly from grammY official documentation
- Pitfalls: HIGH -- Documented in Telegram Bot API FAQ and grammY flood control guide
- Message queue design: MEDIUM -- Custom code needed; pattern is standard but specifics are project-specific
- Deep link format: HIGH -- Directly from Telegram Bot API specification

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable ecosystem, 30-day validity)
