---
status: complete
phase: 05-engagement
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md]
started: 2026-02-11T09:00:00Z
updated: 2026-02-11T09:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. /viska sends anonymous whisper to group
expected: In DM, type /viska as non-team player. Select "Till gruppen", type a message. Guzman relays it to group with cryptic role hint. You get confirmation.
result: pass

### 2. /viska sends targeted whisper to specific player
expected: In DM, type /viska as non-team player. Select a specific player name. Type a message. That player receives the message via DM from Guzman (not the group). You get confirmation.
result: pass

### 3. /viska blocked for team members
expected: In DM, type /viska while you ARE on the current team. Bot replies with ENGAGEMENT_ON_TEAM message.
result: pass

### 4. /spana surveillance of team member
expected: In DM, type /spana as non-team player. Bot shows keyboard with current team members only. Select a team member. You receive a cryptic AI-generated clue about their actions.
result: pass

### 5. /spana once-per-round enforcement
expected: After using /spana once in a round, type /spana again in the same round. Bot replies with SURVEILLANCE_ALREADY_USED message.
result: pass

### 6. Surveillance target notification (40% chance)
expected: When a player is surveilled, there's a 40% chance they receive a notification in their DM.
result: pass

### 7. /spaning investigation (Akta player)
expected: As an Akta player, type /spaning in DM. Select a player. Receive a cryptic, hedged answer about their role (75% truthful). Group chat sees anonymous notification.
result: pass

### 8. /spaning investigation (Hogra Hand)
expected: As Hogra Hand, type /spaning in DM. Select a player. Receive a direct, definitive answer about their role (always truthful). Group sees anonymous notification.
result: pass

### 9. /spaning one-per-game enforcement
expected: After using /spaning once, try /spaning again in the same game. Bot replies with SPANING_ALREADY_USED message.
result: pass

### 10. /spaning blocked for Golare
expected: As a Golare player, type /spaning in DM. Bot replies with SPANING_WRONG_ROLE message.
result: pass

### 11. Double points in rounds 4-5
expected: After a mission in round 4 or 5, the score update message shows double points. Scores increase by 2 instead of 1, but never exceed 3.
result: pass

### 12. One-by-one role reveal at game end
expected: When a game ends, roles are revealed one player at a time with delays. Order: Akta first, Hogra Hand middle, Golare last. Each reveal has AI-generated text with player name.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
