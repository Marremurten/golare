# Golare

## What This Is

Ett asynkront, textbaserat socialt deduktionsspel som spelas direkt i en Telegram-gruppchat under 5 dagar (måndag–fredag). En grupp vänner (4-10 spelare) agerar som ett kriminellt nätverk ("Ligan") som försöker genomföra "stötar" (uppdrag), medan hemliga infiltratörer ("Golare") saboterar inifrån. Spelet leds av en AI-karaktär (Guzman) som driver narrativet och aktivt skapar paranoia.

## Core Value

The social deduction experience — the paranoia, accusations, and bluffing between friends — driven by an AI game master that actively stirs conflict and keeps every player engaged between rounds.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Bot connects to Telegram via Telegraf.js and responds to commands
- [ ] Players register via `/start` in private chat (saves chat_id)
- [ ] Admin starts game with `/nyttspel` in group chat
- [ ] Roles assigned secretly via DM: Äkta, Golare, Guzmans Högra Hand
- [ ] Role balancing based on player count (4-10 spelare, ~25% Golare)
- [ ] Golare know each other's identities via DM
- [ ] Högra Hand gets one "Spaning" (check one player's role) during the game
- [ ] Automatic daily schedule: 09:00 uppdrag, 12:00 Capo-val, 15:00 röstning, 18:00 utförande, 21:00 resultat
- [ ] Rotating Capo nominates team for each mission
- [ ] Group votes JA/NEJ on team via inline buttons
- [ ] Team members secretly choose [Säkra] or [Gola] via private buttons
- [ ] Failed vote rotates Capo to next player
- [ ] Kaos-mätaren: 3 consecutive NEJ in a round → mission auto-fails (Golare get free point)
- [ ] Win condition: best of 5 missions (first to 3)
- [ ] Symmetrisk Sista Chansen: Ligan wins → Golare guess Högra Hand; Golare wins → Äkta guess one Golare
- [ ] Anti-passivity: non-team players send anonymous messages via Guzman to group
- [ ] Anti-passivity: non-team players can "surveil" a team member for a cryptic clue
- [ ] Äkta-verktyg: each player gets one "Spaning" per game (ask Guzman, answer may be true or false)
- [ ] Anti-blowout: final rounds worth double points for comeback possibility
- [ ] AI Guzman: paranoid criminal leader persona, Swedish suburb slang (bre, shuno, aina, para)
- [ ] AI Guzman: posts missions with dramatic narratives via OpenAI
- [ ] AI Viskningar: DMs players between events with suspicion/lies/manipulation
- [ ] AI gap-fill: Guzman reacts to group chat activity between fixed times
- [ ] Intro sequence: Guzman explains rules in character when game starts
- [ ] `/regler` command: clear rules overview accessible anytime
- [ ] `/status` command: shows score (Ligan vs Aina)
- [ ] Game state persisted in Supabase (survives restarts)

### Out of Scope

- Röstmeddelanden / TTS — high complexity, defer to v2
- "The Wiretap" (Golare sees Äkta private messages) — defer to v2
- Konfigurerbar spellängd (3/5/7 rundor) — defer to v2, keep v1 at 5 days
- Web dashboard — Telegram is the interface
- Multiple concurrent games per group — v1 supports one active game per group

## Context

**Theme & Tone:**
Miljö: Betongen, förorten, "Byn". Mörkt, regnigt och stressigt. Stil: Snabba Cash möter Top Boy. Språkbruk: Mycket slang (shuno, bre, aina, para, beckna, guss). Aggressivt men med glimten i ögat.

**AI Persona — Guzman:**
Ligans paranoida ledare. Litar inte på någon, stressad över polisen, hotar ständigt med konsekvenser. System prompt: "Du är Guzman, ledare för ett kriminellt gäng i en svensk förort. Du är paranoid, aggressiv och stressad. Du använder slang som 'bre', 'shuno', 'aina', 'para'. Du hatar golare mer än allt annat."

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

**Kaos-mätaren (Failed Votes):**
- NEJ → Capo rotates to next player
- 3 consecutive NEJ → mission auto-fails, Golare get free point
- Guzman escalates dramatically with each failed vote

**Guzmans Högra Hand (Like Merlin in Avalon):**
- Team: Äkta
- Gets one "Spaning" during the game (check one player's role)
- Must subtly guide the group without being exposed
- If Golare identify Högra Hand at end → they can steal the win

**Symmetrisk Sista Chansen:**
- Ligan wins → Golare guess Högra Hand (correct = Golare win)
- Golare wins → Äkta guess one Golare (correct = Äkta win)

## Constraints

- **Platform**: Telegram Bot — all interaction through Telegram group + private chats
- **Tech Stack**: Node.js, Telegraf.js, OpenAI API (GPT-4o), Supabase — decided
- **Language**: Swedish with förorts-slang — core to the identity
- **Players**: 4-10 per game — balancing designed for this range
- **Schedule**: Fixed 5-day format (mån-fre) for v1
- **AI Cost**: OpenAI API calls for Guzman persona — need to manage token usage

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for persistence | Game state must survive restarts, no in-memory | — Pending |
| Automatic scheduling (cron) | Better UX than manual admin commands | — Pending |
| "Spaning" for Högra Hand | Simpler than knowing all Golare, creates tactical moment | — Pending |
| All 4 gameplay fixes in v1 | Engagement is core to game working | — Pending |
| Configurable length → v2 | Keep v1 scope manageable, 5 days is default | — Pending |
| Anonymous whispers for anti-passivity | Non-team players need something to do | — Pending |
| Symmetrisk slutmekanik | Both sides deserve comeback chance | — Pending |

---
*Last updated: 2026-02-10 after initialization*
