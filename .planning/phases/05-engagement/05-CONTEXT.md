# Phase 5: Engagement - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Non-team players get meaningful actions every phase — anonymous whispers, surveillance, and investigation (Spaning) — plus anti-blowout mechanics and a dramatic one-by-one role reveal at game end. This makes the async format engaging for every player every day, not just those on the current mission team.

</domain>

<decisions>
## Implementation Decisions

### Anonymous whisper flow
- Unlimited whispers — no per-round or per-window cap; let players whisper freely
- Players can send general whispers to the group OR target a specific player
- Guzman relays whispers with a cryptic hint about the sender's role (not identity) — adds a deduction layer for the group to analyze
- Claude's Discretion: UX for initiating whispers (DM command, inline button, etc.)

### Surveillance clues
- Non-team players can surveil a team member for a cryptic clue
- Surveilled player is SOMETIMES notified ("Någon har riktat blicken mot dig") — random chance, creates risk/reward
- Claude's Discretion: what kind of information the clue reveals (role-adjacent, action-based, or mixed)
- Claude's Discretion: how often surveillance can be used (per round vs per game) — balance for game pacing
- Claude's Discretion: whether clue goes to surveiller's DM or is shared through Guzman to group

### Spaning (investigation)
- Each Äkta player gets one Spaning per game — ask Guzman about a player's role
- Guzman answers mostly truthfully (70-80% chance of truth, 20-30% chance of lie) — creates doubt even after using it
- Högra Hand's Spaning remains guaranteed truthful (already implemented in Phase 3)
- When someone uses Spaning, Guzman announces to the group that a Spaning happened (but not who used it or who was targeted) — "Någon har bett mig kolla runt..."
- Claude's Discretion: how to differentiate Äkta's Spaning presentation from Högra Hand's (cryptic vs clear)
- Claude's Discretion: timing restrictions for when Spaning can be used

### Anti-blowout scoring
- Final rounds worth double points for comeback possibility
- Claude's Discretion: exact double-point math (which rounds, how it interacts with first-to-3)

### Role reveal ceremony
- One-by-one dramatic reveal — Guzman reveals each player's role individually with dramatic flair
- Reveal order: Äkta first, Golare last — build suspense, save traitors for the finale
- Claude's Discretion: how to sequence role reveal with Sista Chansen for maximum drama

### Claude's Discretion (summary)
- Whisper initiation UX (DM command vs inline button)
- Surveillance clue type, frequency, and delivery method
- Äkta Spaning presentation style and timing restrictions
- Double-point round math and interaction with win conditions
- Role reveal + Sista Chansen sequencing

</decisions>

<specifics>
## Specific Ideas

- Guzman's cryptic hints on whispers should feel like his paranoid personality — not objective clues but Guzman's "read" on the person
- Surveillance notification ("sometimes caught") creates a natural paranoia mechanic — fits the game's theme perfectly
- Spaning group notification without details drives speculation: "Who asked? About whom?"
- Role reveal should be a dramatic payoff moment — Äkta confirmed safe one by one, tension builds, Golare dropped last for maximum impact

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-engagement*
*Context gathered: 2026-02-10*
