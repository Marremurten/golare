# Phase 3: Game Loop - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete 5-round daily game cycle — mission posting, Capo nomination, team voting, secret execution, and result reveal — on an automated schedule with all edge cases (failed votes, Kaos-mätaren, Sista Chansen) handled via template messages. AI-generated narratives, whispers, anti-passivity mechanics, and engagement features are separate phases (4-5).

</domain>

<decisions>
## Implementation Decisions

### Deadlines & timeouts
- Capo doesn't nominate before deadline → bot sends reminder 1h before; if still no nomination, rotates to next player and counts as a failed vote (Kaos-mätaren +1)
- Missing votes at deadline → count as abstain (only cast votes determine outcome, majority of actual votes decides)
- Team member doesn't choose [Säkra]/[Gola] before deadline → defaults to Säkra (assumes loyalty)
- Reminders sent both via DM to the player who needs to act AND a group chat reminder, 1h before each deadline

### Capo nomination UX
- Capo selects team via inline buttons in group chat — bot shows player list as toggleable buttons, Capo taps to select/deselect, then confirms
- Capo CAN include themselves on the team (standard Avalon-style)
- Rotation follows join order — predictable and fair, players can anticipate who's next
- Nomination happens publicly in group chat — everyone sees the deliberation, creates social pressure

### Vote & result transparency
- JA/NEJ votes are secret during voting, then ALL votes revealed at once after deadline (who voted what). Maximum drama.
- Live tally shows WHO has voted (but not what): "Röstat: 4/7" with names checked off. Encourages stragglers.
- Mission results show pass/fail + sabotage count: "Uppdraget misslyckades. 2 golare saboterade." Players know how many betrayed, not who.
- Kaos-mätaren displayed through Guzman's escalating tone — no explicit visual counter. His messages get more aggressive/paranoid with each consecutive failed vote. Players feel the pressure through narrative, not UI.

### Sista Chansen flow
- Guessing team gets a group DM discussion period — collaborative deliberation before the vote
- 2-hour window for discussion and voting — enough time to deliberate seriously
- Guess presented as inline buttons with all player names (same UX pattern as other votes)
- Symmetrisk: Ligan wins → Golare guess Högra Hand; Golare wins → Äkta guess one Golare
- Final reveal is delayed and dramatic — Guzman builds suspense with a message sequence before showing the result (30-60 second pacing)

### Claude's Discretion
- Exact scheduling implementation (cron, setTimeout, external scheduler)
- Template message copy and tone (within Guzman's established persona)
- State machine design and phase transition logic
- Database schema for rounds, votes, and mission results
- How the "group DM discussion" for Sista Chansen is technically implemented (could be a temporary group or sequential DMs)
- Exact reminder message timing and frequency

</decisions>

<specifics>
## Specific Ideas

- Daily schedule from PROJECT.md: 09:00 uppdrag, 12:00 Capo-val, 15:00 röstning, 18:00 utförande, 21:00 resultat
- Kaos-mätaren: 3 consecutive NEJ in a round → mission auto-fails, Golare get free point
- Team sizes from balancing table in PROJECT.md (2-4 members depending on player count)
- Win condition: best of 5 missions (first to 3 wins)
- All game state must persist in Supabase (survives restarts)
- Template messages only in this phase — AI-generated content comes in Phase 4

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-game-loop*
*Context gathered: 2026-02-10*
