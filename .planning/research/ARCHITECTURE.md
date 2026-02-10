# Architecture Research

**Domain:** Telegram Bot Social Deduction Game with AI Game Master
**Researched:** 2026-02-10
**Confidence:** HIGH (Telegraf, Supabase, OpenAI patterns well-documented; game state machine is custom but follows established FSM patterns)

---

## System Overview

```
+-------------------+       +-------------------+       +-------------------+
|   Telegram API    |       |   Bot Application |       |    Supabase       |
|                   |       |                   |       |                   |
| Group Chat -------|------>| Telegraf Router    |       | games             |
|  (public msgs,    |       |   |               |       | players           |
|   /commands,      |       |   +-> Middleware   |       | rounds            |
|   inline buttons) |       |   |   Chain        |       | votes             |
|                   |       |   |               |       | chat_history      |
| Private Chat -----|------>|   +-> Game Engine  |<----->|                   |
|  (role reveals,   |       |   |   (State       |       +-------------------+
|   secret votes,   |       |   |    Machine)    |
|   whispers)       |       |   |               |       +-------------------+
|                   |       |   +-> AI Service   |<----->|   OpenAI API      |
|                   |<------| (outbound msgs)   |       |   (GPT-4o)        |
+-------------------+       +-------------------+       +-------------------+
                                    |
                                    v
                             +-------------+
                             |  Scheduler   |
                             |  (node-cron) |
                             +-------------+
```

### Data Flow Summary

1. **Inbound:** Telegram sends updates (messages, callback queries) to bot via long polling
2. **Routing:** Telegraf middleware chain identifies update type, extracts chat context
3. **State lookup:** Game engine loads game state from Supabase by `chatId`
4. **Processing:** Game engine validates action against current state, transitions state machine
5. **AI generation:** When narrative is needed, AI service builds prompt from game state and calls OpenAI
6. **Outbound:** Bot sends messages back to group chat (public) and/or private chats (secret)
7. **Persistence:** Updated game state is written back to Supabase
8. **Scheduled:** node-cron triggers phase transitions at fixed daily times (09:00, 12:00, 15:00, 18:00, 21:00)

---

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Telegraf Router** | Receives Telegram updates, routes to handlers, manages middleware chain | Telegram API, Middleware, Handlers |
| **Middleware Chain** | Auth, logging, error handling, game context injection | Router, Game Engine |
| **Command Handlers** | Process `/start`, `/join`, `/status` etc. | Game Engine, Message Sender |
| **Callback Handlers** | Process inline button presses (votes, actions) | Game Engine, Message Sender |
| **Game Engine** | Core game logic, state machine, rule enforcement | Supabase, AI Service, Message Sender |
| **State Machine** | Defines valid game phases and transitions | Game Engine |
| **AI Service** | Builds prompts, calls OpenAI, parses responses | OpenAI API, Game Engine |
| **Message Sender** | Formats and sends messages to group/private chats with inline keyboards | Telegram API |
| **Scheduler** | Triggers timed phase transitions | Game Engine |
| **Supabase Client** | CRUD operations for game state, players, rounds, votes | Supabase |

---

## Recommended Project Structure

```
src/
├── index.ts                  # Entry point: bot setup, middleware registration, launch
├── bot/
│   ├── middleware/
│   │   ├── error-handler.ts  # Global error catching, user-friendly error messages
│   │   ├── game-context.ts   # Loads game state from DB, attaches to ctx.state
│   │   └── auth.ts           # Validates user is player in game, rate limiting
│   ├── handlers/
│   │   ├── commands.ts       # /start, /join, /leave, /status, /rules
│   │   ├── callbacks.ts      # Inline button callbacks (vote_ja, vote_nej, etc.)
│   │   └── messages.ts       # Free-text message handling (whispers, game chat)
│   └── keyboards.ts          # Inline keyboard builders (vote buttons, action buttons)
├── game/
│   ├── engine.ts             # Core game loop: receives events, processes against state
│   ├── state-machine.ts      # Phase definitions, valid transitions, guards
│   ├── phases/
│   │   ├── lobby.ts          # Pre-game: joining, role assignment
│   │   ├── mission.ts        # Capo selects team for mission
│   │   ├── nomination.ts     # Team nomination announcement
│   │   ├── voting.ts         # JA/NEJ vote on team composition
│   │   ├── execution.ts      # Team members choose Sakra/Gola secretly
│   │   └── result.ts         # Round result, score update, win check
│   ├── roles.ts              # Role definitions (AKTA, GOLARE), abilities
│   └── rules.ts              # Team size requirements, win conditions, constants
├── ai/
│   ├── service.ts            # OpenAI client wrapper, prompt builder, response parser
│   ├── prompts/
│   │   ├── system.ts         # Game master persona, tone, language rules
│   │   ├── narration.ts      # Phase transition narration templates
│   │   └── context-builder.ts # Builds game state summary for AI context window
│   └── types.ts              # AI response schemas (structured output types)
├── db/
│   ├── client.ts             # Supabase client initialization
│   ├── queries/
│   │   ├── games.ts          # Game CRUD: create, get, update, delete
│   │   ├── players.ts        # Player management: join, leave, role assignment
│   │   ├── rounds.ts         # Round data: missions, votes, results
│   │   └── chat-history.ts   # Message log for AI context
│   └── types.ts              # Database row types (generated or manual)
├── scheduler/
│   ├── cron.ts               # node-cron job definitions for daily triggers
│   └── phase-trigger.ts      # Logic: which games need phase advancement
├── messages/
│   ├── sender.ts             # Abstraction over ctx.telegram.sendMessage
│   ├── formatter.ts          # Message text formatting (Markdown, player mentions)
│   └── templates.ts          # Reusable message templates
├── config/
│   ├── env.ts                # Environment variable validation and export
│   └── constants.ts          # Game constants (team sizes, timings, etc.)
└── types/
    ├── game.ts               # Game state interfaces
    ├── telegram.ts           # Extended Telegraf context types
    └── index.ts              # Re-exports
```

### Rationale for Structure

- **`bot/` vs `game/`:** Strict separation between Telegram-specific code and game logic. The game engine knows nothing about Telegram -- it receives typed events and returns typed actions. This makes the game logic testable without Telegram.
- **`game/phases/`:** Each phase is its own module because phase logic is where complexity concentrates. A phase module exports: entry actions, valid player actions, exit conditions, and transition targets.
- **`ai/prompts/`:** Prompt engineering is iterative. Keeping prompts in dedicated files makes them easy to tweak without touching service logic.
- **`db/queries/`:** Thin query layer over Supabase. Keeps SQL/Supabase-specific code contained.
- **`messages/`:** Message formatting separated from bot handlers. The game engine decides WHAT to say; the message layer decides HOW to format it for Telegram.

---

## Architectural Patterns

### Pattern 1: Event-Driven Game Engine (Use This)

The game engine should be a pure function-like module: it receives an event and the current game state, and returns the new state plus a list of side effects (messages to send, DB writes to make).

```typescript
// game/engine.ts
interface GameEvent {
  type: 'PLAYER_JOIN' | 'VOTE_CAST' | 'PHASE_TIMEOUT' | 'TEAM_SELECTED' | ...;
  playerId: number;
  chatId: string;
  payload: Record<string, unknown>;
}

interface GameAction {
  type: 'SEND_GROUP_MSG' | 'SEND_PRIVATE_MSG' | 'UPDATE_STATE' | 'TRIGGER_AI';
  target?: number | string;  // chatId or userId
  data: Record<string, unknown>;
}

async function processGameEvent(
  event: GameEvent,
  currentState: GameState
): Promise<{ newState: GameState; actions: GameAction[] }> {
  // Validate event is legal in current phase
  // Apply state transition
  // Generate list of actions (messages, DB updates)
  // Return new state + actions
}
```

**Why:** This pattern makes game logic testable, predictable, and independent of Telegram. You can unit test state transitions without mocking Telegram APIs. The handler layer translates Telegram updates into `GameEvent`s and executes returned `GameAction`s.

### Pattern 2: Middleware-Based Context Injection

Load game state early in the middleware chain so all handlers have access to it.

```typescript
// bot/middleware/game-context.ts
import { Context } from 'telegraf';

interface GameContext extends Context {
  gameState?: GameState;
  isActiveGame: boolean;
  currentPlayer?: Player;
}

async function gameContextMiddleware(ctx: GameContext, next: () => Promise<void>) {
  const chatId = ctx.chat?.id?.toString();
  if (!chatId) return next();

  const game = await db.games.getActiveGame(chatId);
  ctx.gameState = game ?? undefined;
  ctx.isActiveGame = !!game;

  if (ctx.from && game) {
    ctx.currentPlayer = game.players.find(p => p.id === ctx.from!.id);
  }

  return next();
}
```

**Why:** Every handler needs game state. Loading it once in middleware avoids duplicate DB queries and ensures consistent state across the handler chain.

### Pattern 3: Chat-Keyed State Isolation (not user-keyed)

Do NOT use Telegraf's built-in session middleware for game state. It defaults to `userId:chatId` keys and has documented race condition issues with concurrent access. Instead, use Supabase as the single source of truth, keyed by `chatId`.

```typescript
// Each game is isolated by group chat ID
const game = await supabase
  .from('games')
  .select('*')
  .eq('chat_id', chatId)
  .eq('status', 'active')
  .single();
```

**Why:** Telegraf sessions are in-memory by default, lost on restart, and suffer from race conditions when multiple users in the same group chat send concurrent messages. Database-backed state keyed by `chatId` gives you persistence, crash recovery, and atomic updates.

### Pattern 4: Dual-Channel Message Dispatch

The bot must send messages to two types of chats: group (public game events) and private DMs (secret roles, votes). Abstract this into a message dispatcher.

```typescript
// messages/sender.ts
import { Telegram } from 'telegraf';

class MessageSender {
  constructor(private telegram: Telegram) {}

  async toGroup(chatId: string, text: string, keyboard?: InlineKeyboard) {
    await this.telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  async toPlayer(userId: number, text: string, keyboard?: InlineKeyboard) {
    // IMPORTANT: User must have /start'd the bot first for this to work
    try {
      await this.telegram.sendMessage(userId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      // Handle "Forbidden: bot can't initiate conversation" gracefully
      // Queue a group message asking user to start the bot in DM
    }
  }

  async toAllPlayers(players: Player[], text: string) {
    await Promise.allSettled(
      players.map(p => this.toPlayer(p.id, text))
    );
  }
}
```

**Why:** Group messages are guaranteed to work (bot is in the group). Private messages require the user to have started a conversation with the bot first -- this is a Telegram API restriction. The sender must handle this gracefully.

### Pattern 5: Scheduled Phase Advancement via Database Scan

node-cron triggers at fixed times but has no persistence -- if the process restarts, jobs re-register but missed triggers are lost. The scheduler should scan the database for games needing advancement rather than tracking state in memory.

```typescript
// scheduler/phase-trigger.ts
import cron from 'node-cron';

function setupScheduler(gameEngine: GameEngine, telegram: Telegram) {
  // Every trigger time: 09:00, 12:00, 15:00, 18:00, 21:00
  const triggerTimes = ['0 9 * * *', '0 12 * * *', '0 15 * * *', '0 18 * * *', '0 21 * * *'];

  for (const schedule of triggerTimes) {
    cron.schedule(schedule, async () => {
      // Query ALL active games that need phase advancement
      const games = await db.games.getGamesNeedingAdvancement();

      for (const game of games) {
        const event: GameEvent = {
          type: 'PHASE_TIMEOUT',
          chatId: game.chatId,
          playerId: 0,  // system event
          payload: { triggeredAt: new Date().toISOString() },
        };
        const { newState, actions } = await gameEngine.process(event, game);
        await executeActions(actions, telegram);
        await db.games.update(game.chatId, newState);
      }
    }, { timezone: 'Europe/Stockholm' });
  }
}
```

**Why:** Database-driven scheduling is crash-resilient. On restart, the next cron tick picks up any games that were missed. No in-memory job state to lose.

---

## State Machine Design

### Game Lifecycle Phases

```
                    +----------+
                    |  IDLE    |  (No active game in this chat)
                    +----+-----+
                         |  /startgame
                         v
                    +----------+
                    |  LOBBY   |  (Players /join, wait for minimum)
                    +----+-----+
                         |  /begin (enough players)
                         v
              +---------+----------+---------+
              |         ACTIVE GAME          |
              |                              |
              |  +--------+                  |
              |  | MISSION |<-----------+    |
              |  +----+----+            |    |
              |       | Capo selects    |    |
              |       v                 |    |
              |  +----------+           |    |
              |  |NOMINATION|           |    |
              |  +----+-----+           |    |
              |       | Scheduled       |    |
              |       v                 |    |
              |  +--------+            |    |
              |  | VOTING  |           |    |
              |  +----+----+           |    |
              |       | All voted      |    |
              |       v                |    |
              |  +-----------+   FAIL  |    |
              |  | EXECUTION |---->----+    |
              |  +-----+-----+   (vote     |
              |        | Team    rejected)  |
              |        | acts              |
              |        v                   |
              |  +--------+                |
              |  | RESULT  |----->---------+
              |  +----+----+  (next round)
              |       |
              |       | Win condition met
              +---------+----------+---------+
                         |
                         v
                    +----------+
                    |  ENDED   |  (Game over, scores shown)
                    +----------+
```

### State Machine Implementation (Custom, Not XState)

**Recommendation:** Use a custom lightweight state machine rather than XState. XState v5 is powerful but introduces significant conceptual overhead (actors, invoked services, spawned children) that is overkill for a turn-based game where all transitions are triggered by discrete events (user actions or cron ticks). A simple discriminated union + transition map is more maintainable and easier to debug.

```typescript
// game/state-machine.ts

type GamePhase = 'IDLE' | 'LOBBY' | 'MISSION' | 'NOMINATION' | 'VOTING' | 'EXECUTION' | 'RESULT' | 'ENDED';

interface PhaseTransition {
  from: GamePhase;
  event: string;
  guard?: (state: GameState) => boolean;
  to: GamePhase;
  onTransition?: (state: GameState) => GameAction[];
}

const transitions: PhaseTransition[] = [
  {
    from: 'IDLE',
    event: 'START_GAME',
    to: 'LOBBY',
  },
  {
    from: 'LOBBY',
    event: 'BEGIN_GAME',
    guard: (s) => s.players.length >= 5,
    to: 'MISSION',
    onTransition: (s) => [
      { type: 'ASSIGN_ROLES', data: {} },
      { type: 'SEND_PRIVATE_ROLES', data: {} },
      { type: 'TRIGGER_AI', data: { prompt: 'game_start_narration' } },
    ],
  },
  {
    from: 'MISSION',
    event: 'TEAM_SELECTED',
    guard: (s) => s.selectedTeam.length === getRequiredTeamSize(s),
    to: 'NOMINATION',
  },
  {
    from: 'NOMINATION',
    event: 'PHASE_TIMEOUT',
    to: 'VOTING',
    onTransition: (s) => [
      { type: 'SEND_VOTE_BUTTONS', data: {} },
    ],
  },
  {
    from: 'VOTING',
    event: 'ALL_VOTES_IN',
    guard: (s) => s.votes.length === s.players.length,
    to: 'EXECUTION',
  },
  {
    from: 'VOTING',
    event: 'VOTE_REJECTED',
    to: 'MISSION',  // rotate Capo, try again
  },
  {
    from: 'EXECUTION',
    event: 'ALL_ACTIONS_IN',
    to: 'RESULT',
  },
  {
    from: 'RESULT',
    event: 'NEXT_ROUND',
    guard: (s) => !checkWinCondition(s),
    to: 'MISSION',
  },
  {
    from: 'RESULT',
    event: 'GAME_OVER',
    guard: (s) => checkWinCondition(s),
    to: 'ENDED',
  },
];

function transition(state: GameState, event: string): {
  newPhase: GamePhase;
  actions: GameAction[];
} | null {
  const t = transitions.find(
    t => t.from === state.phase && t.event === event && (!t.guard || t.guard(state))
  );
  if (!t) return null;  // Invalid transition
  return {
    newPhase: t.to,
    actions: t.onTransition?.(state) ?? [],
  };
}
```

**Why custom over XState:** The game has ~8 states and ~10 transitions. XState's actor model, parallel states, and history states are unnecessary. A flat transition table is readable by any developer, trivially serializable to the database, and requires zero additional dependencies. If the game later grows to need hierarchical/parallel states (unlikely for a social deduction game), migration to XState is straightforward since the state/event model is compatible.

---

## Database Schema Design

### Use Relational Tables, Not a Single JSONB Blob

While it is tempting to store the entire game state as a single JSONB column (matching the PDR data structure), use normalized relational tables instead. JSONB makes queries like "find all games where player X is active" extremely difficult and prevents Supabase RLS (Row Level Security) from working at the row level.

```sql
-- Core game table
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby',  -- lobby, active, ended
  phase TEXT NOT NULL DEFAULT 'LOBBY',
  current_round INTEGER NOT NULL DEFAULT 0,
  score_akta INTEGER NOT NULL DEFAULT 0,
  score_golare INTEGER NOT NULL DEFAULT 0,
  capo_index INTEGER NOT NULL DEFAULT 0,
  phase_data JSONB DEFAULT '{}',  -- Phase-specific transient data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players in games
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  telegram_id BIGINT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT,                        -- AKTA, GOLARE (null until game starts)
  is_capo BOOLEAN DEFAULT FALSE,
  has_started_bot BOOLEAN DEFAULT FALSE,  -- Track DM capability
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, telegram_id)
);

-- Round history
CREATE TABLE rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  capo_telegram_id BIGINT NOT NULL,
  team_members BIGINT[] NOT NULL DEFAULT '{}',
  vote_result TEXT,                 -- approved, rejected
  mission_result TEXT,              -- success, fail
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual votes (JA/NEJ on team composition)
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  player_telegram_id BIGINT NOT NULL,
  vote TEXT NOT NULL,               -- ja, nej
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, player_telegram_id)
);

-- Mission actions (Sakra/Gola by team members)
CREATE TABLE mission_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
  player_telegram_id BIGINT NOT NULL,
  action TEXT NOT NULL,             -- sakra, gola
  acted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, player_telegram_id)
);

-- Chat history for AI context
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,             -- 'system', 'ai', telegram_id as string
  content TEXT NOT NULL,
  phase TEXT,
  round_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### The `phase_data` JSONB Column

The one place JSONB is appropriate: transient phase-specific data that varies per phase and does not need querying. For example, during the MISSION phase, `phase_data` stores `{ selectedTeam: [12345, 67890] }`. During VOTING, it stores `{ deadline: "2026-02-10T15:00:00Z" }`. This avoids proliferating columns for ephemeral state.

---

## AI Integration Architecture

### Context Window Management

GPT-4o has a 128K token context window, but cost and latency scale with token count. Use a **rolling summary** strategy.

```typescript
// ai/context-builder.ts

async function buildAIContext(game: GameState, recentHistory: ChatMessage[]): Promise<OpenAI.ChatCompletionMessageParam[]> {
  return [
    {
      role: 'system',
      content: buildSystemPrompt(),  // ~500 tokens, static persona definition
    },
    {
      role: 'system',
      content: buildGameStateSummary(game),  // ~200 tokens, structured current state
    },
    // Last 10-15 messages as conversation history
    ...recentHistory.slice(-15).map(msg => ({
      role: msg.sender === 'ai' ? 'assistant' as const : 'user' as const,
      content: `[${msg.sender}]: ${msg.content}`,
    })),
    {
      role: 'user',
      content: buildNarrationRequest(game),  // What we want the AI to generate
    },
  ];
}

function buildGameStateSummary(game: GameState): string {
  return `
GAME STATE:
- Round: ${game.currentRound}/5
- Score: Akta ${game.score.akta} - Golare ${game.score.golare}
- Phase: ${game.phase}
- Capo: ${game.currentCapo.name}
- Players: ${game.players.map(p => p.name).join(', ')}
- Recent events: ${summarizeRecentEvents(game)}
  `.trim();
}
```

### When to Call OpenAI

Do not call OpenAI on every message. Call it at specific game moments:

| Trigger | Purpose | Latency Budget |
|---------|---------|----------------|
| Game start | Welcome narration, set atmosphere | 3-5s acceptable |
| Phase transition | Narrate what happened, set up next phase | 2-4s acceptable |
| Round result | Dramatic reveal of mission outcome | 3-5s acceptable |
| Game end | Final narrative, reveal roles | 5s acceptable |
| Whisper mechanic | AI-generated anonymous hints | 2-3s acceptable |

Do NOT call OpenAI for: vote acknowledgments, player join/leave confirmations, status queries, error messages. Use pre-written templates for these.

### Structured Output for Predictable Responses

Use OpenAI's structured output (JSON mode with Zod schemas) to get predictable, parseable responses.

```typescript
// ai/types.ts
import { z } from 'zod';

const NarrationResponse = z.object({
  groupMessage: z.string().describe('Public message for the group chat'),
  privateMessages: z.array(z.object({
    targetPlayerId: z.number(),
    message: z.string(),
  })).optional().describe('Secret messages for specific players'),
  mood: z.enum(['tense', 'dramatic', 'humorous', 'threatening']),
});

type NarrationResponse = z.infer<typeof NarrationResponse>;
```

---

## Dual Chat Context Pattern (Detailed)

This is the most architecturally significant Telegram-specific pattern in Golare. The bot operates across two distinct chat contexts simultaneously.

### How It Works

```
GROUP CHAT (-100123456789)              PRIVATE CHAT (user 12345)
================================        ================================
Bot: "Capo Erik, select your team"
                                        Bot: "Du ar GOLARE. Ditt mal
                                              ar att sabotera."
Erik: /team @Anna @Lars
Bot: "Erik has nominated Anna & Lars"
                                        Bot: [JA] [NEJ]  (vote buttons)
                                        User taps [NEJ]
Bot: "All votes are in..."
Bot: "The team was APPROVED 3-2"
                                        Bot: [Sakra] [Gola] (action buttons)
                                        User taps [Gola]
Bot: "The mission has FAILED!"
```

### Implementation Pattern

```typescript
// bot/handlers/callbacks.ts

bot.action(/^vote_(.+)_(.+)$/, async (ctx) => {
  const [, gameId, vote] = ctx.match!;
  const userId = ctx.from.id;

  // This callback comes from a PRIVATE chat (vote buttons sent via DM)
  // But we need to check/update the GROUP game state

  const game = await db.games.getById(gameId);
  if (!game) return ctx.answerCbQuery('Game not found');

  const { newState, actions } = await gameEngine.process({
    type: 'VOTE_CAST',
    chatId: game.chatId,     // Group chat ID
    playerId: userId,
    payload: { vote },
  }, game);

  // Execute actions: some go to group, some go to private
  for (const action of actions) {
    if (action.type === 'SEND_GROUP_MSG') {
      await sender.toGroup(game.chatId, action.data.text);
    } else if (action.type === 'SEND_PRIVATE_MSG') {
      await sender.toPlayer(action.target, action.data.text);
    }
  }

  await ctx.answerCbQuery('Vote registered!');
  await db.games.update(game.chatId, newState);
});
```

### Critical Constraint: Bot Must Be /start'd First

Telegram bots CANNOT send the first message to a user. The user must have previously sent `/start` to the bot in a private chat. This is a hard platform restriction.

**Mitigation strategy:**

1. When a player `/join`s in the group chat, immediately reply with an inline button: "Tap here to activate private messaging" linking to `https://t.me/{botUsername}?start=join_{gameId}`
2. When the user clicks and sends `/start` in private chat, record `has_started_bot = true` for that player
3. Before the game can begin, verify ALL players have `has_started_bot = true`
4. If a player has not started the bot, block game start and name the players who still need to activate DMs

### Inline Keyboard Design

Encode game context into callback data (max 64 bytes per Telegram API limit).

```typescript
// bot/keyboards.ts
import { Markup } from 'telegraf';

function voteKeyboard(gameId: string): Markup.InlineKeyboardMarkup {
  // gameId should be short (use first 8 chars of UUID)
  const shortId = gameId.slice(0, 8);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('JA', `vote_${shortId}_ja`),
      Markup.button.callback('NEJ', `vote_${shortId}_nej`),
    ],
  ]);
}

function executionKeyboard(gameId: string): Markup.InlineKeyboardMarkup {
  const shortId = gameId.slice(0, 8);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Sakra (Protect)', `exec_${shortId}_sakra`),
      Markup.button.callback('Gola (Betray)', `exec_${shortId}_gola`),
    ],
  ]);
}
```

---

## Concurrency and Isolation

### Per-Game Isolation

Each group chat has at most one active game. The `chatId` is the natural partition key. All state operations are scoped to a single `chatId`.

### Concurrent Message Handling

When multiple players vote simultaneously in DMs, multiple callback handlers fire concurrently, all trying to update the same game record. This is the race condition Telegraf's session middleware suffers from.

**Solution: Optimistic Locking with Supabase**

```typescript
// db/queries/games.ts

async function atomicVoteInsert(
  roundId: string,
  playerId: number,
  vote: string
): Promise<{ totalVotes: number; allVotesIn: boolean }> {
  // Use a database function for atomic insert + count
  const { data, error } = await supabase.rpc('cast_vote', {
    p_round_id: roundId,
    p_player_id: playerId,
    p_vote: vote,
  });

  if (error?.code === '23505') {
    // Unique constraint violation -- player already voted
    throw new AlreadyVotedError();
  }

  return data;
}
```

```sql
-- Supabase function for atomic vote casting
CREATE OR REPLACE FUNCTION cast_vote(
  p_round_id UUID,
  p_player_id BIGINT,
  p_vote TEXT
) RETURNS JSON AS $$
DECLARE
  v_game_id UUID;
  v_total_votes INTEGER;
  v_total_players INTEGER;
BEGIN
  -- Insert vote (will fail on duplicate due to UNIQUE constraint)
  INSERT INTO votes (round_id, player_telegram_id, vote)
  VALUES (p_round_id, p_player_id, p_vote);

  -- Count total votes for this round
  SELECT COUNT(*) INTO v_total_votes
  FROM votes WHERE round_id = p_round_id;

  -- Count total players in game
  SELECT g.id INTO v_game_id
  FROM rounds r JOIN games g ON r.game_id = g.id
  WHERE r.id = p_round_id;

  SELECT COUNT(*) INTO v_total_players
  FROM players WHERE game_id = v_game_id;

  RETURN json_build_object(
    'totalVotes', v_total_votes,
    'allVotesIn', v_total_votes >= v_total_players
  );
END;
$$ LANGUAGE plpgsql;
```

**Why:** Database-level atomicity via unique constraints and stored functions eliminates race conditions. The application layer does not need to coordinate -- the database handles it.

---

## Error Handling Strategy

### Layered Error Handling

```typescript
// bot/middleware/error-handler.ts

bot.catch(async (err: unknown, ctx: Context) => {
  const error = err instanceof Error ? err : new Error(String(err));

  if (error instanceof GameLogicError) {
    // User-facing game errors: invalid action, not your turn, etc.
    await ctx.reply(error.userMessage);
  } else if (error instanceof TelegramError) {
    // Telegram API errors: message too long, chat not found, etc.
    console.error('Telegram API error:', error);
    // Don't reply -- the send itself failed
  } else if (error instanceof OpenAIError) {
    // AI service down: fall back to template message
    console.error('OpenAI error:', error);
    await ctx.reply('[Spelledaren tar en paus... Spelet fortsatter.]');
  } else {
    // Unknown errors
    console.error('Unhandled error:', error);
    await ctx.reply('Nagot gick fel. Forsok igen.');
  }
});
```

### AI Fallback Pattern

OpenAI calls can fail (rate limits, downtime, timeouts). The game must NEVER block on AI. Use template fallbacks.

```typescript
// ai/service.ts

async function generateNarration(game: GameState, type: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: await buildAIContext(game, type),
      max_tokens: 500,
      temperature: 0.8,
    });
    return response.choices[0].message.content ?? getFallbackTemplate(type, game);
  } catch (error) {
    console.error('AI narration failed, using fallback:', error);
    return getFallbackTemplate(type, game);
  }
}

function getFallbackTemplate(type: string, game: GameState): string {
  const templates: Record<string, (g: GameState) => string> = {
    'round_start': (g) => `Runda ${g.currentRound} borjar. ${g.currentCapo.name} ar Capo.`,
    'vote_result': (g) => `Omrostningen ar klar.`,
    'mission_result': (g) => `Uppdraget ar avslutat.`,
    // ... more templates
  };
  return templates[type]?.(game) ?? 'Spelet fortsatter...';
}
```

---

## Scaling Considerations

| Concern | At 5 games | At 50 games | At 500 games |
|---------|-----------|-------------|--------------|
| **Telegram polling** | Long polling fine | Long polling fine | Switch to webhooks |
| **Supabase queries** | No concern | No concern | Add connection pooling, consider read replicas |
| **OpenAI API calls** | No concern | Rate limit awareness | Queue AI calls, batch where possible |
| **Cron job sweep** | Instant | Sub-second | Paginate game query, process in batches |
| **Memory** | Negligible | Negligible | Monitor for leaks in message handlers |

**Realistic assessment:** A Telegram bot social deduction game is unlikely to exceed 50 concurrent games. The architecture above handles this comfortably on a single process. Do not over-engineer for scale that will not materialize.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Game State in Telegraf Sessions
**What:** Using `ctx.session` to persist game state between updates.
**Why bad:** In-memory by default (lost on restart), race conditions with concurrent updates, wrong abstraction (session = per-user, game = per-group).
**Instead:** Use Supabase as single source of truth, loaded fresh per request.

### Anti-Pattern 2: Coupling Game Logic to Telegram Types
**What:** Importing Telegraf `Context` types inside `game/` modules.
**Why bad:** Makes game logic untestable without mocking Telegram, prevents reuse.
**Instead:** Game engine accepts plain typed events and returns plain typed actions. The `bot/handlers/` layer translates between Telegram and game domain.

### Anti-Pattern 3: Storing Entire Game State as Single JSONB Row
**What:** One table, one row per game, everything in a JSONB column.
**Why bad:** Cannot query across games efficiently, no referential integrity, concurrent JSONB updates are last-write-wins (data loss), no indexing on nested fields.
**Instead:** Normalized relational tables with JSONB only for truly unstructured, non-queried, ephemeral data (`phase_data`).

### Anti-Pattern 4: Calling OpenAI Synchronously in Message Handlers
**What:** `await openai.chat.completions.create(...)` blocking the Telegram response.
**Why bad:** 2-5 second latency on every AI call. Users see no feedback. Telegram may timeout.
**Instead:** Send an immediate acknowledgment ("Spelledaren tanker..."), then generate AI response and send as a follow-up message.

### Anti-Pattern 5: Using XState for Simple Turn-Based Games
**What:** Bringing in XState v5 with its actor model for a game with 8 linear states.
**Why bad:** Massive conceptual overhead (actors, spawned machines, event interpretation), difficult to serialize/deserialize to database, TypeScript inference complexity.
**Instead:** Simple transition table (as shown above). Reserve XState for applications with genuinely parallel/hierarchical states.

### Anti-Pattern 6: Forgetting the /start Requirement
**What:** Assuming the bot can DM any user at any time.
**Why bad:** Telegram requires users to initiate conversation with bot first. Silent failures when trying to send role assignments or vote buttons.
**Instead:** Enforce `/start` verification during join phase; block game start until all players confirmed.

---

## Integration Points

### External Services

| Service | Integration Pattern | Key Considerations |
|---------|--------------------|--------------------|
| **Telegram Bot API** | Telegraf.js library wrapping Bot API via long polling (dev) / webhooks (prod) | 30 msg/sec per bot limit; inline keyboard callback data max 64 bytes; bot cannot initiate private chats; disable privacy mode for group message access |
| **OpenAI API** | Official `openai` Node.js SDK, chat completions endpoint | Use `gpt-4o` for quality/cost balance; structured output via `zodResponseFormat`; implement fallback templates for failures; keep context under 4K tokens for cost control |
| **Supabase** | `@supabase/supabase-js` client, direct PostgreSQL for migrations | Use RPC functions for atomic operations (voting); JSONB for phase-specific ephemeral data only; generate TypeScript types from schema; connection pooling via Supabase's built-in pgBouncer |
| **node-cron** | In-process cron scheduler | No persistence -- design scheduler to be stateless (DB scan pattern); set timezone to `Europe/Stockholm`; wrap in try/catch to prevent one game's error from blocking others |

### Internal Integration Map

```
bot/handlers/commands.ts
    --> game/engine.ts (processGameEvent)
    --> db/queries/games.ts (load/save state)
    --> messages/sender.ts (send responses)

bot/handlers/callbacks.ts
    --> game/engine.ts (processGameEvent)
    --> db/queries/votes.ts (atomic vote insert)
    --> messages/sender.ts (send responses)

scheduler/phase-trigger.ts
    --> db/queries/games.ts (find games needing advancement)
    --> game/engine.ts (processGameEvent with PHASE_TIMEOUT)
    --> ai/service.ts (generate narration)
    --> messages/sender.ts (send phase transition messages)

game/engine.ts
    --> game/state-machine.ts (validate + apply transition)
    --> game/phases/*.ts (phase-specific logic)
    --> game/rules.ts (team sizes, win conditions)

ai/service.ts
    --> ai/prompts/context-builder.ts (build message array)
    --> ai/prompts/system.ts (persona definition)
    --> OpenAI API (chat.completions.create)
```

---

## Build Order Implications

Components have clear dependency chains. Build in this order:

1. **Config + DB schema** -- Foundation everything depends on
2. **Supabase client + queries** -- Data layer must exist before game logic
3. **Game state machine + engine** -- Core logic, testable in isolation
4. **Bot setup + command handlers** -- Minimal Telegram integration (`/start`, `/join`)
5. **Message sender + formatter** -- Output layer
6. **Inline keyboards + callback handlers** -- Interactive elements
7. **AI service + prompts** -- Enhancement layer (game works without it via fallback templates)
8. **Scheduler** -- Automated phase transitions (can be manually triggered during dev)
9. **Whisper/surveillance mechanics** -- Anti-passivity features, built on top of working game

**Key insight:** The game engine and AI service are independent. Build the game engine first with template messages. Layer AI narration on top once the game loop is proven. This reduces debugging surface area -- you know whether a bug is in game logic or AI integration.

---

## Sources

- [Telegraf.js v4.16.3 Documentation](https://telegraf.js.org/)
- [Telegraf.js Architecture Overview (DeepWiki)](https://deepwiki.com/telegraf/telegraf)
- [Telegraf Session Race Conditions (GitHub Issue #1372)](https://github.com/telegraf/telegraf/issues/1372)
- [Two Design Patterns for Telegram Bots](https://dev.to/madhead/two-design-patterns-for-telegram-bots-59f5)
- [Telegram Bot API Official Documentation](https://core.telegram.org/bots/api)
- [Telegram Bots FAQ (Private Chat Restriction)](https://core.telegram.org/bots/faq)
- [XState v5 Documentation](https://stately.ai/docs/xstate)
- [Supabase JSONB Documentation](https://supabase.com/docs/guides/database/json)
- [Supabase pg_jsonschema Extension](https://supabase.com/docs/guides/database/extensions/pg_jsonschema)
- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture)
- [OpenAI Chat Completions API](https://platform.openai.com/docs/guides/text-generation/chat-completions-api)
- [OpenAI Context Summarization Cookbook](https://cookbook.openai.com/examples/context_summarization_with_realtime_api)
- [OpenAI Conversation State Guide](https://platform.openai.com/docs/guides/conversation-state)
- [node-cron NPM Package](https://www.npmjs.com/package/node-cron)
- [Node.js Scheduler Comparison (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/)
- [Structuring Scalable Telegram Bot (Medium)](https://swapnilsoni1999.medium.com/structuring-a-scalable-telegram-bot-with-telegraf-js-express-style-f1688b63b008)

---

*Architecture research for: Telegram Bot Social Deduction Game (Golare)*
*Researched: 2026-02-10*
