# Roadmap: Golare v1.1 — AI Behavioral Awareness

**Goal:** Make Guzman reactive to real player behavior — tracking what players write in group chat and using that data to personalize whispers, adapt narratives, and call out suspicious behavior.

## Phases

### Phase 1: Data Pipeline ✓

**Goal**: Player group messages are captured, stored in a ring buffer (last ~10 per player), and the bot verifies admin status for message visibility — all without any user-facing changes.
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, CONST-01
**Plans:** 2 plans
**Completed:** 2026-02-11

Plans:
- [x] 01-01-PLAN.md — Database schema, types, and CRUD for player_messages ring buffer
- [x] 01-02-PLAN.md — Message capture module, bot middleware wiring, and admin check

### Phase 2: Behavioral Analysis ✓

**Goal**: A behavioral analysis module computes per-player activity stats and tone classifications, builds compressed summaries that populate `GuzmanContext.playerNotes`, and detects behavioral anomalies — still no user-facing changes.
**Depends on**: Phase 1
**Requirements**: BEHAV-01, BEHAV-02, BEHAV-03, BEHAV-04, CONST-02
**Plans:** 1 plan
**Completed:** 2026-02-11

Plans:
- [x] 02-01-PLAN.md — Behavioral analysis module (stats, tone, anomalies, summaries) and integration into updateNarrativeContext

### Phase 3: Whisper Integration

**Goal**: Guzman's whisper DMs reference actual player behavior — paraphrasing what players said (twisted, out of context), including behavioral summaries for all players, with prompt rules enforcing oblique references only.
**Depends on**: Phase 2
**Requirements**: WHISP-01, WHISP-02, WHISP-03, CONST-03
**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Behavioral data helpers and behavior-aware whisper prompt rewrite
- [ ] 03-02-PLAN.md — AI generation wiring and whisper handler integration

### Phase 4: Gap-Fill & Accusations

**Goal**: Gap-fill commentary adapts to group mood, and Guzman publicly calls out suspicious behavior (silence, aggression spikes) with controlled frequency — making the group chat feel like Guzman is always watching.
**Depends on**: Phase 3
**Requirements**: GROUP-01, GROUP-02, GROUP-03, CONST-04

Plans:
- (not yet planned)

### Phase 5: Mission Adaptation

**Goal**: Mission narratives include a group dynamics section that reflects recent player behavior patterns, making each mission post feel tailored to the current game atmosphere.
**Depends on**: Phase 2
**Requirements**: GROUP-04

Plans:
- (not yet planned)

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Zero new dependencies | Existing stack (grammY, Supabase, OpenAI gpt-4.1-nano) covers all needs |
| Heuristic-first tone analysis | Cheaper and more reliable than Swedish NLP libraries for orten-slang |
| Compressed summaries, not raw messages | Keeps token budget at 2x baseline vs 5x with raw messages |
| Accusations piggyback on gap-fill | Reuses existing scheduler and infrastructure, no new cron jobs |
| playerNotes as integration seam | Already exists in GuzmanContext, already read by whisper prompts |
| Fire-and-forget message capture | Message storage must never block handler chain |

---
*Created: 2026-02-11*
