# Phase 4: AI Guzman - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform Guzman from static template strings into a living AI character. Guzman generates unique mission narratives, dramatic result reveals, manipulative private whispers, and reactive gap-fill commentary — with template fallbacks ensuring the game never breaks if OpenAI is unavailable. Game mechanics (voting, execution, win conditions) are already complete from Phase 3. This phase adds soul, not structure.

</domain>

<decisions>
## Implementation Decisions

### Guzman's personality
- Full orten suburb slang — yalla, wallah, mannen, bror. Rosengård/Rinkeby register throughout
- Manipulation style: both paranoia-stirring AND playing favorites. Drops hints that make everyone suspect each other, publicly praises/mocks specific players, creates social pressure
- Occasionally breaks the fourth wall — mostly in character but sometimes jokes about the game being a game. Light meta-humor, not constant
- Claude's Discretion: whether Guzman's personality is consistent across games or varies by mood per game

### Narrative style
- Full story narratives for mission briefings — multiple paragraphs with character, setting, stakes
- Continuous story arc across rounds — Round 1's outcome affects Round 2's narrative. Serial storytelling throughout a game
- Dramatic buildup for result reveals — tension-building, teasing, hinting before dropping the outcome. Theatrical
- Always references specific players by name — "@Erik, du var tyst idag... intressant." Makes it personal and social throughout narratives, not just reveals

### Whisper behavior (Viskningar)
- Dual trigger system: scheduled baseline whispers per round (1-2 players) PLUS bonus whispers triggered by game events (failed missions, close votes, suspicious patterns)
- Guzman sometimes lies — mix of truth, half-truths, and outright lies. Players never know what to believe. Peak paranoia
- Info scope: role-adjacent hints — "Jag litar inte på alla i det laget, bror." Directional hints about roles but never explicit role reveals. Voting pattern hints, behavioral observations
- Claude's Discretion: whether whispers feel exclusive or sometimes hint that others got whispers too — whatever creates the most drama per situation

### Fallback experience
- In-character acknowledgment when AI is unavailable — Guzman says something like "Orka snacka idag..." rather than silently swapping to templates
- Claude's Discretion: number of template variants per message type (balance effort vs variety)
- Claude's Discretion: whether whispers use templates or are disabled during fallback
- Claude's Discretion: cost management strategy (budget caps, smart model routing, or hybrid)

</decisions>

<specifics>
## Specific Ideas

- Guzman should feel like a real person from the suburbs running this game — not a polished AI. Raw, chaotic energy
- The continuous story arc should make each game feel like its own mini-series. Players should want to see how the narrative develops round to round
- Whisper lies create the core paranoia loop — a player gets told something, shares it in group chat, but maybe it was a lie. Social chaos
- Fallback mode should feel like Guzman is having an off day, not like the system broke

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-ai-guzman*
*Context gathered: 2026-02-10*
