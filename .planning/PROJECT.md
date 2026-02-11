# Golare

## What This Is

Ett asynkront, textbaserat socialt deduktionsspel som spelas direkt i en Telegram-gruppchat under 5 dagar (måndag–fredag). En grupp vänner (4-10 spelare) agerar som ett kriminellt nätverk ("Ligan") som försöker genomföra "stötar" (uppdrag), medan hemliga infiltratörer ("Golare") saboterar inifrån. Spelet leds av en AI-karaktär (Guzman) som driver narrativet, skickar manipulativa viskningar, och aktivt skapar paranoia. Alla 36 kärnfunktioner levererade i v1 — redo för speltest.

## Core Value

The social deduction experience — the paranoia, accusations, and bluffing between friends — driven by an AI game master that actively stirs conflict and keeps every player engaged between rounds.

## Requirements

### Validated

- ✓ Bot connects to Telegram via grammY and responds to commands — v1
- ✓ Players register via `/start` in private chat (saves chat_id) — v1
- ✓ Admin starts game with `/nyttspel` in group chat — v1
- ✓ Roles assigned secretly via DM: Äkta, Golare, Guzmans Högra Hand — v1
- ✓ Role balancing based on player count (4-10 spelare, ~25% Golare) — v1
- ✓ Golare know each other's identities via DM — v1
- ✓ Högra Hand gets one "Spaning" (check one player's role) during the game — v1
- ✓ Automatic daily schedule: 09:00 uppdrag, 12:00 Capo-val, 15:00 röstning, 18:00 utförande, 21:00 resultat — v1
- ✓ Rotating Capo nominates team for each mission — v1
- ✓ Group votes JA/NEJ on team via inline buttons — v1
- ✓ Team members secretly choose [Säkra] or [Gola] via private buttons — v1
- ✓ Failed vote rotates Capo to next player — v1
- ✓ Kaos-mätaren: 3 consecutive NEJ in a round → mission auto-fails — v1
- ✓ Win condition: best of 5 missions (first to 3) — v1
- ✓ Symmetrisk Sista Chansen — v1
- ✓ Anonymous whispers via Guzman to group — v1
- ✓ Surveillance: non-team players surveil a team member for cryptic clue — v1
- ✓ Äkta-verktyg: one Spaning per game per player — v1
- ✓ Anti-blowout: final rounds worth double points — v1
- ✓ AI Guzman: paranoid criminal leader persona, Swedish suburb slang — v1
- ✓ AI mission narratives via OpenAI — v1
- ✓ AI Viskningar: DMs players with suspicion/lies/manipulation — v1
- ✓ AI gap-fill: reacts to group chat activity between events — v1
- ✓ Intro sequence: Guzman explains rules in character — v1
- ✓ `/regler` command: rules overview accessible anytime — v1
- ✓ `/status` command: shows score (Ligan vs Aina) — v1
- ✓ Game state persisted in Supabase (survives restarts) — v1
- ✓ OpenAI integration with template fallbacks — v1
- ✓ Message queue with rate limiting — v1
- ✓ DM permission flow via deep links — v1
- ✓ Scheduled events via Croner — v1
- ✓ Role reveal at game end — v1

### Active

(Defining for next milestone)

### Out of Scope

- Röstmeddelanden / TTS — high complexity, defer to v2
- "The Wiretap" (Golare sees Äkta private messages) — defer to v2
- Konfigurerbar spellängd (3/5/7 rundor) — defer to v2, keep v1 at 5 days
- Web dashboard — Telegram is the interface
- Multiple concurrent games per group — v1 supports one active game per group
- Player elimination — async format means eliminated players have nothing to do for days
- 60+ role variants — 3 roles keeps v1 clear; complexity explosion not worth it
- Real-time synchronous mode — fundamentally different game engine
- XState — custom FSM is simpler for 8 linear states

## Context

**Shipped v1 MVP** with 8,218 LOC TypeScript across 84 files in 2 days.
Tech stack: Node.js, grammY, Supabase, OpenAI (gpt-4o-mini / gpt-4.1-nano), Croner.
All 36 requirements shipped. Audit passed: 76/76 observable truths verified.
Game is ready for human playtesting.

**Theme & Tone:**
Miljö: Betongen, förorten, "Byn". Mörkt, regnigt och stressigt. Stil: Snabba Cash möter Top Boy. Språkbruk: Mycket slang (shuno, bre, aina, para, beckna, guss). Aggressivt men med glimten i ögat.

**AI Persona — Guzman:**
Ligans paranoida ledare. Litar inte på någon, stressad över polisen, hotar ständigt med konsekvenser. Uses gpt-4o-mini for narratives/whispers, gpt-4.1-nano for commentary. Template fallbacks on all paths.

**Role Balancing:**

| Spelare | Golare | Äkta | Högra Hand    | Teamstorlek |
|---------|--------|------|---------------|-------------|
| 4       | 1      | 3    | 1 av de Äkta  | 2           |
| 5       | 1      | 4    | 1 av de Äkta  | 2           |
| 6       | 2      | 4    | 1 av de Äkta  | 3           |
| 7       | 2      | 5    | 1 av de Äkta  | 3           |
| 8       | 2      | 6    | 1 av de Äkta  | 3           |
| 9       | 3      | 6    | 1 av de Äkta  | 4           |
| 10      | 3      | 7    | 1 av de Äkta  | 4           |

**Game Flow (Daily):**
- 09:00 — Guzman posts mission (Stöt)
- 12:00 — Rotating Capo nominates team
- 15:00 — Group votes JA/NEJ via inline buttons
- 18:00 — Team members secretly choose [Säkra] or [Gola]
- 21:00 — Guzman presents result
- Between events — AI Viskningar and gap-fill commentary

**Known tech debt (v1, info-level):**
- Global mutable `let botRef` for scheduler-handler bridge
- In-memory Maps for Sista Chansen / whisper state (lost on restart)
- `sleep` via setTimeout for dramatic reveal (intentional UX)

## Constraints

- **Platform**: Telegram Bot — all interaction through Telegram group + private chats
- **Tech Stack**: Node.js, grammY, OpenAI API (gpt-4o-mini/gpt-4.1-nano), Supabase, Croner — decided
- **Language**: Swedish with förorts-slang — core to the identity
- **Players**: 4-10 per game — balancing designed for this range
- **Schedule**: Fixed 5-day format (mån-fre) for v1
- **AI Cost**: Tiered model selection manages costs (mini for narratives, nano for commentary)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for persistence | Game state must survive restarts, no in-memory | ✓ Good |
| Automatic scheduling (Croner) | Better UX than manual admin commands | ✓ Good |
| "Spaning" for Högra Hand | Simpler than knowing all Golare, creates tactical moment | ✓ Good |
| All engagement mechanics in v1 | Anti-passivity is core to async working | ✓ Good |
| Configurable length → v2 | Keep v1 scope manageable, 5 days is default | ✓ Good |
| Anonymous whispers for anti-passivity | Non-team players need something to do | ✓ Good |
| Symmetrisk slutmekanik | Both sides deserve comeback chance | ✓ Good |
| grammY over Telegraf | Telegraf EOL Feb 2025; grammY has native Supabase adapter | ✓ Good |
| Template fallbacks for AI | Game must never block on OpenAI API failure | ✓ Good |
| Message queue for rate limits | Telegram 20 msg/min per group; queue is foundational | ✓ Good |
| Role reveal at game end | Emotional payoff moment — table stakes | ✓ Good |
| Database-first state (not sessions) | Race condition prevention with concurrent players | ✓ Good |
| Custom FSM over XState | 8 linear states, zero-dependency, simpler | ✓ Good |
| node:crypto for role assignment | Security-critical shuffle needs CSPRNG | ✓ Good |
| Tiered AI models (mini/nano) | Cost optimization without quality loss | ✓ Good |
| In-memory Maps for transient state | Acceptable v1 trade-off for Sista Chansen/whispers | ⚠️ Revisit |
| Global botRef for scheduler | Scheduler needs bot instance; acceptable bridge pattern | ⚠️ Revisit |

---
*Last updated: 2026-02-11 after v1 milestone*
