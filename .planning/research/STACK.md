# Stack Research

**Domain:** Telegram Bot Social Deduction Game
**Researched:** 2026-02-10
**Overall Confidence:** HIGH

## Critical Recommendation: Use grammY Instead of Telegraf

The project context specifies Telegraf.js, but research strongly recommends switching to **grammY** before any code is written. Rationale:

| Factor | Telegraf | grammY |
|--------|----------|--------|
| Latest version | 4.16.3 (last published ~2 years ago) | 1.40.0 (published today, 2026-02-10) |
| Weekly downloads | ~160K | ~1.2M |
| Maintenance | v4 end-of-support was Feb 2025 | Actively maintained, frequent releases |
| TypeScript DX | Complex, hard-to-understand types | Clean, consistent types with editor hints |
| Bot API currency | Lags behind by several versions | Consistently supports latest Bot API |
| Supabase session | No official adapter | Official `@grammyjs/storage-supabase` adapter |
| Plugin ecosystem | Stagnant | Active: conversations, menus, sessions, runner, i18n |
| Documentation | Auto-generated reference only | Comprehensive guides + reference |

grammY was built by a core Telegraf contributor who redesigned the framework from scratch for better type safety and developer experience. It is the successor framework. Using Telegraf in 2026 is building on deprecated infrastructure.

**Confidence: HIGH** -- Verified via npm registry, GitHub activity, official grammY comparison docs.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 22.x LTS | Runtime | Active LTS until April 2027. Native `--env-file` support. Node 24 LTS also available but 22 has broader ecosystem testing. | HIGH |
| TypeScript | 5.9.x | Language | Type safety is critical for game state machines and Telegram API types. grammY's types are designed for TS-first development. | HIGH |
| grammY | 1.40.0 | Telegram Bot API framework | Actively maintained, excellent TS support, official Supabase session adapter, rich plugin ecosystem. See comparison table above. | HIGH |
| OpenAI SDK | 6.19.0 | AI game master (Guzman) | Official SDK. Supports structured outputs via `zodResponseFormat` for typed AI responses. Streaming support for long narratives. | HIGH |
| @supabase/supabase-js | 2.95.x | Database client | Official client. Use with service_role key on server-side to bypass RLS for bot operations. Dropped Node 18 support in 2.79.0 (fine with Node 22). | HIGH |
| Zod | 4.3.x | Schema validation | Used by OpenAI SDK for structured outputs (`zodResponseFormat`). Also useful for validating game state, config, and API responses. OpenAI SDK 6.19 supports both Zod 3 and 4. | HIGH |
| node-cron | 4.2.x | Scheduled game events | Simple cron-based scheduling for fixed daily events (09:00, 12:00, 15:00, 18:00, 21:00). No external dependencies (no Redis needed). Perfect for predictable, time-based game events. | HIGH |
| Pino | 10.3.x | Logging | 5x faster than Winston. JSON output works well with log aggregation. Low overhead critical for a bot processing messages across concurrent games. | MEDIUM |

### grammY Plugins

| Plugin | Version | Purpose | Why Needed |
|--------|---------|---------|------------|
| @grammyjs/storage-supabase | 2.5.0 | Session persistence in Supabase | Official adapter. Stores session data per-chat in Supabase. Survives bot restarts. Critical for a 5-day game. |
| @grammyjs/conversations | latest | Multi-step interactions | Handles flows like voting, accusation sequences, and setup wizards as conversation functions rather than manual state tracking. |
| @grammyjs/menu | latest | Interactive inline menus | Build complex inline keyboard menus (vote targets, action selections) with automatic callback handling. |
| @grammyjs/runner | latest | Concurrent long polling | Processes updates concurrently. Needed when running multiple simultaneous games across group chats. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | latest | ID generation | Short, URL-safe unique IDs for games, rounds, and events. Better than UUIDs for human-readable game codes. |
| date-fns | latest | Date manipulation | Timezone-aware date handling for scheduling game events. Lighter than moment.js/luxon. |
| pino-pretty | latest | Dev log formatting | Pretty-print Pino JSON logs during development only. Do not use in production. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| tsx | 4.21.x | TypeScript execution | Run TS directly without compilation step. Use for development: `tsx --watch --env-file .env src/index.ts`. Replaces ts-node (which has ESM issues). |
| vitest | 4.0.x | Testing | Native ESM and TypeScript support. Fast, modern test runner. No babel/jest config needed. |
| typescript | 5.9.x | Type checking | Use `tsc --noEmit` for type checking. Build with `tsc` for production. |
| @biomejs/biome | latest | Linting + formatting | Single tool replacing ESLint + Prettier. Faster, zero-config. Opinionated defaults. |

---

## Project Structure

```
golare/
  src/
    index.ts                 # Entry point: bot setup, middleware, start
    bot/
      bot.ts                 # Bot instance creation, plugin registration
      middleware/             # Custom middleware (auth, logging, error handling)
      commands/               # Command handlers (/start, /join, /status, etc.)
      conversations/          # grammY conversation flows (voting, accusations)
      menus/                  # Inline keyboard menus
    game/
      engine.ts              # Core game logic state machine
      types.ts               # Game state types, player types, role types
      actions/               # Game actions (heist, vote, sabotage, whisper)
      phases/                # Day/night phase logic
      scheduler.ts           # node-cron scheduled events
    ai/
      guzman.ts              # AI game master persona
      prompts/               # System prompts, prompt templates
      schemas.ts             # Zod schemas for structured AI outputs
    db/
      client.ts              # Supabase client initialization
      queries/               # Database query functions
      migrations/            # SQL migration files
    utils/
      logger.ts              # Pino logger setup
      config.ts              # Environment config with Zod validation
  tests/
    game/                    # Game engine unit tests
    ai/                      # AI response tests (mocked)
    bot/                     # Bot handler tests
  .env.example               # Environment variable template
  tsconfig.json
  vitest.config.ts
  package.json
```

---

## Installation

```bash
# Initialize project
npm init -y

# Core dependencies
npm install grammy @grammyjs/storage-supabase @grammyjs/conversations @grammyjs/menu @grammyjs/runner @supabase/supabase-js openai zod node-cron pino

# Supporting
npm install nanoid date-fns

# Dev dependencies
npm install -D typescript @types/node tsx vitest pino-pretty @biomejs/biome
```

### tsconfig.json Essentials

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### package.json Scripts

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx --watch --env-file .env src/index.ts",
    "build": "tsc",
    "start": "node --env-file .env dist/index.js",
    "test": "vitest",
    "test:run": "vitest run",
    "check": "tsc --noEmit && biome check src/",
    "format": "biome format --write src/"
  }
}
```

---

## Key Integration Patterns

### grammY + Supabase Session Setup

```typescript
import { Bot, session, type SessionFlavor } from "grammy";
import { supabaseAdapter } from "@grammyjs/storage-supabase";
import { createClient } from "@supabase/supabase-js";

interface GameSession {
  gameId: string | null;
  phase: "idle" | "setup" | "active" | "ended";
  // ... game state
}

type BotContext = Context & SessionFlavor<GameSession>;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role bypasses RLS
);

const bot = new Bot<BotContext>(process.env.BOT_TOKEN!);

bot.use(session({
  initial: (): GameSession => ({ gameId: null, phase: "idle" }),
  storage: supabaseAdapter({ supabase, table: "sessions" }),
}));
```

### OpenAI Structured Output for Guzman

```typescript
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const GuzmanResponse = z.object({
  narrative: z.string().describe("In-character message from Guzman to the group"),
  whispers: z.array(z.object({
    playerId: z.string(),
    message: z.string().describe("Private DM content for this player"),
  })).describe("Private messages to send to individual players"),
  suspicionShift: z.record(z.string(), z.number()).describe("Adjust suspicion levels: playerId -> delta"),
});

const openai = new OpenAI();

async function generateGuzmanResponse(gameState: GameState, event: string) {
  const completion = await openai.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      { role: "system", content: GUZMAN_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ gameState, event }) },
    ],
    response_format: zodResponseFormat(GuzmanResponse, "guzman_response"),
  });

  return completion.choices[0].message.parsed;
}
```

### node-cron Scheduling for Game Events

```typescript
import cron from "node-cron";

// Schedule daily game events (Stockholm timezone)
const GAME_EVENTS = [
  { time: "0 9 * * 1-5",  event: "morning_briefing" },
  { time: "0 12 * * 1-5", event: "midday_intel" },
  { time: "0 15 * * 1-5", event: "afternoon_heist" },
  { time: "0 18 * * 1-5", event: "evening_vote" },
  { time: "0 21 * * 1-5", event: "night_result" },
];

function scheduleGameEvents(gameId: string) {
  for (const { time, event } of GAME_EVENTS) {
    cron.schedule(time, () => processGameEvent(gameId, event), {
      timezone: "Europe/Stockholm",
    });
  }
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Bot framework | grammY 1.40.0 | Telegraf 4.16.3 | Telegraf EOL Feb 2025, no updates in 2 years, no Supabase adapter, stale types. grammY is its actively-maintained successor. |
| Bot framework | grammY 1.40.0 | node-telegram-bot-api | Lower-level, no middleware system, no plugin ecosystem. More work to build game interactions. |
| AI SDK | OpenAI SDK 6.19.0 | Vercel AI SDK | Over-abstraction for this use case. We only need one provider (OpenAI). Direct SDK gives full control over prompts and structured outputs. |
| Database | Supabase | Raw PostgreSQL + pg | Supabase provides hosted Postgres + realtime + auth + storage. Less infra to manage. Official grammY adapter exists. |
| Database | Supabase | SQLite (better-sqlite3) | No hosted option, harder to inspect in production, no realtime subscriptions. SQLite is fine for prototyping but Supabase scales better. |
| Scheduler | node-cron | BullMQ 5.67.x | BullMQ requires Redis. Overkill for 5 fixed daily cron jobs. Use BullMQ only if you need: job retries, distributed workers, job persistence across restarts, or >100 concurrent games. |
| Scheduler | node-cron | Agenda | Agenda uses MongoDB (not in our stack) and appears unmaintained since Nov 2022. |
| Schema validation | Zod 4.3.x | Joi, Yup | Zod has first-class TypeScript inference, integrates with OpenAI SDK's `zodResponseFormat`. Joi and Yup lack this integration. |
| Logger | Pino | Winston | Pino is 5x faster with lower memory usage. Winston is more flexible but flexibility is unnecessary here. JSON structured logs are what we need. |
| TS runner | tsx | ts-node | ts-node has persistent ESM compatibility issues. tsx works out of the box with no config. |
| Test runner | Vitest | Jest | Vitest has native ESM + TS support. Jest requires babel transforms and extra config for ESM. |
| Linter | Biome | ESLint + Prettier | Biome is a single tool, 10-100x faster. Less config. ESLint + Prettier is fine too but requires more setup. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Telegraf.js | End-of-support Feb 2025, last npm publish 2 years ago, no Supabase adapter, falling behind on Bot API support | grammY |
| dotenv | Node.js 22 has native `--env-file` support. One less dependency. | `node --env-file .env` or `tsx --env-file .env` |
| ts-node | Persistent ESM compatibility issues, slower startup, requires tsconfig-paths | tsx |
| moment.js | Deprecated by its own maintainers, massive bundle size | date-fns |
| Express/Fastify (for webhook) | Unnecessary complexity for this bot. Long polling is simpler, works everywhere, and grammY recommends it unless you have a specific reason for webhooks. | grammY's built-in long polling (or `@grammyjs/runner` for concurrent processing) |
| Redis (for scheduling) | Adding Redis infrastructure for 5 daily cron jobs is over-engineering. node-cron handles this in-process. | node-cron |
| Prisma | Heavy ORM with its own migration system. Supabase client + raw SQL/RPC is simpler for this domain. Prisma's generated client adds cold-start overhead. | @supabase/supabase-js with typed queries |
| MongoDB | No reason to add a document DB when Supabase (Postgres) handles everything. Game state is relational (players belong to games, votes reference players). | Supabase (PostgreSQL) |

---

## Version Compatibility Matrix

| Package | Compatible Node.js | Compatible With | Notes |
|---------|-------------------|-----------------|-------|
| grammY 1.40.x | >=12.20.0 (but use 22 LTS) | @grammyjs/* plugins | Broad Node compat, but use 22 LTS for native features |
| OpenAI SDK 6.19.x | No engine field specified | Zod 3.25+ or 4.x | Zod is optional peer dep. Both v3 and v4 supported for zodResponseFormat. |
| @supabase/supabase-js 2.95.x | >=20 (Node 18 dropped in 2.79.0) | Supabase platform | Must use Node 20+ |
| @grammyjs/storage-supabase 2.5.x | Same as grammY | @supabase/supabase-js 2.x, grammY 1.x | Official adapter |
| Zod 4.3.x | Broad | OpenAI SDK 6.x | OpenAI SDK lists `^3.25 \|\| ^4.0` as peer dep |
| node-cron 4.2.x | Broad | Standalone | No external dependencies |
| tsx 4.21.x | >=18.0 | TypeScript 5.x | Uses esbuild under the hood |
| Vitest 4.0.x | >=18.0 | TypeScript 5.x | Native ESM support |

---

## Environment Variables

```bash
# .env.example

# Telegram
BOT_TOKEN=your_telegram_bot_token

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
# Note: Use service_role key (not anon key) because the bot is a trusted
# server-side process that needs to read/write all game data regardless of RLS.

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o

# Game Config
TIMEZONE=Europe/Stockholm
LOG_LEVEL=info
```

---

## Scaling Considerations

| Concern | 1-5 concurrent games | 10-50 concurrent games | 100+ concurrent games |
|---------|----------------------|------------------------|----------------------|
| Bot framework | grammY built-in polling | @grammyjs/runner for concurrent update processing | @grammyjs/runner + webhook mode behind reverse proxy |
| Scheduling | node-cron (in-process) | node-cron (still fine, schedules are per-game-event, not per-message) | BullMQ with Redis for distributed job scheduling |
| Database | Supabase free tier | Supabase Pro | Supabase Pro with connection pooling (Supavisor) |
| AI calls | Direct OpenAI calls | Direct with rate limiting | Queue AI calls through BullMQ to manage rate limits |
| Process | Single Node.js process | Single process (still fine) | Multiple workers with shared Redis |

For the Golare project's expected scale (likely 1-20 concurrent games), the simple stack (grammY polling + node-cron + direct Supabase/OpenAI) is the right choice. Do not pre-optimize for 100+ games.

---

## Sources

- [grammY Official Site](https://grammy.dev/) -- framework docs, plugin list, comparison page
- [grammY vs Other Frameworks](https://grammy.dev/resources/comparison) -- official comparison with Telegraf
- [grammY npm](https://www.npmjs.com/package/grammy) -- v1.40.0, 1.2M weekly downloads
- [Telegraf npm](https://www.npmjs.com/package/telegraf) -- v4.16.3, last published ~2 years ago
- [@grammyjs/storage-supabase](https://github.com/grammyjs/storage-supabase) -- official Supabase session adapter
- [OpenAI Node.js SDK](https://github.com/openai/openai-node) -- v6.19.0
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) -- zodResponseFormat docs
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) -- v2.95.3
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys) -- service role key usage
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) -- LTS schedule
- [BullMQ npm](https://www.npmjs.com/package/bullmq) -- v5.67.3, considered but not recommended for initial build
- [node-cron npm](https://www.npmjs.com/package/node-cron) -- v4.2.1
- [grammY Long Polling vs Webhooks](https://grammy.dev/guide/deployment-types) -- deployment guidance
- [BetterStack Node.js Schedulers Guide](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) -- scheduler comparison
- [Pino vs Winston](https://betterstack.com/community/comparisons/pino-vs-winston/) -- performance comparison

All versions verified via `npm view <package> version` on 2026-02-10.

---
*Stack research for: Telegram Bot Social Deduction Game (Golare)*
*Researched: 2026-02-10*
