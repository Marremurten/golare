---
status: complete
phase: 01-data-pipeline
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-02-11T14:00:00Z
updated: 2026-02-11T14:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Schema migration
expected: Apply the player_messages section of schema.sql to Supabase. Table creates, index creates, prune_player_messages() function creates, trg_prune_player_messages trigger creates — all without errors.
result: pass

### 2. Bot admin gate — blocked
expected: Remove bot's admin status in a test group. Run /nyttspel. Bot replies with Swedish message: "Yo, jag behöver vara admin i gruppen för att kunna se alla meddelanden. Gör mig till admin först, sen kör vi." Game does NOT start.
result: pass

### 3. Bot admin gate — allowed
expected: Make bot admin in the test group. Run /nyttspel. Game creates normally (same behavior as before v1.1). The admin check is transparent when bot has correct permissions.
result: pass

### 4. Message capture during active game
expected: During an active game, send a few regular text messages in the group. Check player_messages table in Supabase — messages appear with correct game_id, game_player_id, and message_text (truncated to 500 chars). Ring buffer keeps max 10 per player per game.
result: pass

### 5. Message filtering
expected: During an active game, send a command (e.g. /rösta) and have a non-player (spectator) send a message. Neither should appear in the player_messages table. Only regular text from registered game players is captured.
result: pass

### 6. Cache invalidation on game end
expected: Finish or cancel a game (/avbryt). After game ends, send more messages in the group. No new rows should appear in player_messages for that game (cache is invalidated, no active game found).
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
