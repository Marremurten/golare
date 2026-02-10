# Phase 1: Foundation - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Bot connects to Telegram via grammY, persists all state in Supabase, queues messages with rate limiting, and handles the DM permission flow. This is the infrastructure layer — every downstream feature (lobby, game loop, AI) depends on this working reliably.

</domain>

<decisions>
## Implementation Decisions

### Welcome experience (/start)
- Brief intro + confirmation — not minimal, not full onboarding. A taste of Guzman + registration confirmation
- Guzman's persona is present from the very first message. The bot IS Guzman from day one — slang, attitude, personality immediately
- Context-aware response: deep link from group gets a tailored message referencing the game context; direct /start gets a generic Guzman welcome
- Include one inline button (e.g. "Regler") alongside the welcome text

### DM permission flow
- Guzman calls out unregistered players by name in the group chat with the deep link — not a generic button, a direct callout
- Soft timeout: deep link works forever, but after ~5 minutes Guzman sends one group reminder poking the player
- After a player completes /start via deep link, Guzman announces it in the group ("X ar inne") so everyone sees who's ready

### Bot language & tone
- Swedish throughout — all messages, commands, buttons, errors. Everything in Swedish
- Commands are Swedish: /regler, /nyttspel, /status (not /rules, /newgame)
- Guzman is always in character, even in system/utility messages. Errors, confirmations, status — everything sounds like Guzman
- Emojis used liberally — part of the vibe, fits Telegram culture
- Core slang vocabulary from spec: bre, shuno, aina, para. Stick to what's defined in PROJECT.md

### Error messaging
- Always tell the player when something goes wrong, in character. No silent failures from the player's perspective
- On /start failure: ask them to retry directly ("Bre, det gick inte. Skicka /start igen.") — no auto-retry
- Varied reactions: 3-5 different error lines per error type. Keeps it feeling alive, not robotic
- Queue delays: if message queue delay exceeds ~5 seconds, Guzman acknowledges it ("Lugn, jag haller pa...")

### Claude's Discretion
- Exact welcome message copy (within the constraints above)
- Loading/typing indicators
- Database schema design and table structure
- Message queue implementation details (priority, retry internals)
- Deep link parameter format
- Exact timeout duration for the DM reminder

</decisions>

<specifics>
## Specific Ideas

- Guzman should feel like a real character from the first interaction, not a bot. The /start message sets the tone for the entire game
- Group announcements when players register ("X ar inne") build anticipation before a game even starts
- The callout mechanic for unregistered players is intentionally social pressure — Guzman publicly telling someone to DM him fits the game's social dynamics

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-10*
