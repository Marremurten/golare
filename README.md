# Golare

An async social deduction game played in Telegram group chats, led by an AI game master.

A group of friends (4–10 players) act as a criminal network ("Ligan") trying to pull off heists ("Stötar"), while hidden infiltrators ("Golare") sabotage from within. The game runs over 5 days (Monday–Friday) with automated daily events. An AI character — **Guzman**, the paranoid gang leader — drives the narrative, sends manipulative whispers, and stirs paranoia.

## How It Works

Each day follows a scheduled cycle:

| Time  | Event                                          |
|-------|-------------------------------------------------|
| 09:00 | Guzman posts the day's mission                  |
| 12:00 | Rotating Capo nominates a team                  |
| 15:00 | Group votes JA/NEJ on the team                  |
| 18:00 | Team members secretly choose [Säkra] or [Gola]  |
| 21:00 | Guzman reveals the result                        |

Between events, Guzman sends whispers, accusations, and commentary to keep everyone on edge.

### Roles

- **Äkta** — Loyal members trying to complete missions
- **Golare** — Infiltrators who sabotage (they know each other)
- **Guzmans Högra Hand** — A special Äkta who gets one "Spaning" (role check) per game

### Win Condition

Best of 5 missions — first side to 3 wins.

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Telegram**: [grammY](https://grammy.dev/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **AI**: OpenAI (gpt-4o-mini for narratives, gpt-4.1-nano for commentary) with template fallbacks
- **Scheduling**: [Croner](https://github.com/hexagon/croner)

## Setup

```bash
# Install dependencies
npm install

# Copy environment file and fill in your keys
cp .env.example .env

# Run in development mode (with hot reload)
npm run dev

# Run in production mode
npm start
```

### Environment Variables

| Variable                  | Description                    |
|---------------------------|--------------------------------|
| `BOT_TOKEN`               | Telegram bot token from @BotFather |
| `SUPABASE_URL`            | Your Supabase project URL      |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key    |
| `OPENAI_API_KEY`          | OpenAI API key (optional — falls back to templates) |
| `DEV_MODE`                | Set to `true` for 1-player testing |

## License

ISC
