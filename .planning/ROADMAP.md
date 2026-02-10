# Roadmap: Golare

## Overview

Golare is an async Telegram social deduction game with an AI game master (Guzman). The roadmap delivers infrastructure first, then a working game lobby, then the complete 5-round game loop with template messages, then layers AI personality on top, and finally adds the engagement mechanics that make async viable. Each phase produces a verifiable, playable increment. By Phase 3 the game is fully playable (with templates); Phases 4-5 add the soul and the competitive moat.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Bot connects to Telegram, persists state in Supabase, and handles DM permissions
- [ ] **Phase 2: Game Lobby** - Players create games, receive secret roles via DM, and see rules
- [ ] **Phase 3: Game Loop** - Complete 5-round daily cycle plays through with template messages
- [ ] **Phase 4: AI Guzman** - AI persona generates narratives, whispers, and reacts to group activity
- [ ] **Phase 5: Engagement** - Anti-passivity mechanics keep every player active between events

## Phase Details

### Phase 1: Foundation
**Goal**: Bot connects to Telegram, persists all state in Supabase, queues messages with rate limiting, and handles the DM permission flow so every downstream feature has reliable infrastructure.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, SETUP-01
**Success Criteria** (what must be TRUE):
  1. User sends /start to bot in private chat and receives a welcome response; their user_id and chat_id are stored in Supabase
  2. Bot process is killed and restarted; all previously registered players are still present in the database with no data loss
  3. Bot sends 25 messages in rapid succession to a group chat; all 25 arrive (queued, not dropped) without hitting Telegram 429 errors
  4. A user who has NOT /start'd the bot taps a deep link in the group; they are guided to private chat, complete /start, and the bot confirms DM access
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md -- Project setup, grammY bot skeleton, Supabase schema + client, Swedish message templates
- [x] 01-02-PLAN.md -- Per-chat message queue with rate limiting, DM permission flow (deep links, callouts, reminders)
- [x] 01-03-PLAN.md -- /start command handler with deep link detection, bot wiring, end-to-end verification

### Phase 2: Game Lobby
**Goal**: An admin can start a game in a group, players join, roles are assigned secretly via DM with correct balancing, and all players can access rules and status at any time.
**Depends on**: Phase 1
**Requirements**: SETUP-02, SETUP-03, SETUP-04, SETUP-05, SETUP-06, AI-06, UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Admin sends /nyttspel in a group chat with 6 registered players; a lobby is created, players join, and game starts when admin confirms
  2. After game start, each player receives a private DM revealing their secret role (Akta, Golare, or Hogra Hand) with correct distribution per the balancing table
  3. Each Golare player receives a DM listing the identities of all other Golare in the game
  4. Hogra Hand player receives a DM confirming their special Spaning ability
  5. Any player can type /regler and get a clear rules overview, or /status and see current game state -- at any point during the game
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md -- DB schema (games + game_players), lobby handler (/nyttspel, join/leave/start buttons)
- [ ] 02-02-PLAN.md -- Role assignment engine, secret role DMs, game start monologue, /avbryt
- [ ] 02-03-PLAN.md -- Paginated /regler, /status with DM role info, replace placeholder rules

### Phase 3: Game Loop
**Goal**: A complete 5-round game plays through the full daily cycle -- mission posting, Capo nomination, team voting, secret execution, and result reveal -- on an automated schedule, with all edge cases (failed votes, Kaos-mataren, Sista Chansen) handled via template messages.
**Depends on**: Phase 2
**Requirements**: LOOP-01 through LOOP-10, INFRA-06
**Plans**: TBD

Plans:
- [ ] 03-01: State machine, daily event scheduler, and phase transitions
- [ ] 03-02: Nomination, voting (with Kaos-mataren), and Capo rotation
- [ ] 03-03: Mission execution, result reveal, and win condition tracking
- [ ] 03-04: Symmetrisk Sista Chansen and end-of-game flow

### Phase 4: AI Guzman
**Goal**: Guzman comes alive as an AI-driven persona -- generating unique mission narratives, dramatic result reveals, manipulative private whispers, and reactive gap-fill commentary -- with template fallbacks ensuring the game never breaks if OpenAI is unavailable.
**Depends on**: Phase 3
**Plans**: TBD

Plans:
- [ ] 04-01: OpenAI integration, prompt engineering, and template fallback system
- [ ] 04-02: AI-generated missions and result narratives
- [ ] 04-03: Viskningar (whisper DMs) and gap-fill commentary

### Phase 5: Engagement
**Goal**: Non-team players have meaningful actions every phase -- anonymous whispers, surveillance, and investigation -- plus anti-blowout mechanics and a dramatic role reveal at game end, making the async format engaging for every player every day.
**Depends on**: Phase 4
**Plans**: TBD

Plans:
- [ ] 05-01: Anonymous whispers and surveillance mechanics
- [ ] 05-02: Spaning (investigation), anti-blowout, and role reveal

## Progress

**Execution Order:**
Phases execute in numeric order: 1 --> 2 --> 3 --> 4 --> 5

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundation | 3/3 | ✓ Complete | 2026-02-10 |
| 2. Game Lobby | 0/3 | Planning complete | - |
| 3. Game Loop | 0/4 | Not started | - |
| 4. AI Guzman | 0/3 | Not started | - |
| 5. Engagement | 0/2 | Not started | - |
