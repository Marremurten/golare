# Phase 2: Behavioral Analysis - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A behavioral analysis module that computes per-player activity stats, classifies tone via heuristic keyword matching, builds compressed structured summaries that populate `GuzmanContext.playerNotes`, and detects behavioral anomalies. No user-facing changes — this is internal data processing that feeds Phase 3 (whispers) and Phase 4 (accusations).

</domain>

<decisions>
## Implementation Decisions

### Summary content & voice
- **Format:** Structured labels, not narrative — e.g. `Ton: defensiv | Aktivitet: hög | Anomali: ingen`
- **Language:** Swedish — consistent with the game language and existing Swedish prompts
- **Content:** Behavior classifications only — no quotes or paraphrases of what players said
- **Tone label flexibility:** Claude's discretion — fixed 5 categories (accusatory, defensive, quiet, neutral, chaotic) or primary+secondary blends, whichever works best for downstream prompts

### Behavioral priorities
- **Primary focus:** Overall pattern across the game, not just recent round activity
- **Relationships:** Include key relationship data — who a player engages with or targets most (e.g. "Riktar sig mot: Kansen")
- **Inactive players:** Minimal flag only — just "inaktiv" marker to save tokens for active players
- **Token budget:** Claude's discretion — aim for ~50 per player but flex within CONST-02 (2x baseline total) if useful data warrants it

### Anomaly sensitivity
- **Baseline:** Relative to the player's own history — a quiet player staying quiet is not an anomaly, an active player going silent is
- **Timeframe:** Track across rounds, not just per-round — enables patterns like "har blivit tystare varje runda"
- **Threshold tuning:** Claude's discretion — balance between trigger-happy (more paranoia) and reliable (fewer false positives)
- **Anomaly format in playerNote:** Claude's discretion — separate field or inline, whichever downstream prompts parse most effectively

### Claude's Discretion
- Tone label rigidity (fixed 5 vs primary+secondary blends)
- Token budget flexibility within CONST-02 constraint
- Anomaly detection sensitivity thresholds
- Anomaly format in playerNote (separate field vs inline)
- Heuristic keyword lists for Swedish suburb slang tone classification

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key constraint is that summaries are structured labels in Swedish, prioritize overall game pattern, and include relationship targeting data.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-behavioral-analysis*
*Context gathered: 2026-02-11*
