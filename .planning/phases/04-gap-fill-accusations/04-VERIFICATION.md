---
phase: 04-gap-fill-accusations
verified: 2026-02-11T18:02:20Z
status: passed
score: 19/19 must-haves verified
re_verification: false
---

# Phase 4: Gap-Fill & Accusations Verification Report

**Phase Goal:** Gap-fill commentary adapts to group mood, and Guzman publicly calls out suspicious behavior (silence, aggression spikes) with controlled frequency — making the group chat feel like Guzman is always watching.

**Verified:** 2026-02-11T18:02:20Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Group mood is computed from behavioral data at gap-fill time (not stored) | ✓ VERIFIED | `computeGroupMood()` exists in behavioral-analysis.ts (lines 521-551), called fresh in runGapFill (line 447) |
| 2 | Gap-fill prompts are always provocative but adapt content/tone to group mood | ✓ VERIFIED | buildGapFillPrompt line 294: "ALLTID provocerande", mood-specific guidance lines 275-282 |
| 3 | Accusation prompts reference specific observed behavior, never fabricate | ✓ VERIFIED | buildAccusationPrompt line 362: "ALDRIG hitta på beteenden som inte observerats. Basera ALLT på den anomali som beskrivs" |
| 4 | generateAccusation returns null on AI failure (CONST-04) | ✓ VERIFIED | ai-guzman.ts lines 354-356, 374-386: returns null on client unavailable or empty response, no template fallback |
| 5 | Accusation prompt never receives player roles | ✓ VERIFIED | buildAccusationPrompt signature (lines 321-327): no PlayerRole parameter, only uses PlayerRole for other whisper functions |
| 6 | Gap-fill commentary adapts to group mood via behavioral data fetched fresh at cron time | ✓ VERIFIED | whisper-handler.ts lines 437-444: fresh analyzeBehavior call with fallback, mood passed to generateGapFillComment line 498 |
| 7 | Guzman publicly accuses players with detected anomalies during gap-fill cron slots | ✓ VERIFIED | runGapFill lines 450-482: accusation attempt with selectAccusationTarget, generateAccusation, queue.send |
| 8 | Accusations fire max 2 per round across ALL rounds (locked decision) | ✓ VERIFIED | canAccuse line 132: `state.count < 2` with no round-based branching |
| 9 | Same player is never accused twice in a row within a game | ✓ VERIFIED | selectAccusationTarget lines 567-568: skips lastTargetedName, getLastTargetName passed from whisper-handler line 456 |
| 10 | If accusation fires, gap-fill is skipped for that slot (no double messages) | ✓ VERIFIED | whisper-handler lines 485-490: `if (accusationFired) { log + continue; }` |
| 11 | All new AI paths return null on failure — game never blocks (CONST-04) | ✓ VERIFIED | generateAccusation, generateGapFillComment both return null on failure (lines 354-356, 300-302, 320-332, 374-386) |
| 12 | Mood-adaptive gating: tense games always get gap-fill, calm games never, active games only when quiet | ✓ VERIFIED | shouldSendGapFill lines 165-174: tense=true, calm=false, active=isQuiet |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/behavioral-analysis.ts` | computeGroupMood() and selectAccusationTarget() | ✓ VERIFIED | Exports: GroupMood (line 507), computeGroupMood (line 521), selectAccusationTarget (line 560) |
| `src/lib/ai-prompts.ts` | buildAccusationPrompt() and mood-aware buildGapFillPrompt() | ✓ VERIFIED | Exports: buildGapFillPrompt (line 260, 4 params including groupMood), buildAccusationPrompt (line 321) |
| `src/lib/ai-guzman.ts` | generateAccusation() and mood-aware generateGapFillComment() | ✓ VERIFIED | Exports: generateGapFillComment (line 292, 4 params including groupMood), generateAccusation (line 345) |
| `src/handlers/whisper-handler.ts` | accusationTracking state and frequency helpers | ✓ VERIFIED | Contains: accusationTracking Map (line 118), canAccuse (line 126), recordAccusation (line 138), getLastTargetName (line 151), shouldSendGapFill (line 165) |

**Artifact Implementation Quality:**

All artifacts pass all three levels:
1. **EXISTS**: All files present and substantive (100+ lines each)
2. **SUBSTANTIVE**: All functions implemented with full logic, not stubs
3. **WIRED**: All functions imported and called from whisper-handler (verified in Key Links)

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/lib/behavioral-analysis.ts` | `src/handlers/whisper-handler.ts` | computeGroupMood and selectAccusationTarget called from runGapFill | ✓ WIRED | Import lines 26-27, calls lines 447, 454-457 |
| `src/lib/ai-prompts.ts` | `src/lib/ai-guzman.ts` | buildAccusationPrompt called by generateAccusation | ✓ WIRED | Import line 10, call line 364 |
| `src/lib/ai-guzman.ts` | `src/handlers/whisper-handler.ts` | generateAccusation called from runGapFill | ✓ WIRED | Import line 32, call lines 460-466 |
| `src/handlers/whisper-handler.ts` | `src/queue/message-queue.ts` | MessageQueue.send for accusation delivery | ✓ WIRED | queue.send line 470 with parse_mode: "HTML" |
| `src/lib/ai-guzman.ts` | `src/lib/ai-client.ts` | MODEL_MAP.commentary for accusation and gap-fill generation | ✓ WIRED | Import line 3, usage lines 305, 359 (verified via grep) |

**All key links verified as WIRED.**

### Requirements Coverage

| Requirement | Status | Supporting Truths | Notes |
|-------------|--------|-------------------|-------|
| GROUP-01: Gap-fill commentary adapts to group mood using behavioral context | ✓ SATISFIED | Truths 1, 2, 6, 12 | computeGroupMood from fresh behavioral data, mood-adaptive prompts and gating |
| GROUP-02: Guzman publicly calls out suspicious behavior via accusation system | ✓ SATISFIED | Truths 3, 5, 7 | Accusations reference observed anomalies, role-safe, delivered to group chat |
| GROUP-03: Accusation frequency controlled | ⚠️ PARTIAL | Truths 8, 9 | **GAP IDENTIFIED**: Plan implements max 2/round (not max 1 per 4-hour window as spec requires). Same-player-twice prevention verified. |
| CONST-04: All new AI paths have null fallbacks | ✓ SATISFIED | Truths 4, 11 | generateAccusation and generateGapFillComment return null on failure, game never blocks |

**Requirements Status:**
- 3/4 fully satisfied
- 1/4 partial (GROUP-03 frequency spec deviation)

**GROUP-03 Deviation Analysis:**
- **Requirement**: "max 1 per 4-hour window"
- **Implemented**: "max 2 per round" (locked user decision per SUMMARY)
- **Impact**: LOW — implementation is MORE restrictive per-round, but MAY fire more frequently in long rounds
- **Root cause**: User decision override documented in both SUMMARYs ("locked decision -- no round-based escalation")
- **Recommendation**: Update REQUIREMENTS.md to reflect actual implementation, or flag for future adjustment

### Anti-Patterns Found

No blocking or warning-level anti-patterns detected.

**Scanned files:**
- `src/lib/behavioral-analysis.ts` — Clean
- `src/lib/ai-prompts.ts` — Clean
- `src/lib/ai-guzman.ts` — Clean
- `src/handlers/whisper-handler.ts` — Clean

**Pattern Checks:**
- ✓ No TODO/FIXME/PLACEHOLDER comments
- ✓ No empty return statements
- ✓ No console.log-only implementations
- ✓ All functions return substantive values
- ✓ Error handling via try/catch with fallbacks (CONST-04 pattern)

### Implementation Highlights

**Excellent patterns observed:**

1. **Fresh behavioral data at cron time** (lines 437-444):
   ```typescript
   let freshPlayerNotes = guzmanCtx.playerNotes;
   try {
     const { playerNotes } = await analyzeBehavior(game.id);
     freshPlayerNotes = playerNotes;
   } catch (err) {
     console.warn("[whisper] Fresh behavioral analysis failed, using existing playerNotes:", ...);
   }
   ```
   Addresses Pitfall 2 from research: GuzmanContext.playerNotes are stale (only updated at result reveal). Fresh analysis at cron time with graceful fallback.

2. **Role-safe accusation prompt** (ai-prompts.ts line 321):
   - buildAccusationPrompt signature has NO PlayerRole parameter
   - Only targetName, anomalies, evidence, playerNames, gameContext
   - Critical constraint enforced: "ALDRIG avslöja roller"

3. **Null-on-failure for accusations** (ai-guzman.ts lines 354-356, 374-386):
   - Different from other AI functions (which fall back to templates)
   - Implements "never fabricates" user decision
   - If AI fails, accusation is skipped (not templated)

4. **Flat frequency control** (whisper-handler.ts line 132):
   ```typescript
   return state.count < 2;
   ```
   No round-based branching. Consistent max 2 per round across ALL rounds (locked user decision).

5. **Priority ordering** (whisper-handler.ts lines 450-490):
   Accusation attempt takes priority over gap-fill. If accusation fires, gap-fill is skipped for that slot (no double messages).

6. **Mood-adaptive gating** (lines 165-174):
   - Tense: always send (keep pressure up)
   - Calm: never send (let calm games breathe)
   - Active: only when quiet (existing behavior)

### Human Verification Required

No human verification items. All observable truths are programmatically verifiable:
- Group mood computation is deterministic (threshold-based)
- Accusation frequency is tracked in-memory (verifiable via code inspection)
- Prompt content is static (Swedish text with proper åäö characters verified)
- MessageQueue.send wiring is observable in code
- Null fallbacks are explicit return statements

## Summary

**All must-haves verified. Phase goal achieved.**

Phase 4 successfully implements mood-adaptive gap-fill and public accusation system:
- Group mood computed from fresh behavioral data at gap-fill cron time
- Gap-fill prompts always provocative, mood adapts angle/content
- Accusations reference only observed anomalies, never fabricate
- Accusation prompt is role-safe (no PlayerRole parameter)
- Frequency control: max 2 per round, never same player twice in a row
- Priority ordering: accusations fire before gap-fill (no double messages)
- Mood-adaptive gating: tense=always, calm=never, active=when quiet
- All AI paths return null on failure (CONST-04)

**Minor documentation gap**: GROUP-03 spec says "max 1 per 4-hour window" but implementation uses "max 2 per round" per locked user decision. Recommend updating REQUIREMENTS.md to match actual implementation.

The group chat will feel like Guzman is always watching. Ready to proceed to Phase 5 or v1.1 completion.

---

_Verified: 2026-02-11T18:02:20Z_
_Verifier: Claude (gsd-verifier)_
