# Roadmap: Golare

## Overview

Golare is an async Telegram social deduction game with an AI game master (Guzman). The roadmap delivers infrastructure first, then a working game lobby, then the complete 5-round game loop with template messages, then layers AI personality on top, and finally adds the engagement mechanics that make async viable. Each phase produces a verifiable, playable increment. By Phase 3 the game is fully playable (with templates); Phases 4-5 add the soul and the competitive moat.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Bot connects to Telegram, persists state in Supabase, and handles DM permissions
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
- [ ] 01-01-PLAN.md -- Project setup, grammY bot skeleton, Supabase schema + client, Swedish message templates
- [ ] 01-02-PLAN.md -- Per-chat message queue with rate limiting, DM permission flow (deep links, callouts, reminders)
- [ ] 01-03-PLAN.md -- /start command handler with deep link detection, bot wiring, end-to-end verification

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
**Plans**: TBD

Plans:
- [ ] 02-01: Game creation (/nyttspel), lobby flow, and player join
- [ ] 02-02: Role assignment engine and secret DM delivery
- [ ] 02-03: Template messages, intro sequence, /regler and /status commands

### Phase 3: Game Loop
**Goal**: A complete 5-round game plays through the full daily cycle -- mission posting, Capo nomination, team voting, secret execution, and result reveal -- on an automated schedule, with all edge cases (failed votes, Kaos-mataren, Sista Chansen) handled via template messages.
**Depends on**: Phase 2
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06, LOOP-07, LOOP-08, LOOP-09, LOOP-10, INFRA-06
**Success Criteria** (what must be TRUE):
  1. At 09:00 (or triggered manually), Guzman posts a mission description to the group; at 12:00 the current Capo is prompted to nominate a team of the correct size for the player count
  2. Group members vote JA/NEJ via inline buttons at 15:00; if rejected, Capo rotates to next player and a new nomination begins; after 3 consecutive NEJ the mission auto-fails and Golare score a point
  3. Approved team members receive private buttons at 18:00 to choose Sakra or Gola; at 21:00 the result is revealed to the group (mission succeeds only if all chose Sakra)
  4. After one side reaches 3 mission wins, the Symmetrisk Sista Chansen triggers -- the losing side gets one guess to flip the outcome
  5. Scheduled events fire automatically at the correct daily times and survive bot restarts (scheduler reads pending game state from database on startup)
**Plans**: TBD

Plans:
- [ ] 03-01: State machine, daily event scheduler, and phase transitions
- [ ] 03-02: Nomination, voting (with Kaos-mataren), and Capo rotation
- [ ] 03-03: Mission execution, result reveal, and win condition tracking
- [ ] 03-04: Symmetrisk Sista Chansen and end-of-game flow

### Phase 4: AI Guzman
**Goal**: Guzman comes alive as an AI-driven persona -- generating unique mission narratives, dramatic result reveals, manipulative private whispers, and reactive gap-fill commentary -- with template fallbacks ensuring the game never breaks if OpenAI is unavailable.
**Depends on**: Phase 3
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, INFRA-05
**Success Criteria** (what must be TRUE):
  1. Each of the 5 daily missions has a unique AI-generated narrative written in Guzman's voice (Swedish suburb slang, paranoid tone) -- no two missions read the same
  2. Guzman sends private whisper DMs to players between scheduled events -- containing suspicion, lies, or manipulation that reference actual game state (who voted what, who was on teams)
  3. When the group chat is quiet for extended periods between events, Guzman posts reactive commentary (comments on silence, calls out suspicious behavior, stirs paranoia)
  4. If the OpenAI API is unavailable or returns an error, every game event still fires with a pre-written template message -- no game state is blocked by AI failure
  5. Guzman maintains consistent Swedish slang persona (bre, shuno, aina, para) across all 5 rounds without drifting into generic language
**Plans**: TBD

Plans:
- [ ] 04-01: OpenAI integration, prompt engineering, and template fallback system
- [ ] 04-02: AI-generated missions and result narratives
- [ ] 04-03: Viskningar (whisper DMs) and gap-fill commentary

### Phase 5: Engagement
**Goal**: Non-team players have meaningful actions every phase -- anonymous whispers, surveillance, and investigation -- plus anti-blowout mechanics and a dramatic role reveal at game end, making the async format engaging for every player every day.
**Depends on**: Phase 4
**Requirements**: ENGAGE-01, ENGAGE-02, ENGAGE-03, ENGAGE-04, ENGAGE-05
**Success Criteria** (what must be TRUE):
  1. A non-team player can send an anonymous message that appears in the group chat attributed to Guzman, not to the player
  2. A non-team player can surveil a team member and receive a cryptic clue about that member's mission action (without revealing the exact choice)
  3. Each player can use their one-per-game Spaning to ask Guzman about another player's role -- and the answer may be true or false (unreliable investigation)
  4. When the score is 2-1 or 2-2 entering the final rounds, those rounds are worth double points, creating comeback possibility
  5. When the game ends, all players see a complete role reveal showing every player's true role, every mission action they took, and who betrayed whom
**Plans**: TBD

Plans:
- [ ] 05-01: Anonymous whispers and surveillance mechanics
- [ ] 05-02: Spaning (investigation), anti-blowout, and role reveal

## Progress

**Execution Order:**
Phases execute in numeric order: 1 --> 2 --> 3 --> 4 --> 5

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundation | 0/3 | Planning complete | - |
| 2. Game Lobby | 0/3 | Not started | - |
| 3. Game Loop | 0/4 | Not started | - |
| 4. AI Guzman | 0/3 | Not started | - |
| 5. Engagement | 0/2 | Not started | - |
