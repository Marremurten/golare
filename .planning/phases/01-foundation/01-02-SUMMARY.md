---
phase: 01-foundation
plan: 02
subsystem: messaging
tags: [telegram-rate-limit, message-queue, deep-links, dm-flow, grammy]

# Dependency graph
requires:
  - phase: 01-01
    provides: "grammY Bot instance, typed DB client (getPlayerByTelegramId), Swedish message templates (MESSAGES)"
provides:
  - "Per-chat rate-limited MessageQueue with 3s spacing (singleton)"
  - "Deep link generation/parsing for group-to-DM flow"
  - "Player callout, registration announcement, and reminder timeout functions"
affects: [01-03, 02-lobby, 02-game-start, 03-game-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Singleton factory (createMessageQueue/getMessageQueue)", "Per-chat FIFO queue with Map<chatId, QueuedMessage[]>", "Pending timeout tracking with in-memory Map cleanup"]

key-files:
  created:
    - src/queue/message-queue.ts
    - src/handlers/dm-flow.ts

key-decisions:
  - "Added parseDeepLinkPayload() alongside generateDeepLink() for roundtrip encoding -- Plan 01-03 will need this for /start handler"
  - "Fallback name 'kompansen' (Swedish slang) when player has no firstName or username"
  - "scheduleReminder cancels any existing reminder for same player/group before creating new one (prevents duplicates)"

patterns-established:
  - "All outbound group messages go through MessageQueue.send(), never direct bot.api.sendMessage"
  - "Deep link payload format: g_{chatId} for positive IDs, g_n{absId} for negative IDs"
  - "Reminder timeout pattern: schedule -> check DB -> send only if still unregistered"

# Metrics
duration: 3min
completed: 2026-02-10
---

# Phase 1 Plan 2: Message Queue and DM Flow Summary

**Per-chat rate-limited message queue (3s spacing) with deep link generation, group callouts, and DB-checked reminder timeouts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-10T11:32:39Z
- **Completed:** 2026-02-10T11:36:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- MessageQueue class with per-chat FIFO queues, configurable minimum interval (default 3000ms), promise-based send that resolves on actual delivery, 429 retry fallback, and delay monitoring (isDelayed/getDelay)
- DM permission flow module with deep link generation (negative ID encoding), player callout via MESSAGES.DM_CALLOUT, registration announcement via MESSAGES.REGISTRATION_CONFIRMED_GROUP, and reminder timeout that checks DB before sending
- Singleton factory pattern (createMessageQueue/getMessageQueue) for app-wide queue access
- parseDeepLinkPayload utility for roundtrip deep link decoding (needed by Plan 01-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-chat message queue with rate limiting** - `4e30795` (feat)
2. **Task 2: DM permission flow -- deep links, callouts, and reminders** - `d1098ff` (feat)

## Files Created/Modified
- `src/queue/message-queue.ts` - Per-chat rate-limited message queue with FIFO processing, 429 retry, delay detection, singleton factory
- `src/handlers/dm-flow.ts` - Deep link generation/parsing, player callout, registration announcement, reminder timeout with DB check, pending reminder tracking

## Decisions Made
- **Added parseDeepLinkPayload():** The plan specified generateDeepLink but not the reverse parser. Plan 01-03's /start handler will need to decode payloads back to group chat IDs, so this was added proactively.
- **Fallback name "kompansen":** When a player has neither firstName nor username, callouts and reminders use "kompansen" (Swedish slang for "buddy") to maintain the Guzman persona.
- **Duplicate reminder prevention:** scheduleReminder() cancels any existing reminder for the same player/group pair before creating a new timeout, preventing duplicate reminders if callOutPlayer is called multiple times.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Bot type parameter for grammy compatibility**
- **Found during:** Task 1 (MessageQueue implementation)
- **Issue:** Plan's `Bot<any, RawApi>` type parameter is invalid -- grammy's Bot generic is `Bot<C extends Context, A extends Api>` where Api wraps RawApi. Using `RawApi` directly fails the constraint.
- **Fix:** Changed to plain `Bot` (uses default type parameters `Bot<Context, Api>`) which correctly types `bot.api.sendMessage()`.
- **Files modified:** `src/queue/message-queue.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `4e30795` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added parseDeepLinkPayload() utility**
- **Found during:** Task 2 (DM flow implementation)
- **Issue:** Plan specifies deep link generation but not parsing. The /start handler (Plan 01-03) will receive the payload and need to decode it back to a group chat ID. Without the parser, the deep link system is one-way only.
- **Fix:** Added `parseDeepLinkPayload(payload: string): number | null` that handles both positive IDs and the "n" prefix for negative IDs.
- **Files modified:** `src/handlers/dm-flow.ts`
- **Verification:** Logic verified: `g_n1234567` -> `-1234567`, `g_9876543` -> `9876543`, `invalid` -> `null`
- **Committed in:** `d1098ff` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. Bot type fix required for compilation. parseDeepLinkPayload prevents a gap that Plan 01-03 would have to fill. No scope creep.

## Issues Encountered
None beyond the type parameter fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MessageQueue ready for bot startup integration (createMessageQueue in bot.ts)
- DM flow functions ready for /start handler (Plan 01-03) to wire: parseDeepLinkPayload for incoming deep links, announceRegistration for post-registration, cancelPlayerReminder for cleanup
- callOutPlayer and scheduleReminder ready for game lobby code (Phase 2) to call when detecting unregistered players

## Self-Check: PASSED

- All 2 created files verified present on disk
- All 2 task commits verified in git history (4e30795, d1098ff)
- `npx tsc --noEmit` passes with zero errors

---
*Phase: 01-foundation*
*Completed: 2026-02-10*
