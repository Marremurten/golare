# Phase 2: Game Lobby - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

An admin can start a game in a group, players join via inline buttons, roles are assigned secretly via DM with correct balancing, and all players can access rules and status at any time. The game loop mechanics (missions, voting, execution) belong to Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Lobby join experience
- Join via inline button ("Jag är med") on the lobby message — one tap to join
- Admin starts the game manually with a "Kör igång" button — full control, no auto-start
- Lobby message updates live as players join/leave, showing names and count (e.g. "3/10 spelare: @anna, @erik, @lisa")
- Players can leave the lobby with a "Hoppa av" button before game starts — list updates accordingly
- Min 4, max 10 players enforced (from balancing table)

### Role reveal moment
- Full Guzman voice in the role DM — in-character suburb slang, not clinical
- Each DM includes full brief: role name, team, abilities, and win condition — everything the player needs
- Golare receive a named list of other Golare identities in the same DM (e.g. "Dina bröder i skiten: @erik, @lisa")
- Högra Hand DM confirms their Spaning ability with explanation
- All role DMs sent simultaneously — no staggering

### Game kickoff sequence
- Dramatic Guzman monologue posted to the group when game starts — sets the mood, warns about traitors
- Monologue weaves in a brief rules recap naturally — not a wall of text, but enough to get started
- First mission posts shortly after game start (immediately), regardless of time of day — then daily schedule kicks in from next day
- Admin can cancel the game at any point with /avbryt command — clean slate

### Rules & status display
- /regler uses structured sections with Guzman flavor — clean headings (🔴 Roller, 🟢 Uppdrag, etc.) with in-character headlines
- /regler is paginated with inline buttons — "Roller" / "Spelgång" / "Vinst" sections, keeps each page short
- /status shows score + current phase + full player list + current Capo (e.g. "Ligan 2 — Aina 1 | Runda 4 | Väntar på röstning")
- Both /regler and /status work in group chat AND private DM — in DM may show extra info like your role and abilities

### Claude's Discretion
- Exact lobby message formatting and emoji usage
- Guzman monologue content and length
- /regler section breakdown and wording
- /status formatting and layout
- Error messages for edge cases (not enough players, already in game, etc.)
- How /avbryt confirmation works

</decisions>

<specifics>
## Specific Ideas

- Role reveal should feel like a dramatic moment — Guzman personally addressing you, not a system notification
- The lobby should feel active and social — seeing names appear builds anticipation
- Paginated rules lets new players learn without overwhelming, and experienced players can skip to what they need
- /status in DM showing your own role is a nice touch for players who forget what they are mid-game

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-game-lobby*
*Context gathered: 2026-02-10*
