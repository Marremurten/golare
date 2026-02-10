---
status: complete
phase: 02-game-lobby
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-02-10T13:15:00Z
updated: 2026-02-10T13:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create game lobby with /nyttspel
expected: As a group admin, send /nyttspel in the group chat. Guzman announces a new game with a lobby message showing 0/10 players and two buttons: "Jag är med! 🤝" and "Hoppa av 👋". No "Kör igång!" button yet (need 4+ players).
result: pass
note: Initially failed due to missing DB schema (tables not created in Supabase). Resolved by running schema.sql.

### 2. Join the lobby
expected: Tap "Jag är med! 🤝" in the lobby message. The message updates live to show your name in the player list and the count increases (e.g., "1/10 spelare"). If you haven't /start'd the bot, you get a toast saying to start the bot first.
result: pass

### 3. Leave the lobby
expected: Tap "Hoppa av 👋" in the lobby message. Your name disappears from the player list and the count decreases. The message updates in-place.
result: pass

### 4. Start button appears at 4+ players
expected: With 4 or more players in the lobby, a third button row appears: "Kör igång! 🔥". With fewer than 4 players, this button is absent.
result: pass
note: Tested via DEV_MODE=true (min 1 player). Button appears correctly when threshold met.

### 5. Start the game
expected: As the game creator, tap "Kör igång! 🔥". The lobby message changes to "Spelet har börjat! 🎬 Kolla era DMs, bre." with no more buttons. Each player receives a private DM revealing their secret role in Guzman voice. A dramatic Guzman monologue is posted to the group.
result: pass

### 6. Role DMs are correct
expected: After game start, check the DMs: Äkta players get a brief about being loyal to Ligan. Golare players get their brief PLUS a list of other Golare names. Högra Hand gets their brief confirming the Spaning ability. Role distribution should match the balancing table (e.g., 6 players → 2 Golare, 3 Äkta, 1 Högra Hand).
result: pass
note: Tested with 1 player (DEV_MODE). Role DM received in Guzman voice with correct role info.

### 7. /regler shows paginated rules
expected: Type /regler in group or DM. A message appears with the "Roller" rules page and 3 inline buttons: "» Roller «", "Spelgång", "Vinst". Tap "Spelgång" — the message content swaps to game flow rules. Tap "Vinst" — shows win conditions. Current page is highlighted with » « markers.
result: pass

### 8. /status shows game state
expected: During an active game, type /status in the group. Shows Ligan/Aina score (0-0), round (0/5), game state ("Pågår"), and a list of all players. In DM, same info plus your secret role and abilities shown under "🔒 Din roll".
result: pass

### 9. /avbryt cancels the game
expected: As the game creator, type /avbryt in the group. The game is cancelled, Guzman announces it with your name, and the lobby message (if still in lobby state) is edited to remove buttons. Non-creators get rejected.
result: pass

### 10. Regler button on /start welcome works
expected: Send /start to the bot privately. The welcome message has a "Regler 📖" button. Tapping it opens the same paginated rules as /regler (Roller page with navigation buttons).
result: pass

### 11. Duplicate game prevention
expected: With an active game in the group, try /nyttspel again. Bot responds with "Det finns redan ett spel igång i den här gruppen, bre! 🎮" and does not create a second game.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

[none — test 1 failure was setup issue (schema not applied), resolved]
