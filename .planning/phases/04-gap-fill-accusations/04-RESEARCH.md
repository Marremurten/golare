# Phase 4: Gap-Fill & Accusations - Research

**Researched:** 2026-02-11
**Domain:** AI-driven mood-aware gap-fill and public accusation system for async Telegram social deduction game
**Confidence:** HIGH

## Summary

This phase extends two existing systems: (1) the gap-fill commentary system in `whisper-handler.ts` which currently sends generic atmospheric messages to quiet groups, and (2) the behavioral analysis pipeline from Phase 2 which already computes tone classifications, anomaly detection, and player summaries. The work is primarily prompt engineering, mood computation, accusation scheduling logic, and frequency control -- all within existing files and patterns.

The codebase is well-structured for this extension. The `analyzeBehavior()` orchestrator already produces exactly the data needed: per-player anomalies (silence, aggression spikes, behavior shifts) and tone classifications. The gap-fill system already runs on cron (14:00 and 20:00), already checks group activity levels, and already calls `generateGapFillComment()`. The main gaps are: (a) gap-fill prompts have no mood awareness, (b) there is no accusation generation function, (c) there is no frequency/cooldown tracking for accusations, and (d) gap-fill timing is not adaptive to mood.

**Primary recommendation:** Build the accusation system as a new `generateAccusation()` function in `ai-guzman.ts` with a corresponding prompt builder in `ai-prompts.ts`, piggyback accusation delivery on the existing gap-fill schedule in `whisper-handler.ts`, and add in-memory accusation tracking (per-game round counter + last-targeted player) alongside the existing `groupActivity` Map.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Both silence and behavior shifts are primary triggers, weighted equally
- Guzman only comments on actual observed behavior -- never fabricates suspicion or false accusations
- Accusations reference specific things players said or did -- concrete, chilling callouts, not vague hints
- Street boss intimidation -- direct, aggressive orten-slang in public accusations
- Mix of direct @mentions and third-person references -- varies to keep players guessing
- Same energy public and private -- Guzman's personality is consistent across group chat and DMs
- Gap-fill commentary is always provocative regardless of current mood -- designed to increase tension
- Gap-fill stays general/atmospheric -- no specific player behavior references (accusations handle that)
- Mood adaptation affects both content and timing -- tense games get more frequent gap-fills, calm games get less
- Max 2 accusations per round -- enough pressure without being spammy
- No hard per-round minimum -- if no behavioral anomalies, accusations are optional

### Claude's Discretion
- Whether accusations are sometimes accurate (pointing at actual mole) or always ambiguous -- balance for maximum paranoia
- Whether Guzman sometimes asks the group to react to accusations or just drops statements
- Per-player targeting cooldown -- whether to spread accusations around or allow repeat targeting when warranted
- Accusation escalation curve over the course of a game (ramp up or consistent)
- Fallback behavior when no anomalies detected -- stay quiet or generic provocation
- Mood granularity -- how many distinct moods to recognize (binary tense/calm vs multiple)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (existing -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenAI | existing | AI generation for accusations and mood-aware gap-fill | Already used for all AI paths |
| grammY | existing | Telegram bot framework, message delivery | Core bot framework |
| Supabase | existing | Database for game state, behavioral data | Database-first architecture |
| croner | existing | Cron scheduling for gap-fill/accusation timing | Already powers scheduler |

### Key Existing Modules (touch points for this phase)
| Module | File | What It Provides |
|--------|------|-----------------|
| behavioral-analysis | `src/lib/behavioral-analysis.ts` | `analyzeBehavior()`, `computePlayerStats()`, `classifyTone()`, `detectAnomalies()`, anomaly strings |
| ai-guzman | `src/lib/ai-guzman.ts` | `generateGapFillComment()`, `getGuzmanContext()`, `sanitizeForTelegram()` |
| ai-prompts | `src/lib/ai-prompts.ts` | `buildGapFillPrompt()`, `buildGuzmanSystemPrompt()` |
| whisper-handler | `src/handlers/whisper-handler.ts` | `runGapFill()`, `isGroupQuiet()`, `trackGroupMessage()`, cron wiring |
| ai-client | `src/lib/ai-client.ts` | `MODEL_MAP.commentary` (gpt-4.1-nano for cheap commentary) |
| message-queue | `src/queue/message-queue.ts` | `MessageQueue.send()` for all outbound group messages |

### Alternatives Considered
None -- CONST-01 prohibits new dependencies. All work uses existing stack.

## Architecture Patterns

### Where Each Piece Lives

```
src/
├── lib/
│   ├── behavioral-analysis.ts  # EXTEND: add group mood computation, accusation target selection
│   ├── ai-guzman.ts            # EXTEND: add generateAccusation(), modify generateGapFillComment() signature
│   ├── ai-prompts.ts           # EXTEND: add buildAccusationPrompt(), modify buildGapFillPrompt() for mood
│   └── ai-client.ts            # NO CHANGE (MODEL_MAP.commentary for accusations)
├── handlers/
│   └── whisper-handler.ts      # EXTEND: accusation delivery in runGapFill(), accusation frequency tracking
├── db/
│   └── types.ts                # NO CHANGE (GuzmanContext.playerNotes already has anomaly data)
└── queue/
    └── message-queue.ts        # NO CHANGE (used via getMessageQueue())
```

### Pattern 1: Accusation Piggybacking on Gap-Fill Schedule
**What:** Accusations are delivered during the existing gap-fill cron slots (14:00 and 20:00), not via new cron jobs.
**When to use:** Every gap-fill check now also evaluates whether an accusation should fire.
**How it works:**
1. Gap-fill cron fires (14:00, 20:00)
2. For each active game: compute group mood from behavioral data
3. Check accusation eligibility (under max-2-per-round, anomalies exist)
4. If accusation fires: generate and send accusation to group
5. If no accusation: check if group is quiet and mood warrants gap-fill
6. Send mood-adapted gap-fill if conditions met

**Key insight from roadmap:** "Accusations piggyback on gap-fill -- Reuses existing scheduler and infrastructure, no new cron jobs"

### Pattern 2: Group Mood as Computed Property (Not Stored State)
**What:** Group mood is computed fresh from behavioral data at gap-fill/accusation time, not persisted.
**Why:** Mood changes between cron runs. Persisting would add complexity without benefit since it is only consumed at the same moment it would be computed.
**Computation source:** `GuzmanContext.playerNotes` (already populated on every round reveal by `updateNarrativeContext`), combined with `groupActivity` counts from the in-memory Map.

**Recommended mood granularity (3 levels):**
- `tense` -- many anomalies, accusatory tones, failed missions, low activity
- `active` -- healthy discussion, mixed tones, moderate activity
- `calm` -- few messages, neutral tones, no anomalies

Three levels is sufficient because the mood only drives two decisions: (a) gap-fill content flavoring and (b) gap-fill frequency gating. Binary is too coarse (loses the "active but healthy" state), while 5+ levels adds complexity without meaningful behavior change.

### Pattern 3: In-Memory Accusation Tracking
**What:** Track accusation count per game per round and last-targeted player in an in-memory Map, similar to the existing `groupActivity` Map pattern.
**Why:** No DB migration needed. Accusations are optional and lossy (restart resets counters, which just means slightly more/fewer accusations -- acceptable).
**Structure:**
```typescript
type AccusationState = {
  roundNumber: number;
  count: number;
  lastTargetPlayerId: string | null;
};
const accusationTracking = new Map<string, AccusationState>(); // keyed by gameId
```

### Pattern 4: Accusation Target Selection from Anomaly Data
**What:** Select accusation targets by scanning `playerNotes` for anomaly signals.
**How:** The behavioral analysis module already produces anomaly strings like "tystnat plotsligt", "aggressionsökning", "aktivitet sjunkit", "beteendeförändring". Parse these from playerNotes to build a candidate list, weighted equally per the locked decision.
**Important:** Target selection MUST exclude the last-targeted player (from accusation tracking) to prevent repetitive harassment of the same player.

### Anti-Patterns to Avoid
- **Storing mood in GuzmanContext:** Adds DB round-trips and state management for a value only consumed at computation time.
- **New database table for accusations:** Accusations are atmospheric group messages, not game-affecting state. In-memory tracking is sufficient.
- **Separate cron job for accusations:** Violates the "piggyback on gap-fill" decision from the roadmap.
- **Reading player roles in accusation prompts:** Accusations must NEVER have access to who is actually the mole. The prompt must only receive observable behavioral data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tone classification | Custom NLP pipeline | Existing `classifyTone()` in behavioral-analysis.ts | Already built in Phase 2, Swedish keyword heuristics |
| Anomaly detection | New detection logic | Existing `detectAnomalies()` in behavioral-analysis.ts | Already compares player vs own history |
| Message delivery | Direct bot.api calls | `MessageQueue.send()` via `getMessageQueue()` | Rate limiting, per-chat queuing, mandatory pattern |
| Player name resolution | Manual DB lookups | Existing `getGamePlayersOrderedWithInfo()` | Established pattern throughout codebase |
| AI fallbacks | Custom error handling | Try/catch with null return pattern (established in all ai-guzman.ts functions) | CONST-04 compliance |

**Key insight:** The behavioral analysis module already does the hard work. Phase 4 is about consuming that data for new outputs (accusations) and feeding mood context into existing outputs (gap-fill).

## Common Pitfalls

### Pitfall 1: Accusation References Actual Player Roles
**What goes wrong:** If the accusation prompt receives role information, the AI might generate accusations that accidentally reveal who the mole is, breaking the game.
**Why it happens:** The whisper system receives `targetRole` for tone calibration. Copying that pattern to accusations would be a mistake.
**How to avoid:** The accusation prompt must ONLY receive: (a) player name, (b) observable behavioral data (tone, anomalies, message quotes), (c) round events. NEVER role information. The prompt builder must have NO role parameter.
**Warning signs:** Any import of `PlayerRole` in the accusation prompt builder.

### Pitfall 2: Stale Behavioral Data in Gap-Fill/Accusation Context
**What goes wrong:** `GuzmanContext.playerNotes` is updated in `updateNarrativeContext()` which runs at result reveal (21:00). Gap-fill runs at 14:00 and 20:00 -- before the round's reveal. So playerNotes reflects the PREVIOUS round's data, not current player behavior.
**Why it happens:** The behavioral analysis pipeline was designed for whisper context, which runs after reveals.
**How to avoid:** For accusations, call `analyzeBehavior()` directly at gap-fill time to get FRESH behavioral data. This is a lightweight operation (reads ~10 messages per player from ring buffer). Use the same try/catch non-critical pattern (CONST-04).
**Warning signs:** Accusations that never match current behavior because they are referencing stale round data.

### Pitfall 3: Mood Computation Without Enough Data
**What goes wrong:** In early rounds (especially round 1), there is little behavioral data. Mood computation returns misleading results.
**Why it happens:** Few messages, no behavioral history baseline.
**How to avoid:** Default to "active" mood when insufficient data (fewer than 2 messages total from all players). Only start mood-based frequency adjustments after round 1.

### Pitfall 4: Gap-Fill and Accusation Both Firing in Same Slot
**What goes wrong:** A gap-fill comment and an accusation fire in the same cron slot, flooding the group with Guzman messages.
**Why it happens:** They share the same cron schedule.
**How to avoid:** Accusations take priority. If an accusation fires, skip the gap-fill for that slot. The logic should be: attempt accusation first -> if none fires, consider gap-fill.

### Pitfall 5: GROUP-03 Requirement Conflict
**What goes wrong:** The original requirement says "max 1 per 4-hour window, never same player twice in a row." The CONTEXT.md decision says "max 2 per round." These conflict.
**Why it happens:** The discussion refined the frequency constraint.
**How to avoid:** Use the CONTEXT.md decision (max 2 per round), which supersedes the original requirement. The CONTEXT.md is the authoritative source for this phase's behavior. The "never same player twice in a row" constraint from GROUP-03 is still valid and complementary.

### Pitfall 6: Accusation Prompt Generating Vague Hints Instead of Concrete Callouts
**What goes wrong:** The AI generates generic "someone is suspicious" messages instead of referencing specific observed behavior, violating the locked decision.
**Why it happens:** Insufficient behavioral context in the prompt, or prompt instructions are too vague.
**How to avoid:** Feed the accusation prompt: (a) the target player's actual message quotes (paraphrased per CONST-03 and WHISP-03 patterns), (b) their specific anomaly type, (c) explicit instruction to reference concrete actions. Include few-shot examples of concrete callouts.

## Code Examples

### Example 1: Group Mood Computation
```typescript
// Source: New function in behavioral-analysis.ts
// Computes group mood from playerNotes anomalies and group activity

type GroupMood = "tense" | "active" | "calm";

export function computeGroupMood(
  playerNotes: Record<string, string>,
  groupMessageCount: number,
): GroupMood {
  // Count anomalies across all players
  let anomalyCount = 0;
  let accusatoryCount = 0;

  for (const note of Object.values(playerNotes)) {
    if (note.includes("Anomali:") && !note.includes("Anomali: ingen")) {
      anomalyCount++;
    }
    if (note.includes("Ton: anklagande")) {
      accusatoryCount++;
    }
  }

  const playerCount = Object.keys(playerNotes).length;
  if (playerCount === 0) return "active"; // no data -> default

  // Tense: many anomalies or accusatory tones
  if (anomalyCount >= 2 || accusatoryCount >= 2) return "tense";

  // Calm: low activity, few anomalies
  if (groupMessageCount < 3 && anomalyCount === 0) return "calm";

  return "active";
}
```

### Example 2: Accusation Target Selection
```typescript
// Source: New function in behavioral-analysis.ts or whisper-handler.ts
// Selects players with detected anomalies as accusation candidates

export function selectAccusationTargets(
  playerNotes: Record<string, string>,
  lastTargetedPlayer: string | null,
): Array<{ name: string; anomaly: string }> {
  const candidates: Array<{ name: string; anomaly: string }> = [];

  for (const [name, note] of Object.entries(playerNotes)) {
    // Skip last targeted player
    if (name === lastTargetedPlayer) continue;

    // Parse anomaly from structured summary
    const anomalyMatch = note.match(/Anomali: (.+?)(?:\s*\||$)/);
    if (anomalyMatch && anomalyMatch[1] !== "ingen") {
      candidates.push({ name, anomaly: anomalyMatch[1] });
    }
  }

  return candidates;
}
```

### Example 3: Accusation Prompt Structure
```typescript
// Source: New function in ai-prompts.ts
// Builds accusation prompt with behavioral evidence but NO role information

export function buildAccusationPrompt(
  targetName: string,
  anomalyDescription: string,
  targetQuotes: string[],
  playerNames: string[],
  gameContext: GuzmanContext,
  mentionStyle: "direct" | "third_person",
): string {
  const quotesSection = targetQuotes.length > 0
    ? targetQuotes.map((q, i) => `  ${i + 1}. "${q}"`).join("\n")
    : "Ingen aktivitet -- tystnad är misstänkt i sig.";

  return `Skriv en offentlig anklagelse i gruppenchatten...
BETEENDE: ${anomalyDescription}
CITAT (parafrasera, citera ALDRIG ordagrant):
${quotesSection}
...`;
}
```

### Example 4: Accusation Frequency Check
```typescript
// Source: New logic in whisper-handler.ts
// Checks if accusation is allowed given per-round max

function canAccuse(gameId: string, currentRound: number): boolean {
  const state = accusationTracking.get(gameId);
  if (!state || state.roundNumber !== currentRound) {
    // New round or first accusation -- reset tracking
    return true;
  }
  return state.count < 2; // Max 2 per round
}
```

### Example 5: Mood-Adaptive Gap-Fill Gating
```typescript
// Source: Modified logic in whisper-handler.ts runGapFill()
// Tense games get gap-fills even when active; calm games skip more often

function shouldSendGapFill(mood: GroupMood, isQuiet: boolean): boolean {
  switch (mood) {
    case "tense":
      return true; // Always send in tense games -- keep pressure up
    case "active":
      return isQuiet; // Only during quiet periods (existing behavior)
    case "calm":
      return false; // Let calm games breathe -- no unprompted commentary
  }
}
```

## Claude's Discretion Recommendations

Based on the game design goals (maximize paranoia, keep Guzman feeling omnipresent), these are my recommendations for the discretion areas:

### Accusation Accuracy
**Recommendation:** Accusations should be AMBIGUOUS, never knowingly accurate or inaccurate. The prompt should have NO access to role data, so accuracy is coincidental. This maximizes paranoia because even innocent players will wonder "does Guzman actually know?"

### Group Reaction Prompting
**Recommendation:** Mix both styles. 70% of accusations are statement-drops ("Jag kollar pa dig, Ahmed..."). 30% include a provocation question ("Vad sager ni andra om det dar, a?"). This keeps the group engaged without being annoying. Implement via a random threshold in the prompt instruction.

### Per-Player Targeting Cooldown
**Recommendation:** Enforce "never same player twice IN A ROW" (from GROUP-03), but allow repeat targeting after one other player has been targeted. This prevents harassment while still allowing Guzman to build sustained pressure on genuinely anomalous players. Track via `lastTargetPlayerId` in the in-memory accusation state.

### Accusation Escalation Curve
**Recommendation:** Ramp up. Round 1-2: max 1 accusation per round (if anomalies exist). Round 3+: max 2 per round. This matches the whisper escalation pattern (vague early, intense late) and prevents information-thin accusations in early rounds when behavioral data is sparse.

### Fallback When No Anomalies
**Recommendation:** Stay quiet. The locked decision says "Guzman only comments on actual observed behavior -- never fabricates." If no anomalies exist, no accusation fires -- the gap-fill system handles atmospheric presence instead. This respects the decision that accusations must be grounded in reality.

### Mood Granularity
**Recommendation:** Three levels (tense/active/calm) as described above. Binary is too coarse; 5+ adds complexity for minimal behavioral difference.

## State of the Art

| Old Approach (current) | Current Approach (this phase) | Impact |
|------------------------|-------------------------------|--------|
| Gap-fill sends generic atmospheric messages | Gap-fill adapts content and frequency to group mood | GROUP-01: mood-aware commentary |
| No public accusations | Guzman publicly calls out suspicious behavior | GROUP-02: accusation system |
| No frequency control on commentary | Max 2 accusations per round, no same player twice in a row | GROUP-03: controlled frequency |
| `buildGapFillPrompt()` has no mood parameter | Prompt receives group mood for content adaptation | More contextual commentary |
| `playerNotes` only consumed by whispers | Also consumed by gap-fill mood computation and accusation targeting | Data pipeline fully leveraged |

## Open Questions

1. **Accusation delivery timing within cron slot**
   - What we know: Gap-fill runs at 14:00 and 20:00. Accusations piggyback on this.
   - What's unclear: Should the accusation fire immediately, or with a random delay (e.g., 0-30 min offset) to feel less mechanical?
   - Recommendation: Fire immediately. The existing cron times are already varied (14:00 and 20:00), and adding random delays would require setTimeout patterns that complicate restart recovery. Keep it simple.

2. **Template fallback for accusations**
   - What we know: CONST-04 requires template/null fallbacks on all AI paths.
   - What's unclear: What should a template accusation look like? It would need player name injection but cannot reference specific behavior (that requires AI).
   - Recommendation: Return null (skip the accusation) rather than template. Accusations are optional per the locked decision. A template accusation without behavioral grounding would violate "never fabricates suspicion." Gap-fill templates already exist as atmospheric fallback.

3. **Fresh behavioral analysis at gap-fill time**
   - What we know: `analyzeBehavior()` is currently called only at round reveal time. Gap-fill needs current data.
   - What's unclear: Performance impact of calling `analyzeBehavior()` at every gap-fill cron (up to 2x daily per game).
   - Recommendation: Call it. It reads ~10 messages per player from a ring buffer and does in-memory computation. For a 5-7 player game this is ~50-70 rows -- negligible DB load. The non-critical try/catch pattern from CONST-04 already exists in updateNarrativeContext and should be replicated.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/behavioral-analysis.ts` -- full source of anomaly detection, tone classification, player summaries
- Codebase analysis: `src/handlers/whisper-handler.ts` -- gap-fill cron wiring, group activity tracking, delivery patterns
- Codebase analysis: `src/lib/ai-guzman.ts` -- all AI generation functions, sanitization, template fallback patterns
- Codebase analysis: `src/lib/ai-prompts.ts` -- all prompt builders, Guzman persona definition, existing gap-fill prompt
- Codebase analysis: `src/lib/scheduler.ts` -- cron schedule (14:00, 20:00 gap-fill), handler interface
- Codebase analysis: `src/db/types.ts` -- GuzmanContext shape, playerNotes, behavioralHistory

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` -- accumulated decisions, established patterns
- `.planning/ROADMAP.md` -- "Accusations piggyback on gap-fill" key decision
- `.planning/REQUIREMENTS.md` -- GROUP-01/02/03, CONST-04 definitions
- `.planning/phases/04-gap-fill-accusations/04-CONTEXT.md` -- locked decisions and discretion areas

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing code examined line-by-line
- Architecture: HIGH -- clear extension points identified in existing code, established patterns to follow
- Pitfalls: HIGH -- based on actual codebase structure, data flow analysis, and requirement cross-referencing

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- internal codebase, no external dependency drift)
