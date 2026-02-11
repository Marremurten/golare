# Phase 3: Whisper Integration - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Guzman's whisper DMs become behavior-aware — referencing what players actually said (twisted, out of context), including behavioral summaries for all players, with prompt rules enforcing oblique references only. Guzman never quotes directly or references timestamps. This phase modifies whisper prompt construction only; no new message types, no game mechanic changes.

</domain>

<decisions>
## Implementation Decisions

### Paraphrasing style
- Context-dependent distortion: twist innocent messages more, keep already-suspicious messages closer to reality
- Guzman's voice is **gossip dealer**: "Mannen, du vet inte vad folk säger om dig..." — spreading rumors, creating paranoia between players
- Occasionally weave multiple players' messages into conspiracy narratives, but only when messages happen to line up in a suspicious-looking way — don't force it
- Never quote directly or reference timestamps (WHISP-03) — everything framed as gossip and rumors Guzman "heard"

### Behavioral density
- Behavioral data about OTHER players: depends on what's notable — if everyone's boring, brief overview; if someone stands out, zoom in on them
- Target player's own behavior: mix of direct confrontation ("du har vart tyst") and indirect framing ("folk har märkt att...")  — keep the player guessing which voice Guzman is using
- No hard cap on behavioral references per whisper — let the prompt and AI decide naturally based on available signal

### Paranoia calibration
- Baseline aggression varies by game role: more aggressive/confrontational toward informants (snitches), more seductive/conspiratorial toward the mole
- Disinformation: mostly truthful behavioral references, but RARELY drop a complete lie as a wildcard — players can never fully trust whispers
- Anomaly reaction proportional to severity: small behavioral shift = subtle mention, big change = dramatic callout
- Role-behavior contradictions (e.g. mole being super helpful): subtly flag to OTHER players — "nån här spelar hjälte lite för hårt" — without naming the mechanic

### Trigger conditions
- Every whisper includes behavioral references — Guzman always reads the room, even if it's just a brief mention
- Gossip distribution: mix of shared and exclusive intel — some gossip goes to multiple players with different spin (conflicting narratives), some is exclusive to one player (information asymmetry)
- Behavioral references are purely flavor — they shape what Guzman SAYS but never influence game mechanics, targeting, or outcomes

### Claude's Discretion
- Whether paraphrasing escalates over game rounds (vague early → pointed late) or stays consistent
- How to handle thin behavioral data (early game, quiet players) — graceful fallback vs speculation
- Trust/doubt balance — whether Guzman occasionally reassures players ("du är den enda jag litar på") as a manipulation tool

</decisions>

<specifics>
## Specific Ideas

- Guzman as gossip dealer is the core persona for behavioral whispers — he's spreading rumors, not making observations
- Cross-player conspiracy narratives should feel natural, not forced — only connect dots when the data supports it
- Conflicting narratives across players is a key feature: tell player A one thing about player B, tell player C something different about the same behavior

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-whisper-integration*
*Context gathered: 2026-02-11*
