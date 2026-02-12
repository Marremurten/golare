# Requirements: Golare v1.1 — AI Behavioral Awareness

**Defined:** 2026-02-11
**Core Value:** Make Guzman reactive to real player behavior — tracking what players write in group chat and using that data to personalize whispers, adapt narratives, and call out suspicious behavior.

## v1.1 Requirements

### Data Pipeline

- [ ] **DATA-01**: Capture player text messages from group chat (message text, sender, timestamp) via middleware extension
- [ ] **DATA-02**: Store last ~10 messages per player per game in dedicated DB table with automatic pruning
- [ ] **DATA-03**: Filter out bot messages, non-player messages, DM messages, and commands before storage
- [ ] **DATA-04**: Verify bot has admin status in group at game creation (required for message visibility)

### Behavioral Analysis

- [ ] **BEHAV-01**: Compute per-player activity stats: message count, average length, time since last message, message frequency
- [ ] **BEHAV-02**: Detect behavioral tone via heuristic keyword matching (accusatory, defensive, quiet, neutral, chaotic) using Swedish game-context keywords
- [ ] **BEHAV-03**: Build compressed behavioral summaries (~50 tokens per player) that populate `GuzmanContext.playerNotes`
- [ ] **BEHAV-04**: Detect behavioral anomalies: suspicious silence (active→quiet), aggression spikes, behavior shifts within a round

### AI Integration — Whispers

- [ ] **WHISP-01**: Whisper prompts include target player's behavioral summary and 1-2 actual message quotes (paraphrased, never verbatim)
- [ ] **WHISP-02**: Whisper prompts include all players' behavioral overview for context
- [ ] **WHISP-03**: Prompt rules enforce oblique references only — Guzman speaks from "gut feeling," never quotes directly or references timestamps

### AI Integration — Group Messages

- [ ] **GROUP-01**: Gap-fill commentary adapts to group mood (active/quiet, aggressive/cautious) using behavioral context
- [ ] **GROUP-02**: Guzman publicly calls out suspicious behavior (silence, aggression) via accusation system piggybacked on gap-fill schedule
- [ ] **GROUP-03**: Accusation frequency controlled: max 1 per 4-hour window, never same player twice in a row
- [x] **GROUP-04**: Mission narratives include group dynamics section reflecting recent player behavior patterns

### Constraints

- [x] **CONST-01**: Zero new npm dependencies — all capabilities use existing stack (grammY, Supabase, OpenAI)
- [x] **CONST-02**: Token budget increase capped at 2x baseline (~500 additional tokens per AI call via compressed summaries)
- [x] **CONST-03**: All behavioral data is internal to AI — never exposed as stats or indicators to players
- [x] **CONST-04**: All new AI paths have template/null fallbacks — game never blocks on OpenAI failure

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| Direct message quoting | Feels like surveillance; breaks paranoia ambiguity |
| Exposed activity stats | Turns game into activity optimization, not social deduction |
| Real-time reactive messages | Notification fatigue; reactions should be in scheduled outputs |
| Cross-game behavioral memory | Complexity; each game is self-contained for v1.1 |
| Twisted/fabricated references | Needs careful prompt engineering to avoid confusion; defer to v1.2 |
| Message edit/deletion tracking | Minimal value; original messages are sufficient |
| Per-message AI analysis | Cost explosion; batch at generation time instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1: Data Pipeline | Complete |
| DATA-02 | Phase 1: Data Pipeline | Complete |
| DATA-03 | Phase 1: Data Pipeline | Complete |
| DATA-04 | Phase 1: Data Pipeline | Complete |
| BEHAV-01 | Phase 2: Behavioral Analysis | Complete |
| BEHAV-02 | Phase 2: Behavioral Analysis | Complete |
| BEHAV-03 | Phase 2: Behavioral Analysis | Complete |
| BEHAV-04 | Phase 2: Behavioral Analysis | Complete |
| WHISP-01 | Phase 3: Whisper Integration | Complete |
| WHISP-02 | Phase 3: Whisper Integration | Complete |
| WHISP-03 | Phase 3: Whisper Integration | Complete |
| GROUP-01 | Phase 4: Gap-Fill & Accusations | Complete |
| GROUP-02 | Phase 4: Gap-Fill & Accusations | Complete |
| GROUP-03 | Phase 4: Gap-Fill & Accusations | Complete |
| GROUP-04 | Phase 5: Mission Adaptation | Complete |
| CONST-01 | All Phases | Complete |
| CONST-02 | All Phases | Complete |
| CONST-03 | All Phases | Complete |
| CONST-04 | All Phases | Complete |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Defined: 2026-02-11*
