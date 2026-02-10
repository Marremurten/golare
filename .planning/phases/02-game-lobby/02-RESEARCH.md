# Phase 2: Game Lobby - Research

**Researched:** 2026-02-10
**Domain:** Telegram game lobby (inline keyboards, callback queries, database schema, role assignment, message editing)
**Confidence:** HIGH

## Summary

Phase 2 builds the game lobby on top of Phase 1's foundation: `/nyttspel` creates a game, players join/leave via inline buttons on a self-updating lobby message, admin starts the game, roles are assigned and delivered via DM, and `/regler`+`/status` commands provide ongoing game info. The technical challenges are: (1) concurrent callback query handling when multiple players click join/leave simultaneously, (2) editing the lobby message atomically without "message not modified" errors, (3) cryptographically fair role assignment matching the balancing table, and (4) sending role DMs to all players through the rate-limited message queue.

grammY's `Composer`, `InlineKeyboard`, `callbackQuery()` with regex matching, and `ctx.editMessageText()` provide all the building blocks. The lobby message pattern is well-established in Telegram bot development: send a message with an inline keyboard, store the `message_id`, and edit it on each callback query. The critical concurrency concern is that Supabase must be the single source of truth for lobby state -- read current players from DB, add/remove, write back, then render the updated message. Two simultaneous join clicks must not lose one player.

**Primary recommendation:** Use database-first lobby state with Supabase as source of truth (games + game_players tables), callback queries with regex-matched prefixes (`join:{gameId}`, `leave:{gameId}`, `start:{gameId}`), `ctx.editMessageText()` for live lobby updates, `crypto.randomInt()` for fair role shuffling, and parallel DM delivery through the existing message queue.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Join via inline button ("Jag ar med") on the lobby message -- one tap to join
- Admin starts the game manually with a "Kor igang" button -- full control, no auto-start
- Lobby message updates live as players join/leave, showing names and count (e.g. "3/10 spelare: @anna, @erik, @lisa")
- Players can leave the lobby with a "Hoppa av" button before game starts -- list updates accordingly
- Min 4, max 10 players enforced (from balancing table)
- Full Guzman voice in the role DM -- in-character suburb slang, not clinical
- Each DM includes full brief: role name, team, abilities, and win condition -- everything the player needs
- Golare receive a named list of other Golare identities in the same DM (e.g. "Dina broder i skiten: @erik, @lisa")
- Hogra Hand DM confirms their Spaning ability with explanation
- All role DMs sent simultaneously -- no staggering
- Dramatic Guzman monologue posted to the group when game starts -- sets the mood, warns about traitors
- Monologue weaves in a brief rules recap naturally -- not a wall of text, but enough to get started
- First mission posts shortly after game start (immediately), regardless of time of day -- then daily schedule kicks in from next day
- Admin can cancel the game at any point with /avbryt command -- clean slate
- /regler uses structured sections with Guzman flavor -- clean headings with in-character headlines
- /regler is paginated with inline buttons -- "Roller" / "Spelgang" / "Vinst" sections, keeps each page short
- /status shows score + current phase + full player list + current Capo
- Both /regler and /status work in group chat AND private DM -- in DM may show extra info like your role

### Claude's Discretion
- Exact lobby message formatting and emoji usage
- Guzman monologue content and length
- /regler section breakdown and wording
- /status formatting and layout
- Error messages for edge cases (not enough players, already in game, etc.)
- How /avbryt confirmation works

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (already installed from Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | 1.40.0 | Bot framework, Composer, InlineKeyboard, callbackQuery | Already in use; provides all needed APIs for lobby |
| @supabase/supabase-js | 2.95.3 | Database client for games/players tables | Already in use; upsert, select, delete operations |
| @grammyjs/auto-retry | 2.0.2 | Rate limit retry | Already configured in bot.ts |
| @grammyjs/transformer-throttler | 1.2.1 | Proactive rate limiting | Already configured in bot.ts |

### New for Phase 2
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No new dependencies needed |

Phase 2 requires no new npm packages. All functionality is covered by grammY core (InlineKeyboard, Composer, callbackQuery, ctx.editMessageText), Supabase JS client (insert, select, delete, update), and Node.js built-in `crypto.randomInt()`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| crypto.randomInt() | Math.random() | Math.random() is not cryptographically secure; for fair role assignment, crypto.randomInt() ensures unbiased shuffling at zero extra cost |
| Manual callback data parsing | @grammyjs/menu plugin | Menu plugin adds abstraction overhead; manual regex matching on callbackQuery is simpler for 5-6 button types |
| PostgreSQL function via rpc() | Sequential JS client calls | RPC provides atomicity but adds schema complexity; for lobby join/leave, a simple insert/delete with conflict handling is sufficient |

**Installation:**
```bash
# No new packages needed -- Phase 1 stack covers everything
```

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)
```
src/
  bot.ts                    # Add new handler registrations
  config.ts                 # Unchanged
  db/
    client.ts               # Add game/player DB functions
    schema.sql              # Add games, game_players tables
    types.ts                # Add Game, GamePlayer types
  handlers/
    start.ts                # Update show_rules callback -> real /regler
    dm-flow.ts              # Unchanged (reused for DM delivery)
    lobby.ts                # NEW: /nyttspel, join/leave/start callbacks
    game-commands.ts        # NEW: /regler, /status, /avbryt commands
  lib/
    messages.ts             # Add lobby, role reveal, rules, status templates
    errors.ts               # Add lobby error variants
    roles.ts                # NEW: Role assignment engine
  queue/
    message-queue.ts        # Unchanged (reused for all sends)
```

### Pattern 1: Lobby Message with Live Inline Keyboard
**What:** A single message in the group chat that updates its text and buttons as players join/leave.
**When to use:** Any time you need a "living" status display with interactive buttons.
**Example:**
```typescript
// Source: grammY docs + Telegram Bot API
import { InlineKeyboard } from "grammy";

function buildLobbyKeyboard(gameId: string, isAdmin: boolean, playerCount: number): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("Jag ar med!", `join:${gameId}`)
    .text("Hoppa av", `leave:${gameId}`);

  if (isAdmin && playerCount >= 4) {
    kb.row().text("Kor igang!", `start:${gameId}`);
  }

  return kb;
}

function buildLobbyText(players: { displayName: string }[], maxPlayers: number): string {
  const names = players.map(p => p.displayName).join(", ");
  return `Guzman samlar ligan...\n\n` +
    `${players.length}/${maxPlayers} spelare: ${names}\n\n` +
    `Tryck "Jag ar med!" for att hoppa in, bre.`;
}
```

### Pattern 2: Callback Query with Regex Prefix Matching
**What:** Use regex patterns in `callbackQuery()` to match structured callback data like `join:{gameId}`.
**When to use:** When buttons carry payload data beyond a simple action name.
**Example:**
```typescript
// Source: grammY docs - callbackQuery supports string | RegExp
const lobby = new Composer();

lobby.callbackQuery(/^join:(.+)$/, async (ctx) => {
  const gameId = ctx.match[1]; // captured group from regex
  await ctx.answerCallbackQuery();
  // ... handle join logic
});

lobby.callbackQuery(/^leave:(.+)$/, async (ctx) => {
  const gameId = ctx.match[1];
  await ctx.answerCallbackQuery();
  // ... handle leave logic
});
```

### Pattern 3: Database-First State with Optimistic UI
**What:** All lobby state lives in Supabase. On each button click: read DB -> validate -> write DB -> re-render message.
**When to use:** Any multi-user interactive state where concurrent access is possible.
**Example:**
```typescript
// Pseudo-code for join handler
async function handleJoin(gameId: string, userId: number, ctx: CallbackQueryContext) {
  // 1. Check if game exists and is in lobby state
  const game = await getGame(gameId);
  if (!game || game.state !== "lobby") {
    return ctx.answerCallbackQuery({ text: "Spelet ar inte oppet langre, bre." });
  }

  // 2. Check player count (max 10)
  const players = await getGamePlayers(gameId);
  if (players.length >= 10) {
    return ctx.answerCallbackQuery({ text: "Fullt, bre! Max 10 spelare." });
  }

  // 3. Check player is registered (has /start'd)
  const player = await getPlayerByTelegramId(userId);
  if (!player) {
    return ctx.answerCallbackQuery({ text: "Du maste /start'a boten forst!" });
  }

  // 4. Insert into game_players (upsert to handle double-clicks)
  await addPlayerToGame(gameId, player.id);

  // 5. Re-read players and update lobby message
  const updatedPlayers = await getGamePlayers(gameId);
  const text = buildLobbyText(updatedPlayers, 10);
  const keyboard = buildLobbyKeyboard(gameId, isAdmin, updatedPlayers.length);

  try {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } catch (err) {
    // Ignore "message is not modified" -- happens on double-click race
    if (!isMessageNotModifiedError(err)) throw err;
  }
}
```

### Pattern 4: Role Assignment with Fisher-Yates + crypto.randomInt
**What:** Cryptographically secure shuffle of player array, then slice into role groups per the balancing table.
**When to use:** Assigning roles where fairness matters.
**Example:**
```typescript
import { randomInt } from "node:crypto";

// Balancing table from PROJECT.md
const ROLE_BALANCING: Record<number, { golare: number; akta: number; teamSize: number }> = {
  4:  { golare: 1, akta: 3, teamSize: 2 },
  5:  { golare: 1, akta: 4, teamSize: 2 },
  6:  { golare: 2, akta: 4, teamSize: 3 },
  7:  { golare: 2, akta: 5, teamSize: 3 },
  8:  { golare: 2, akta: 6, teamSize: 3 },
  9:  { golare: 3, akta: 6, teamSize: 4 },
  10: { golare: 3, akta: 7, teamSize: 4 },
};

function cryptoShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1); // crypto-secure
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

type RoleAssignment = {
  playerId: string;
  role: "akta" | "golare" | "hogra_hand";
};

function assignRoles(playerIds: string[]): RoleAssignment[] {
  const count = playerIds.length;
  const balancing = ROLE_BALANCING[count];
  if (!balancing) throw new Error(`No balancing for ${count} players`);

  const shuffled = cryptoShuffle(playerIds);

  // First N are Golare
  const golare = shuffled.slice(0, balancing.golare);
  // Remaining are Akta
  const akta = shuffled.slice(balancing.golare);
  // One random Akta becomes Hogra Hand
  const hograHandIndex = randomInt(0, akta.length);
  const hograHandId = akta[hograHandIndex];

  return shuffled.map((id) => ({
    playerId: id,
    role: golare.includes(id)
      ? "golare"
      : id === hograHandId
        ? "hogra_hand"
        : "akta",
  }));
}
```

### Anti-Patterns to Avoid
- **In-memory lobby state:** Never store lobby state in a variable/Map. The bot could restart, and concurrent callback queries create race conditions. Always read from and write to Supabase.
- **Direct bot.api.sendMessage for group messages:** All group messages must go through `MessageQueue.send()` to respect the 20 msg/min rate limit. Exception: `ctx.editMessageText()` is fine because it edits an existing message, not sending a new one.
- **Staggered role DMs:** The user decided "all role DMs sent simultaneously." Send all DMs in a `Promise.all()` or parallel queue submissions, not sequentially with delays.
- **Blocking on editMessageText errors:** "Message not modified" (400) errors are expected when two players click join at nearly the same time. Catch and ignore this specific error.
- **Callback data > 64 bytes:** Telegram limits callback_data to 1-64 bytes. Keep payloads short (e.g., `join:abc123` not `join_game:some-very-long-uuid-string`). Use short hash IDs if UUIDs are too long.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Callback data routing | Custom string parsing/switch | grammY `callbackQuery(/regex/)` | Built-in regex matching with capture groups, type-safe |
| Message formatting | Manual string escaping | HTML parse_mode (not MarkdownV2) | HTML is simpler to construct, fewer escaping pitfalls than MarkdownV2 |
| Rate limiting | Custom throttle logic | Existing MessageQueue + auto-retry plugin | Already built in Phase 1, tested and working |
| Random number generation | Math.random() | `crypto.randomInt()` from Node.js | Cryptographically secure, built-in, no dependency |
| Admin permission check | Manual user lookup | `ctx.getChatMember(userId)` then check `.status` | Telegram API returns `creator` or `administrator` status directly |

**Key insight:** Phase 2 is mostly composition of existing pieces. grammY already has everything needed for inline keyboards, callback queries, and message editing. Supabase already has the client. The MessageQueue already handles rate limiting. The main new code is the game logic layer (schema, role assignment, message templates).

## Common Pitfalls

### Pitfall 1: Concurrent Join/Leave Race Condition
**What goes wrong:** Two players click "Jag ar med!" at the same time. Both handlers read the same player list from DB, both add themselves, both write back -- but one write overwrites the other, losing a player.
**Why it happens:** Classic read-modify-write race condition.
**How to avoid:** Use INSERT with ON CONFLICT (game_id, player_id) DO NOTHING for joins, and DELETE for leaves. These are atomic at the database level. After the write, re-read the full player list to render the updated message. The separate game_players join table makes this natural -- each join is an independent INSERT, not an update to a shared array.
**Warning signs:** Players reporting they clicked join but aren't in the lobby; player count flickering.

### Pitfall 2: "Message Not Modified" Error on Lobby Update
**What goes wrong:** `ctx.editMessageText()` throws a 400 error when the new text+keyboard is identical to the current one.
**Why it happens:** Two near-simultaneous joins: both read the same state, both try to edit to the same new state. The second edit fails because the message already has that content.
**How to avoid:** Catch the error and check if it's "message is not modified" -- if so, silently ignore it. The message is already correct.
**Warning signs:** Uncaught 400 errors in logs, bot error handler firing on benign state.

### Pitfall 3: Callback Data Exceeding 64 Bytes
**What goes wrong:** Inline button stops working or callback never fires.
**Why it happens:** Telegram silently truncates or rejects callback_data longer than 64 bytes. A UUID (36 chars) + prefix is fine, but composite payloads can exceed the limit.
**How to avoid:** Use short prefixes (`join:`, `leave:`, `start:`, `rules:`, `cancel:`) and compact IDs. If game IDs are UUIDs (36 bytes), the total `join:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` is 41 bytes -- safely under 64. If needed, use short IDs (e.g., nanoid or first 8 chars of UUID).
**Warning signs:** Buttons that do nothing when clicked; no callback query reaching the bot.

### Pitfall 4: Player Hasn't /start'd the Bot (Can't Receive DM)
**What goes wrong:** Role reveal DM fails with "Forbidden: bot can't initiate conversation with a user" error.
**Why it happens:** A player joined the group game but never /start'd the bot privately.
**How to avoid:** On join, verify the player exists in the `players` table (which requires /start). If not registered, show an answerCallbackQuery toast: "Du maste starta boten forst! Klicka har: [deep link]". Only players in the `players` table can join games.
**Warning signs:** DM send failures after game start; players not receiving their role.

### Pitfall 5: Admin Leaves the Group or Isn't Actually Admin
**What goes wrong:** Non-admin user starts a game, or admin leaves but game is stuck.
**Why it happens:** Not verifying Telegram group admin status, or storing admin at game creation but not re-checking.
**How to avoid:** On `/nyttspel`, call `ctx.getChatMember(ctx.from.id)` and verify `.status` is `"creator"` or `"administrator"`. Store the admin's user ID on the game record. For `/avbryt`, re-verify admin status or allow the original game creator.
**Warning signs:** Random users starting games; orphaned lobbies with no admin.

### Pitfall 6: Multiple Active Games in Same Group
**What goes wrong:** Admin types /nyttspel while another game is already active -- creates duplicate game state.
**Why it happens:** No check for existing active game in the group.
**How to avoid:** On `/nyttspel`, query for any game in this group_chat_id where state is not `"finished"` or `"cancelled"`. If found, reply with error ("Det finns redan ett spel igang, bre!").
**Warning signs:** Duplicate lobby messages; confused state; players in two games simultaneously.

### Pitfall 7: editMessageText on Messages Sent via MessageQueue
**What goes wrong:** The lobby message is sent through `MessageQueue.send()`, which returns a `Message.TextMessage`. You need the `message_id` from this return value to edit the message later. If you don't store it, you can't edit the lobby.
**Why it happens:** MessageQueue.send() returns a promise that resolves to the sent message. You must await it and store `result.message_id` and `chat_id` in the database (on the game record).
**How to avoid:** Store `lobby_message_id` on the game row in Supabase. The callback query handler can then use `ctx.api.editMessageText(chatId, messageId, text, options)` -- or, even simpler, since the callback comes FROM the lobby message itself, `ctx.editMessageText(text, options)` already knows which message to edit.
**Warning signs:** "Message not found" errors; lobby not updating.

## Code Examples

### Database Schema for Games and Game Players
```sql
-- Source: Project-specific design based on requirements
-- Games table: one row per game instance
CREATE TABLE IF NOT EXISTS games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id    BIGINT NOT NULL,
  admin_user_id    BIGINT NOT NULL,
  lobby_message_id BIGINT,           -- Telegram message_id of the lobby message
  state            TEXT NOT NULL DEFAULT 'lobby',
  -- state: lobby -> active -> finished | cancelled
  round            INT NOT NULL DEFAULT 0,
  ligan_score      INT NOT NULL DEFAULT 0,
  aina_score       INT NOT NULL DEFAULT 0,
  team_size        INT,              -- Set when game starts, from balancing table
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_active_game_per_group UNIQUE (group_chat_id) -- enforced at app level, not DB (games can be cancelled)
);

-- Remove the unique constraint and use a partial unique index instead:
-- Only one non-finished/non-cancelled game per group at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_game_per_group
  ON games (group_chat_id) WHERE state NOT IN ('finished', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_games_group_chat_id ON games (group_chat_id);

-- Game players: join table linking players to games with roles
CREATE TABLE IF NOT EXISTS game_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role        TEXT,  -- NULL during lobby, set to 'akta'|'golare'|'hogra_hand' at game start
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_player_per_game UNIQUE (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players (game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players (player_id);

-- Reuse the update_updated_at_column() trigger from Phase 1 for games table
CREATE OR REPLACE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### TypeScript Types for Game Schema
```typescript
// Source: Matching the SQL schema above
// Following Phase 1 pattern: type aliases, not interfaces

export type GameState = "lobby" | "active" | "finished" | "cancelled";
export type PlayerRole = "akta" | "golare" | "hogra_hand";

export type Game = {
  id: string;
  group_chat_id: number;
  admin_user_id: number;
  lobby_message_id: number | null;
  state: GameState;
  round: number;
  ligan_score: number;
  aina_score: number;
  team_size: number | null;
  created_at: string;
  updated_at: string;
};

export type GameInsert = {
  group_chat_id: number;
  admin_user_id: number;
  lobby_message_id?: number | null;
  state?: GameState;
};

export type GamePlayer = {
  id: string;
  game_id: string;
  player_id: string;
  role: PlayerRole | null;
  joined_at: string;
};

export type GamePlayerInsert = {
  game_id: string;
  player_id: string;
  role?: PlayerRole | null;
};
```

### Admin Check Pattern
```typescript
// Source: grammY docs - getChatMember + Telegram Bot API
async function isGroupAdmin(ctx: Context, chatId: number, userId: number): Promise<boolean> {
  try {
    const member = await ctx.api.getChatMember(chatId, userId);
    return member.status === "creator" || member.status === "administrator";
  } catch {
    return false;
  }
}
```

### Lobby Handler Registration Pattern
```typescript
// Source: Phase 1 pattern (Composer) + grammY docs
import { Composer } from "grammy";

export const lobbyHandler = new Composer();

// /nyttspel command -- group chat only
lobbyHandler.chatType(["group", "supergroup"]).command("nyttspel", async (ctx) => {
  // 1. Verify admin
  // 2. Check no active game
  // 3. Create game in DB
  // 4. Send lobby message with inline keyboard via MessageQueue
  // 5. Store lobby_message_id on game record
});

// Callback queries with regex matching
lobbyHandler.callbackQuery(/^join:(.+)$/, handleJoin);
lobbyHandler.callbackQuery(/^leave:(.+)$/, handleLeave);
lobbyHandler.callbackQuery(/^start:(.+)$/, handleStart);
```

### Handling "Message Not Modified" Error
```typescript
// Source: Telegram Bot API behavior + community best practice
function isMessageNotModifiedError(err: unknown): boolean {
  if (err && typeof err === "object" && "description" in err) {
    return String((err as { description: string }).description)
      .includes("message is not modified");
  }
  return false;
}

// Usage in callback handler:
try {
  await ctx.editMessageText(newText, { reply_markup: newKeyboard });
} catch (err) {
  if (!isMessageNotModifiedError(err)) throw err;
  // Silently ignore -- message already has the correct content
}
```

### Parallel DM Delivery for Role Reveals
```typescript
// Source: Project pattern (MessageQueue) + user decision (simultaneous DMs)
async function sendRoleReveals(
  assignments: RoleAssignment[],
  playerDmChatIds: Map<string, number>,  // playerId -> dm_chat_id
  golarePlayerNames: Map<string, string> // playerId -> display name (for Golare list)
): Promise<void> {
  const queue = getMessageQueue();

  const dmPromises = assignments.map(async (assignment) => {
    const dmChatId = playerDmChatIds.get(assignment.playerId);
    if (!dmChatId) return; // shouldn't happen if we validated on join

    let message: string;
    switch (assignment.role) {
      case "golare": {
        const otherGolare = assignments
          .filter(a => a.role === "golare" && a.playerId !== assignment.playerId)
          .map(a => golarePlayerNames.get(a.playerId) ?? "Okand")
          .join(", ");
        message = MESSAGES.ROLE_REVEAL_GOLARE(otherGolare);
        break;
      }
      case "hogra_hand":
        message = MESSAGES.ROLE_REVEAL_HOGRA_HAND;
        break;
      case "akta":
      default:
        message = MESSAGES.ROLE_REVEAL_AKTA;
        break;
    }

    // DMs go through queue -- each DM chat has its own queue lane
    await queue.send(dmChatId, message);
  });

  await Promise.all(dmPromises);
}
```

### Paginated /regler with Inline Buttons
```typescript
// Source: grammY InlineKeyboard + user decision (paginated rules)
const RULES_PAGES = ["roller", "spelgang", "vinst"] as const;
type RulesPage = typeof RULES_PAGES[number];

function buildRulesKeyboard(currentPage: RulesPage): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const page of RULES_PAGES) {
    const label = page === currentPage ? `[${page.toUpperCase()}]` : page.charAt(0).toUpperCase() + page.slice(1);
    kb.text(label, `rules:${page}`);
  }
  return kb;
}

// Handler for /regler
gameCommands.command("regler", async (ctx) => {
  const text = MESSAGES.RULES_PAGE("roller"); // default first page
  const kb = buildRulesKeyboard("roller");
  await ctx.reply(text, { reply_markup: kb, parse_mode: "HTML" });
});

// Handler for rules page navigation
gameCommands.callbackQuery(/^rules:(.+)$/, async (ctx) => {
  const page = ctx.match[1] as RulesPage;
  if (!RULES_PAGES.includes(page)) return ctx.answerCallbackQuery();
  await ctx.answerCallbackQuery();
  const text = MESSAGES.RULES_PAGE(page);
  const kb = buildRulesKeyboard(page);
  try {
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: "HTML" });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) throw err;
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Telegraf for Telegram bots | grammY (v1.40) | Telegraf EOL Feb 2025 | grammY is the actively maintained option with better TS |
| Math.random() for shuffling | crypto.randomInt() | Node.js 14.10+ | Cryptographically fair shuffling, no extra dependency |
| MarkdownV2 for message formatting | HTML parse_mode | Ongoing preference | HTML is easier to construct, fewer escaping issues |
| In-memory game state | Database-first (Supabase) | Project decision | Survives restarts, prevents race conditions |

**Deprecated/outdated:**
- `ctx.editMessageText()` in grammY v1.x: Fully supported, no deprecation. The context shortcut works correctly in callback query handlers.
- Telegram Bot API `callback_data` limit: Still 1-64 bytes as of Bot API 9.4 (latest). No plans to increase.

## Open Questions

1. **Short game IDs vs full UUIDs in callback data**
   - What we know: UUIDs are 36 chars. Prefix + UUID = ~42 bytes, under the 64-byte limit.
   - What's unclear: Whether to use full UUIDs or generate shorter IDs (nanoid, 8-char hash).
   - Recommendation: Use full UUIDs. `join:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` is 41 bytes, safely under 64. Simpler than maintaining a separate short-ID scheme. Only optimize if we add more complex callback payloads later.

2. **Should /regler and /status in DM show role info?**
   - What we know: User decided "in DM may show extra info like your role and abilities."
   - What's unclear: How to look up which active game the DM user is in (they could be in multiple groups).
   - Recommendation: Query game_players for the user's player_id where game state is "active". If exactly one match, show role info. If multiple (unlikely in v1 since one game per group), show a note that role info is available per game. For Phase 2, assume one active game per player.

3. **What happens to the lobby message after game starts?**
   - What we know: Lobby message has join/leave/start buttons. After game starts, these should no longer work.
   - What's unclear: Should we edit the lobby message to remove buttons, or leave it?
   - Recommendation: Edit the lobby message one final time to show "Spelet har borjat!" with no inline keyboard (remove buttons). This prevents confusion from stale buttons.

## Sources

### Primary (HIGH confidence)
- grammY official docs (grammy.dev) - InlineKeyboard, Composer, callbackQuery, Context shortcuts, filter queries, parse-mode plugin
- Telegram Bot API (core.telegram.org/bots/api) - editMessageText, callback_data 64-byte limit, getChatMember, InlineKeyboardButton
- Node.js crypto module (nodejs.org/api/crypto.html) - crypto.randomInt() for secure random integers

### Secondary (MEDIUM confidence)
- Supabase docs (supabase.com/docs/reference/javascript) - upsert, rpc, insert, select, TypeScript support
- Community patterns for handling "message not modified" errors (GitHub issues, Stack Overflow)
- grammY plugin ecosystem (auto-retry, transformer-throttler, parse-mode)

### Tertiary (LOW confidence)
- Concurrent callback query race condition patterns -- no grammY-specific documentation found; recommendation based on general database concurrency patterns and Telegram bot community experience

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use from Phase 1, well-documented
- Architecture: HIGH - Patterns are well-established in Telegram bot development (lobby message, inline keyboards, callback queries)
- Database schema: HIGH - Straightforward relational design, follows Supabase patterns from Phase 1
- Role assignment: HIGH - Fisher-Yates shuffle with crypto.randomInt() is textbook, balancing table is defined
- Concurrency handling: MEDIUM - Database-level INSERT/DELETE atomicity is standard, but testing concurrent callback queries needs real-world verification
- Pitfalls: HIGH - "Message not modified" error and 64-byte callback data limit are very well-documented

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain -- grammY and Telegram Bot API change slowly)
