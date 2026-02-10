# Requirements: Golare

**Defined:** 2026-02-10
**Core Value:** The social deduction experience — paranoia, accusations, and bluffing between friends — driven by an AI game master that actively stirs conflict and keeps every player engaged.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Bot connects to Telegram via grammY and responds to commands
- [ ] **INFRA-02**: Game state persisted in Supabase database (survives bot restarts)
- [ ] **INFRA-03**: Message queue with rate limiting (respects Telegram 20 msg/min per group)
- [ ] **INFRA-04**: Players must /start bot privately before game can DM them (onboarding deep link flow)
- [ ] **INFRA-05**: OpenAI integration with template fallbacks — game never blocks on AI API failure
- [ ] **INFRA-06**: Scheduled events trigger automatically at fixed daily times (09:00, 12:00, 15:00, 18:00, 21:00)

### Game Setup

- [ ] **SETUP-01**: Players register via /start in private chat (saves Telegram user_id and chat_id)
- [x] **SETUP-02**: Admin starts game with /nyttspel in group chat (minimum 4, maximum 10 players)
- [x] **SETUP-03**: Roles assigned secretly via DM: Äkta (loyal), Golare (informant), Guzmans Högra Hand (special loyal)
- [x] **SETUP-04**: Role balancing based on player count (~25% Golare, 1 Högra Hand always among Äkta)
- [x] **SETUP-05**: Golare receive list of other Golare identities via DM
- [x] **SETUP-06**: Högra Hand receives one reliable "Spaning" ability (check one player's true role during game)

### Game Loop

- [ ] **LOOP-01**: Daily mission: Guzman posts thematic mission description at 09:00
- [ ] **LOOP-02**: Capo nomination: rotating Capo nominates a team at 12:00
- [ ] **LOOP-03**: Team voting: group votes JA/NEJ on proposed team via inline buttons at 15:00
- [ ] **LOOP-04**: Mission execution: approved team members secretly choose [Säkra] or [Gola] via private buttons at 18:00
- [ ] **LOOP-05**: Result reveal: Guzman presents mission outcome (success/fail) at 21:00
- [ ] **LOOP-06**: Failed vote rotates Capo to next player in list
- [ ] **LOOP-07**: Kaos-mätaren: 3 consecutive NEJ votes in same round → mission auto-fails (Golare get free point)
- [ ] **LOOP-08**: Win condition: best of 5 missions — first side to 3 wins
- [ ] **LOOP-09**: Symmetrisk Sista Chansen: if Ligan wins → Golare guess Högra Hand; if Golare wins → Äkta guess one Golare
- [ ] **LOOP-10**: Team size scales with player count (2 for 4-5, 3 for 6-8, 4 for 9-10)

### Engagement

- [ ] **ENGAGE-01**: Anonymous whispers: non-team players can send anonymous messages to group via Guzman
- [ ] **ENGAGE-02**: Surveillance: non-team players can "surveil" a team member for a cryptic clue about their action
- [ ] **ENGAGE-03**: Äkta-verktyg: each player gets one "Spaning" per game (ask Guzman about a player — answer may be true or false)
- [ ] **ENGAGE-04**: Anti-blowout: final 1-2 rounds worth double points for comeback possibility
- [ ] **ENGAGE-05**: Role reveal at game end — full transparency of all roles, actions taken, and who betrayed whom

### AI Guzman

- [ ] **AI-01**: Guzman persona: paranoid criminal leader, Swedish suburb slang (bre, shuno, aina, para, beckna, guss)
- [ ] **AI-02**: AI-generated mission narratives — unique dramatic descriptions for each daily mission
- [ ] **AI-03**: AI-generated result presentations — dramatic reveal of mission success/failure
- [ ] **AI-04**: Viskningar: Guzman sends private manipulation DMs to players between events (suspicion, lies, false evidence)
- [ ] **AI-05**: Gap-fill: Guzman reacts to group chat activity between fixed times (comments on silence, aggression, suspicion)
- [x] **AI-06**: Template fallback system — pre-written messages for every game event when OpenAI API is unavailable

### Onboarding & UX

- [x] **UX-01**: Intro sequence: Guzman explains game rules in character when game starts
- [x] **UX-02**: /regler command: clear rules overview accessible by any player at any time
- [x] **UX-03**: /status command: shows current score (Ligan vs Aina), round number, and game phase

## v2 Requirements

### Enhanced AI

- **AI-V2-01**: Röstmeddelanden — OpenAI TTS for Guzman voice messages (dark, distorted voice)
- **AI-V2-02**: "The Wiretap" — Golare can see selected Äkta private messages to bot
- **AI-V2-03**: Tiered AI models — GPT-4o-mini for routine responses, GPT-4o for dramatic moments

### Game Variants

- **VAR-01**: Configurable game length — admin chooses 3/5/7 rounds
- **VAR-02**: Weekend mode — condensed schedule for Saturday-Sunday play
- **VAR-03**: Additional roles beyond core 3 (e.g., Undercovern, Torpeden)

### Quality of Life

- **QOL-01**: Reminder notifications when player action is needed
- **QOL-02**: Game statistics and player history across games
- **QOL-03**: Multiple language support (English, etc.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Player elimination | 5-day game — eliminated day 1 = 4 days of nothing. Avalon pattern (no elimination) is correct |
| 60+ role variants | WerewolfBot took years. Async format rewards clarity; 3 roles for v1 |
| Real-time synchronous mode | Fundamentally different game — async is the identity |
| Web dashboard | Telegram is the interface |
| Multiple concurrent games per group | One active game per group for v1 |
| OAuth / external login | Telegram handles identity |
| Mobile app | Telegram IS the app |
| XState for state machine | Overkill for ~8 linear phases; custom FSM is simpler and zero-dependency |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1: Foundation | Complete |
| INFRA-02 | Phase 1: Foundation | Complete |
| INFRA-03 | Phase 1: Foundation | Complete |
| INFRA-04 | Phase 1: Foundation | Complete |
| INFRA-05 | Phase 4: AI Guzman | Pending |
| INFRA-06 | Phase 3: Game Loop | Pending |
| SETUP-01 | Phase 1: Foundation | Complete |
| SETUP-02 | Phase 2: Game Lobby | Complete |
| SETUP-03 | Phase 2: Game Lobby | Complete |
| SETUP-04 | Phase 2: Game Lobby | Complete |
| SETUP-05 | Phase 2: Game Lobby | Complete |
| SETUP-06 | Phase 2: Game Lobby | Complete |
| LOOP-01 | Phase 3: Game Loop | Pending |
| LOOP-02 | Phase 3: Game Loop | Pending |
| LOOP-03 | Phase 3: Game Loop | Pending |
| LOOP-04 | Phase 3: Game Loop | Pending |
| LOOP-05 | Phase 3: Game Loop | Pending |
| LOOP-06 | Phase 3: Game Loop | Pending |
| LOOP-07 | Phase 3: Game Loop | Pending |
| LOOP-08 | Phase 3: Game Loop | Pending |
| LOOP-09 | Phase 3: Game Loop | Pending |
| LOOP-10 | Phase 3: Game Loop | Pending |
| ENGAGE-01 | Phase 5: Engagement | Pending |
| ENGAGE-02 | Phase 5: Engagement | Pending |
| ENGAGE-03 | Phase 5: Engagement | Pending |
| ENGAGE-04 | Phase 5: Engagement | Pending |
| ENGAGE-05 | Phase 5: Engagement | Pending |
| AI-01 | Phase 4: AI Guzman | Pending |
| AI-02 | Phase 4: AI Guzman | Pending |
| AI-03 | Phase 4: AI Guzman | Pending |
| AI-04 | Phase 4: AI Guzman | Pending |
| AI-05 | Phase 4: AI Guzman | Pending |
| AI-06 | Phase 2: Game Lobby | Complete |
| UX-01 | Phase 2: Game Lobby | Complete |
| UX-02 | Phase 2: Game Lobby | Complete |
| UX-03 | Phase 2: Game Lobby | Complete |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after roadmap creation -- all 36 requirements mapped*
