# Phase 4: Gap-Fill & Accusations - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Gap-fill commentary adapts to group mood, and Guzman publicly calls out suspicious behavior (silence, aggression spikes) with controlled frequency — making the group chat feel like Guzman is always watching. Requirements: GROUP-01, GROUP-02, GROUP-03, CONST-04.

</domain>

<decisions>
## Implementation Decisions

### Accusation triggers
- Both silence and behavior shifts are primary triggers, weighted equally
- Guzman only comments on actual observed behavior — never fabricates suspicion or false accusations
- Accusations reference specific things players said or did — concrete, chilling callouts, not vague hints

### Accusation tone & style
- Street boss intimidation — direct, aggressive orten-slang in public accusations
- Mix of direct @mentions and third-person references — varies to keep players guessing
- Same energy public and private — Guzman's personality is consistent across group chat and DMs

### Gap-fill mood adaptation
- Gap-fill commentary is always provocative regardless of current mood — designed to increase tension
- Gap-fill stays general/atmospheric — no specific player behavior references (accusations handle that)
- Mood adaptation affects both content and timing — tense games get more frequent gap-fills, calm games get less

### Frequency & cooldown
- Max 2 accusations per round — enough pressure without being spammy
- No hard per-round minimum — if no behavioral anomalies, accusations are optional

### Claude's Discretion
- Whether accusations are sometimes accurate (pointing at actual mole) or always ambiguous — balance for maximum paranoia
- Whether Guzman sometimes asks the group to react to accusations or just drops statements
- Per-player targeting cooldown — whether to spread accusations around or allow repeat targeting when warranted
- Accusation escalation curve over the course of a game (ramp up or consistent)
- Fallback behavior when no anomalies detected — stay quiet or generic provocation
- Mood granularity — how many distinct moods to recognize (binary tense/calm vs multiple)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-gap-fill-accusations*
*Context gathered: 2026-02-11*
