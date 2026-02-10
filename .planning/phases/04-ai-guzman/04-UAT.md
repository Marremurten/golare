---
status: complete
phase: 04-ai-guzman
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-02-10T20:10:00Z
updated: 2026-02-10T20:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bot starts without OPENAI_API_KEY
expected: Remove/comment OPENAI_API_KEY from .env. Run bot. Console shows AI disabled message. No crash, game works normally on templates.
result: skipped
reason: User tested with key set instead

### 2. Bot starts with OPENAI_API_KEY
expected: Set a valid OPENAI_API_KEY in .env. Run bot. Console shows: "[ai-client] OpenAI client initialized". Scheduler shows "Started 11 cron jobs" (was 8 before Phase 4).
result: pass

### 3. AI mission narrative replaces static template
expected: During an active game, at 09:00 (or trigger manually), the mission post in the group is a unique dramatic narrative from Guzman -- not the static "Ligan! Runda X" template. It's longer, story-driven, and references player names.
result: pass

### 4. AI result reveal with drama
expected: At 21:00 (or when mission resolves), the result message is a dramatic AI-generated reveal -- building suspense before showing success/fail. Different from the static template. References team members by name.
result: pass

### 5. Guzman speaks Swedish orten slang
expected: AI-generated messages use proper Swedish with åäö characters and orten suburb slang (bre, shuno, wallah, mannen, etc.). The tone is paranoid criminal leader -- theatrical, life-and-death framing.
result: pass

### 6. Template fallback on AI failure
expected: If OPENAI_API_KEY is invalid or OpenAI is down, mission posts and result reveals fall back to template messages seamlessly. Game continues. Console shows "[ai-guzman] ... failed, using template:" warnings. The fallback templates now have variety (3 variants each).
result: pass

### 7. Whisper DMs arrive to players
expected: During an active game, at 13:00 and/or 19:00, 1-2 players receive private DMs from Guzman with manipulative messages -- mixing hints, suspicion, and lies about other players. Whispers reference observable game events (votes, teams), never explicitly reveal roles.
result: pass

### 8. Event whispers after game events
expected: After a failed mission, a close vote (margin of 1), or kaos-mataren trigger, a bonus whisper DM is sent to 1 player shortly after. These are fire-and-forget (don't delay the game flow).
result: pass

### 9. Gap-fill commentary during quiet periods
expected: If the group chat is quiet (< 2 messages in 2 hours during 09:00-21:00), Guzman sends a reactive comment to the group at 14:00 or 20:00 -- stirring drama, commenting on silence, or provoking players. Skipped silently if AI is unavailable.
result: pass

### 10. Narrative builds across rounds
expected: By Round 3+, AI-generated mission narratives and result reveals reference events from earlier rounds -- the story arc evolves. Guzman's mood shifts based on outcomes (angrier after losses, cockier after wins).
result: pass

### 11. Whispers disabled without AI
expected: When OPENAI_API_KEY is not set, no whisper DMs are sent. No gap-fill commentary. Game runs purely on templates. No errors in console from whisper/gap-fill systems.
result: pass

### 12. DB migration runs cleanly
expected: Run the Phase 4 schema additions against Supabase: ALTER TABLE games ADD COLUMN guzman_context, CREATE TABLE whispers. Both succeed. Games table now has guzman_context JSONB column. Whispers table exists with proper constraints.
result: pass

## Summary

total: 12
passed: 11
issues: 0
pending: 0
skipped: 1
skipped: 0

## Gaps

[none -- issue fixed in commit c9d1f54]
