# Phase 5: Mission Adaptation - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Mission narratives include a group dynamics section that reflects recent player behavior patterns, making each mission post feel tailored to the current game atmosphere. Group dynamics can also softly influence which mission template gets selected. This phase does NOT add new mission types, new game mechanics, or new message channels.

</domain>

<decisions>
## Implementation Decisions

### Dynamics section format
- Claude's discretion on placement (woven into narrative, separate block, or opening paragraph) — pick what fits the existing mission format best
- Claude's discretion on length — scale based on available behavioral data
- Group dynamics should softly influence mission template selection (e.g., tense group biased toward betrayal-themed missions) — not a hard mapping, keeps variety

### Player reference style
- Mix of named callouts and vague allusions — sometimes "@Erik har varit suspekt tyst", sometimes "någon här spelar ett dubbelspel"
- Claude's discretion on how many players to reference per mission — scale based on how many have notable behavior
- Claude's discretion on whether to reference specific things players said (twisted/paraphrased) vs. behavioral patterns only
- Claude's discretion on whether to drop subtle role hints or stay purely behavioral

### Tone & provocation level
- Claude's discretion on tone — can range from provocative to ominous to narration, consistent with Guzman's established suburb slang voice
- Claude's discretion on escalation pattern across rounds
- Claude's discretion on truthfulness — Guzman references real behavior but may twist/frame for maximum suspicion
- Claude's discretion on voice (direct address vs. narration)

### Claude's Discretion
Wide latitude on this phase. The one locked decision is:
- **Mission selection influence**: Group dynamics softly bias which mission template gets picked (not hard steer)
- **Player references**: Must be a mix of named and vague (not always one or the other)

Everything else — format, length, tone, escalation, fallback behavior, thresholds — Claude decides based on existing codebase patterns and what produces the best game experience.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The existing Guzman voice (suburb slang, manipulative, always-watching) should carry through into the dynamics section naturally.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-mission-adaptation*
*Context gathered: 2026-02-12*
