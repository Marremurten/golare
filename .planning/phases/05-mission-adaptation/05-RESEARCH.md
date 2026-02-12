# Phase 5: Mission Adaptation - Research

**Researched:** 2026-02-12
**Domain:** AI prompt engineering for behavior-aware mission narratives with group dynamics section, soft mission template selection bias
**Confidence:** HIGH

## Summary

This phase enriches the existing AI-generated mission narrative (posted at 09:00 daily) with a group dynamics section that reflects recent player behavior patterns, and adds a soft influence of group mood on which mission "vibe" gets generated. The infrastructure is fully in place: Phase 2's `analyzeBehavior()` produces `playerNotes` (per-player tone/activity/anomaly summaries), Phase 4's `computeGroupMood()` returns a "tense"/"active"/"calm" classification, and the mission generation pipeline (`onMissionPost` in game-loop.ts -> `generateMissionNarrative()` in ai-guzman.ts -> `buildMissionPrompt()` in ai-prompts.ts) already receives `GuzmanContext` which contains `playerNotes`.

The core work is: (1) calling fresh `analyzeBehavior()` at mission post time (09:00) to get current behavioral data rather than relying on stale playerNotes from the previous round's reveal, (2) computing `GroupMood` from the fresh data, (3) rewriting `buildMissionPrompt()` to include a group dynamics prompt section with behavioral data and mood context, (4) adding prompt instructions that direct the AI to weave player behavior references and mood-appropriate mission themes into the narrative. No new database tables, no new npm packages, no new cron jobs, no new AI generation functions -- this is a prompt rewrite and data gathering extension at a single call site.

The main design challenge is prompt engineering: crafting instructions that produce engaging group dynamics content (mix of named callouts and vague allusions, as per CONTEXT.md) while maintaining the existing mission narrative quality (dramatic heist descriptions with Guzman's orten-slang voice). The dynamics section must feel woven into the narrative naturally, not bolted on as a separate block.

**Primary recommendation:** Modify three files: `ai-prompts.ts` (rewrite `buildMissionPrompt()` to accept behavioral data and mood), `ai-guzman.ts` (expand `generateMissionNarrative()` to gather fresh behavioral data and pass it through), and `game-loop.ts` (pass fresh behavioral data from `onMissionPost`). Keep the same `gpt-4o-mini` model (MODEL_MAP.narrative). Template fallback unchanged -- on AI failure, fall back to `MESSAGES.MISSION_POST()` which has no dynamics section (graceful degradation).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Mission selection influence**: Group dynamics softly bias which mission template gets picked (not hard steer)
- **Player references**: Must be a mix of named and vague (not always one or the other)

### Claude's Discretion
Wide latitude on this phase:
- Dynamics section placement (woven into narrative, separate block, or opening paragraph)
- Dynamics section length (scale based on available behavioral data)
- How many players to reference per mission (scale based on how many have notable behavior)
- Whether to reference specific things players said (twisted/paraphrased) vs. behavioral patterns only
- Whether to drop subtle role hints or stay purely behavioral
- Tone (provocative to ominous to narration, consistent with Guzman's suburb slang voice)
- Escalation pattern across rounds
- Truthfulness (Guzman references real behavior but may twist/frame for maximum suspicion)
- Voice (direct address vs. narration)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Existing -- Zero New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenAI | existing | Mission narrative generation via gpt-4o-mini | Already used for all narrative paths (MODEL_MAP.narrative) |
| grammY | existing | Telegram bot framework, message delivery | Core bot framework |
| Supabase | existing | Database for game state, behavioral data, GuzmanContext | Database-first architecture |
| croner | existing | Cron scheduling (09:00 mission post) | Already powers scheduler |

### Key Existing Modules (Touch Points)
| Module | File | What It Provides |
|--------|------|-----------------|
| behavioral-analysis | `src/lib/behavioral-analysis.ts` | `analyzeBehavior()`, `computeGroupMood()`, `buildPlayerSummary()`, anomaly strings |
| ai-guzman | `src/lib/ai-guzman.ts` | `generateMissionNarrative()`, `getGuzmanContext()`, `sanitizeForTelegram()` |
| ai-prompts | `src/lib/ai-prompts.ts` | `buildMissionPrompt()`, `buildGuzmanSystemPrompt()` |
| game-loop | `src/handlers/game-loop.ts` | `onMissionPost()` at line 1494 -- the 09:00 cron handler that calls `generateMissionNarrative()` |
| ai-client | `src/lib/ai-client.ts` | `MODEL_MAP.narrative` (gpt-4o-mini for quality narratives) |
| message-queue | `src/queue/message-queue.ts` | `MessageQueue.send()` for all outbound group messages |
| db/client | `src/db/client.ts` | `getGuzmanContext()`, `getAllRecentMessages()`, `getGamePlayersOrderedWithInfo()`, `getGamePlayersWithInfo()` |

### Alternatives Considered
None -- CONST-01 prohibits new dependencies. All work uses existing stack.

## Architecture Patterns

### Where Each Piece Lives

```
src/
  lib/
    ai-prompts.ts           # MODIFY: rewrite buildMissionPrompt() with behavioral data + mood + dynamics instructions
    ai-guzman.ts            # MODIFY: expand generateMissionNarrative() to accept behavioral data
    behavioral-analysis.ts  # NO CHANGE (analyzeBehavior() and computeGroupMood() already exist)
  handlers/
    game-loop.ts            # MODIFY: gather fresh behavioral data in onMissionPost(), pass to generateMissionNarrative()
  db/
    types.ts                # NO CHANGE (GuzmanContext already has playerNotes, mood)
```

### Pattern 1: Fresh Behavioral Data at Mission Post Time

**What:** Call `analyzeBehavior(gameId)` at mission post time (09:00) to get current player behavioral data, rather than relying on `GuzmanContext.playerNotes` which was populated at the previous round's reveal (21:00 the previous day).
**When to use:** Every mission post.
**Why:** The existing `GuzmanContext.playerNotes` is 12+ hours stale by 09:00. Players may have chatted in the group between 21:00 and 09:00. Fresh data produces more relevant dynamics sections. This is the same pattern used by `runGapFill()` in whisper-handler.ts (Phase 4) which also calls `analyzeBehavior()` fresh rather than relying on stale data.
**Fallback:** Non-critical. If `analyzeBehavior()` fails, fall through with stale `GuzmanContext.playerNotes` (CONST-04 pattern).

### Pattern 2: Group Mood Softly Biasing Mission Theme

**What:** Compute `GroupMood` from fresh behavioral data and pass it to the mission prompt. The prompt instructs the AI to let the mood influence the mission vibe (e.g., tense group -> betrayal/paranoia-themed heist, calm group -> urgency/danger-themed to shake things up, active group -> complex multi-layered heist).
**When to use:** Every mission post after round 1 (round 1 has no behavioral data).
**Why:** CONTEXT.md locks "group dynamics softly bias which mission template gets picked (not hard steer)." Since missions are AI-generated (not selected from a template pool), the "soft bias" is implemented via prompt instructions rather than template weighting. The AI decides, guided by mood context.
**Key insight:** This is a soft influence, not a deterministic mapping. The prompt says "consider the group mood" not "if tense, always pick betrayal theme."

### Pattern 3: Mixed Player Reference Style in Dynamics Section

**What:** The dynamics section uses a mix of named callouts ("@Erik har varit suspekt tyst") and vague allusions ("nagon har spelar ett dubbelspel"). Per CONTEXT.md, this is a locked decision.
**When to use:** Every dynamics section.
**Why:** Named callouts create direct paranoia for the targeted player. Vague allusions create diffuse paranoia where everyone wonders "is that about me?" The mix is essential for the social deduction experience.
**Implementation:** Prompt instruction tells the AI to vary between named and vague references. The AI naturally handles this well with few-shot examples.

### Pattern 4: Dynamics Section Woven Into Narrative (Recommended)

**What:** The group dynamics content is woven into the mission narrative rather than appearing as a separate labeled block. Guzman references player behavior as part of his mission briefing.
**When to use:** Default approach for all missions.
**Why:** A separate "GROUP DYNAMICS" block would break immersion and make the AI system visible to players. Guzman naturally commenting on player behavior while describing the heist feels organic. Example: "Vi korseller lagret vid hamnen ikvalr. Och jag har markt att nagon har... jag sager bara att vissa av er inte beter sig normalt, bre."
**This is Claude's discretion per CONTEXT.md.** Recommendation: woven approach for immersion. The prompt gives the AI latitude to place dynamics content where it fits best within the narrative.

### Pattern 5: Graceful Degradation with Thin Data

**What:** When behavioral data is thin (round 1, quiet group), the dynamics section is minimal or absent. The AI is instructed to only include dynamics content when there is meaningful behavioral data to reference.
**When to use:** Round 1 (no behavioral history), or when all players are inactive/neutral.
**Why:** Fabricating dynamics with no data would feel forced and generic. It is better to have a clean mission narrative with no dynamics section than a forced one. Round 2+ will have data.
**Implementation:** The prompt explicitly states: "Om det inte finns markbar beteendedata, fokusera pa uppdraget -- tvinga inte in gruppdynamik."

### Anti-Patterns to Avoid

- **Separate "GROUP DYNAMICS" labeled section in mission output:** Breaks immersion. Guzman should reference behavior naturally, not in a labeled block.
- **Hard mood-to-theme mapping:** Violates "soft bias" locked decision. The AI should consider mood, not be forced by it.
- **Running analyzeBehavior() and blocking mission post on failure:** CONST-04 requires non-blocking. Wrap in try/catch, fall back to stale data.
- **Exposing behavioral labels in mission text:** CONST-03 requires all behavioral data to stay internal. No "Ton: anklagande" in the output. Guzman translates analysis into natural orten-slang commentary.
- **Referencing player roles:** Mission is a public group message. NEVER include role hints that could reveal who is Golare/Akta. Behavioral references only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Behavioral data gathering | Custom queries at mission time | Existing `analyzeBehavior(gameId)` from behavioral-analysis.ts | Already built in Phase 2, returns exactly the data needed |
| Group mood computation | New mood logic | Existing `computeGroupMood(playerNotes)` from behavioral-analysis.ts | Already built in Phase 4, returns "tense"/"active"/"calm" |
| Player name resolution | Manual lookups | Existing `getGamePlayersOrderedWithInfo()` + `displayName()` | Established pattern throughout codebase |
| HTML sanitization | Custom stripping | Existing `sanitizeForTelegram()` in ai-guzman.ts | Already handles tag filtering and 4000-char truncation |
| AI fallback | Custom error handling | Existing try/catch with `MESSAGES.MISSION_POST()` template fallback | Already implemented in `generateMissionNarrative()` |
| Message delivery | Direct bot.api calls | `MessageQueue.send()` via `getMessageQueue()` | Rate limiting, per-chat queuing, mandatory pattern |

**Key insight:** This phase's technical work is minimal -- the behavioral analysis pipeline, mood computation, and mission generation infrastructure already exist. The real work is prompt engineering: writing instructions that produce engaging group dynamics content woven into mission narratives.

## Common Pitfalls

### Pitfall 1: Stale Behavioral Data at 09:00

**What goes wrong:** `GuzmanContext.playerNotes` was last updated at 21:00 (previous round's reveal). By 09:00 the next morning, players may have chatted overnight. The dynamics section references stale behavior.
**Why it happens:** `updateNarrativeContext()` runs at result reveal, not at mission post.
**How to avoid:** Call `analyzeBehavior(gameId)` fresh at mission post time, inside a non-critical try/catch. This is the same pattern used by `runGapFill()` in whisper-handler.ts (line 437). If it fails, fall back to stale `GuzmanContext.playerNotes`.
**Warning signs:** Mission dynamics referencing behavior from 2 days ago when players were active yesterday.

### Pitfall 2: Dynamics Section Leaking Structural Labels

**What goes wrong:** The mission text contains "Ton: anklagande" or "Aktivitet: hog" or "Anomali: tystnat plotsligt" -- raw behavioral analysis labels.
**Why it happens:** The AI sees structured labels in the prompt context and reproduces them. This is a known LLM failure mode.
**How to avoid:** Strong negative instruction in the prompt: "Du har tillgang till intern beteendedata. Anvand ALDRIG etiketter som 'Ton:', 'Aktivitet:', 'Anomali:' i meddelandet. Oversatt allt till naturligt orten-skvaller." Same pattern used successfully in the whisper prompt (Phase 3).
**Warning signs:** Mission text containing pipe characters, structured label syntax, or words like "Anomali".

### Pitfall 3: Dynamics Section Accidentally Revealing Roles

**What goes wrong:** Guzman's behavioral commentary inadvertently hints at who is Golare/Akta. Example: "Nagon beter sig som en infiltrator..." aimed at an actual Golare.
**Why it happens:** The mission prompt should NOT receive role information. But if behavioral data happens to correlate with a role-related pattern, the AI might make a connection.
**How to avoid:** (1) Never pass player roles to the mission prompt -- the prompt only sees behavioral data (tone, activity, anomalies). (2) Explicit prompt rule: "ALDRIG antyda eller avsloja spelares roller." (3) Behavioral data is role-blind by design -- `analyzeBehavior()` has no access to roles.
**Warning signs:** Mission text that could be interpreted as role-revealing by a suspicious player.

### Pitfall 4: Empty Dynamics Section in Round 1

**What goes wrong:** Round 1 has no behavioral history. The dynamics section is empty or generic, making the first mission feel like nothing changed from v1.
**Why it happens:** No messages captured yet, no behavioral baseline.
**How to avoid:** This is expected and fine. The prompt should handle thin data gracefully: "Om det inte finns tillrackligt med beteendedata, fokusera pa uppdraget." Round 1 missions should be dramatic and establish the story arc. Dynamics sections become meaningful from round 2 onward.
**Warning signs:** None -- this is intentional graceful degradation.

### Pitfall 5: Token Budget Exceeded with Behavioral Data

**What goes wrong:** Adding playerNotes for all players (6-10 players * ~50 tokens each) pushes the mission prompt past CONST-02 budget.
**Why it happens:** The current `buildMissionPrompt()` is ~200 user tokens. Adding 300-500 tokens of behavioral data is significant.
**How to avoid:** Hard-cap the behavioral data section at ~300 characters. The `buildPlayerSummary()` function already caps individual summaries at 200 chars. A compressed all-player overview with mood context should stay within budget. The total prompt growth (~250-350 tokens) is within CONST-02's 2x baseline.
**Warning signs:** Mission generation latency increasing or cost spiking.

### Pitfall 6: Mission Narrative Quality Degradation

**What goes wrong:** Adding dynamics content to the prompt dilutes the mission narrative quality. The AI spends too many tokens on behavioral commentary and too few on the dramatic heist description.
**Why it happens:** Prompt length increases, competing instructions, model splitting attention.
**How to avoid:** (1) Prompt structure: put the mission task first, dynamics as supplementary. (2) Explicit ratio instruction: "70% av meddelandet ska vara uppdraget/heist-beskrivningen. 30% ska vara gruppdynamik vavd in." (3) Keep the max_tokens at 800 (existing) to ensure there is room for both. (4) The dynamics content is woven in, not a separate 500-char block.
**Warning signs:** Missions that are mostly behavioral commentary with minimal heist content.

## Code Examples

### Example 1: Expanded buildMissionPrompt with Behavioral Data

```typescript
// Source: Modified function in ai-prompts.ts
// Adds groupDynamics and groupMood parameters

export function buildMissionPrompt(
  roundNumber: number,
  gameContext: GuzmanContext,
  playerNames: string[],
  groupDynamics: string,    // NEW: compressed behavioral overview
  groupMood: string,        // NEW: "tense" | "active" | "calm"
): string {
  const previousRounds = gameContext.roundSummaries
    .map(
      (r) =>
        `Runda ${r.round}: ${r.missionTheme} -- ${r.outcome}. ${r.narrativeBeats}`,
    )
    .join("\n");

  // Mood-to-theme guidance (soft, not deterministic)
  let moodGuidance: string;
  if (groupMood === "tense") {
    moodGuidance = "Gruppen ar pa kant -- lat uppdraget spegla misstro och forraderi. Nagon i teamet kanske inte ar palitlig.";
  } else if (groupMood === "calm") {
    moodGuidance = "Det ar for lugnt -- skapa bradsklighet och fara. Gor stoten hoginsats for att vacka gruppen.";
  } else {
    moodGuidance = "Gruppen ar aktiv -- gor stoten komplex med flera lager. Testa deras samarbete.";
  }

  // Dynamics section (only if data available)
  const dynamicsSection = groupDynamics
    ? `\nGRUPPDYNAMIK (intern data -- vav in naturligt, ALDRIG visa som etiketter):
${groupDynamics}

Vav in observationer om spelarna i uppdraget. Blanda namngivna utpekanden ("@Erik, jag kollar pa dig") med vaga antydningar ("nagon har beter sig skumt"). Guzman har markt saker och kommenterar medan han beskriver stoten.`
    : "";

  return `Skriv ett uppdragsmeddelande for Runda ${roundNumber}.

SPELKONTEXT:
- Spelare: ${playerNames.join(", ")}
- Stamning: ${gameContext.mood}
- Story-arc: ${gameContext.storyArc || "Ingen annu -- detta ar starten"}
${previousRounds ? `- Tidigare rundor:\n${previousRounds}` : "- Forsta rundan"}

STAMNING I GRUPPEN: ${groupMood}
${moodGuidance}
${dynamicsSection}

UPPGIFT:
Beskriv en ny stot/heist som Ligan ska genomfora. Gor det dramatiskt och specifikt -- ge stoten en plats, ett mal, och en kansla av fara. Namn att Capo ska valja sitt team. Avsluta med spanning.

GRUPPDYNAMIK-REGLER:
- Vav in beteendeobservationer NATURLIGT i narrativet (inte som en separat sektion)
- Blanda namngivna utpekanden med vaga antydningar
- Anvand ALDRIG etiketter som "Ton:", "Aktivitet:", "Anomali:" -- oversatt till Guzmans orten-skvaller
- ALDRIG avsloja spelares roller
- Om det inte finns tillrackligt med beteendedata, fokusera pa uppdraget -- tvinga inte in gruppdynamik
- 70% av meddelandet ska vara uppdraget. 30% max ska vara gruppdynamik.

Hall det under 1500 tecken. Anvand <b> och <i> for formatering.`;
}
```

### Example 2: Fresh Behavioral Data Gathering in onMissionPost

```typescript
// Source: Modified logic in game-loop.ts onMissionPost() around line 1538
// Gathers fresh behavioral data alongside existing GuzmanContext

// Existing code (unchanged):
const missionPlayers = await getGamePlayersOrderedWithInfo(game.id);
const missionPlayerNames = missionPlayers.map((p) => displayName(p.players));
const missionGuzmanCtx = await getGuzmanContext(game.id);

// NEW: Gather fresh behavioral data (non-critical)
let groupDynamics = "";
let groupMood = "active";
try {
  const { playerNotes } = await analyzeBehavior(game.id);
  groupMood = computeGroupMood(playerNotes);

  // Build compressed dynamics string for the prompt
  const entries: string[] = [];
  for (const [name, note] of Object.entries(playerNotes)) {
    if (note === "inaktiv") continue;
    entries.push(`${name}: ${note}`);
  }
  groupDynamics = entries.join("\n");
  // Hard-cap at 500 chars
  if (groupDynamics.length > 500) {
    groupDynamics = groupDynamics.slice(0, 497) + "...";
  }
} catch (err) {
  console.warn(
    "[game-loop] Fresh behavioral analysis for mission failed, using stale data:",
    err instanceof Error ? err.message : err,
  );
  // Fall back to stale playerNotes from GuzmanContext (CONST-04)
}

missionText = await generateMissionNarrative(
  round.round_number,
  missionGuzmanCtx,
  missionPlayerNames,
  groupDynamics,  // NEW
  groupMood,      // NEW
);
```

### Example 3: Expanded generateMissionNarrative Signature

```typescript
// Source: Modified function in ai-guzman.ts
// Passes behavioral data through to buildMissionPrompt

export async function generateMissionNarrative(
  roundNumber: number,
  gameContext: GuzmanContext,
  playerNames: string[],
  groupDynamics: string = "",    // NEW: default empty for backward compat
  groupMood: string = "active",  // NEW: default active for backward compat
): Promise<string> {
  try {
    const client = getAIClient();
    if (!client) {
      return MESSAGES.MISSION_POST(roundNumber);
    }

    const response = await client.chat.completions.create({
      model: MODEL_MAP.narrative,
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        {
          role: "user",
          content: buildMissionPrompt(
            roundNumber, gameContext, playerNames,
            groupDynamics, groupMood,  // NEW
          ),
        },
      ],
      max_tokens: 800,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return MESSAGES.MISSION_POST(roundNumber);
    }

    return sanitizeForTelegram(content);
  } catch (error) {
    return MESSAGES.MISSION_POST(roundNumber);
  }
}
```

## State of the Art

| Old Approach (current) | New Approach (this phase) | Impact |
|------------------------|---------------------------|--------|
| `buildMissionPrompt()` takes 3 params (roundNumber, gameContext, playerNames) | Takes 5 params (adds groupDynamics, groupMood) | Prompt has behavioral context to produce dynamics section |
| Mission narrative describes heist only | Mission narrative weaves in behavioral commentary | GROUP-04: missions reflect player behavior |
| `onMissionPost()` only fetches GuzmanContext for narrative context | Also calls `analyzeBehavior()` for fresh behavioral data | Current data instead of 12-hour stale data |
| Mission theme is purely AI-creative | Mission theme softly influenced by group mood | Locked decision: tense -> betrayal vibes, calm -> urgency vibes |
| All players are generic names in mission text | Some players get named callouts, others are vaguely alluded to | Locked decision: mixed named/vague references |

**What stays unchanged:**
- `MODEL_MAP.narrative`: stays gpt-4o-mini -- no model change
- Mission scheduling (09:00): unchanged
- Template fallback (`MESSAGES.MISSION_POST()`): unchanged, still fires on any AI failure
- `max_tokens: 800`: unchanged
- `temperature: 0.9`: unchanged
- Result reveal (`generateResultReveal()`): unchanged (out of scope for this phase)
- All other AI functions: unchanged

## Integration Points

### Data Flow

```
09:00 onMissionPost fires (game-loop.ts)
  -> getGuzmanContext(gameId)           [existing]
  -> analyzeBehavior(gameId)            [existing function, NEW call site]
  -> computeGroupMood(playerNotes)      [existing function, NEW call site]
  -> compress playerNotes to dynamics string  [NEW logic, ~10 lines]
  -> generateMissionNarrative(round, ctx, names, dynamics, mood)  [MODIFIED signature]
    -> buildMissionPrompt(round, ctx, names, dynamics, mood)       [MODIFIED prompt builder]
    -> OpenAI chat.completions.create                              [existing]
    -> sanitizeForTelegram(content)                                [existing]
  -> MessageQueue.send(groupChatId, missionText)                   [existing]
```

### Function Signature Changes

```typescript
// ai-prompts.ts: buildMissionPrompt
// OLD: (roundNumber, gameContext, playerNames)
// NEW: (roundNumber, gameContext, playerNames, groupDynamics, groupMood)

// ai-guzman.ts: generateMissionNarrative
// OLD: (roundNumber, gameContext, playerNames)
// NEW: (roundNumber, gameContext, playerNames, groupDynamics?, groupMood?)
// Default params ensure backward compatibility (dev.ts also calls this)
```

### Files Modified

| File | Change | Why |
|------|--------|-----|
| `src/lib/ai-prompts.ts` | Rewrite `buildMissionPrompt()` with dynamics/mood params | Add behavioral data and mood guidance to mission prompt (GROUP-04) |
| `src/lib/ai-guzman.ts` | Expand `generateMissionNarrative()` signature | Pass-through new params to prompt builder |
| `src/handlers/game-loop.ts` | Expand `onMissionPost()` to gather fresh behavioral data | Call `analyzeBehavior()` + `computeGroupMood()` at 09:00 |

### Import Changes

| File | New Import | From |
|------|-----------|------|
| `src/handlers/game-loop.ts` | `analyzeBehavior`, `computeGroupMood` | `../lib/behavioral-analysis.js` |

## Design Recommendations (Claude's Discretion Areas)

### Dynamics Section Placement: Woven Into Narrative

**Recommendation:** Weave dynamics into the mission narrative naturally. Guzman comments on player behavior as part of his mission briefing, not in a separate labeled section.

**Rationale:** A separate "GRUPPDYNAMIK" block breaks immersion and reveals the system. Guzman naturally commenting on behavior while describing the heist ("Vi kryssar lagret vid hamnen ikvall, och jag har sett att nagon av er... ja, ni vet vem jag menar") feels organic and paranoia-inducing.

### Dynamics Section Length: Adaptive

**Recommendation:** Scale based on available data. Round 1: no dynamics. Round 2: 1-2 brief mentions. Round 3+: full dynamics with multiple player references. Prompt instruction: "30% max ska vara gruppdynamik."

**Rationale:** This prevents thin-data missions from feeling forced and lets the dynamics grow naturally as the game progresses. The 70/30 split ensures the heist description stays the centerpiece.

### Player References: 2-4 Per Mission

**Recommendation:** Reference 2-4 players per mission, mixing named and vague styles. Not all players -- only those with notable behavior. If nobody is notable, reference 0-1 with vague allusions.

**Rationale:** Referencing all 6-10 players would dilute impact. Targeting 2-4 creates focused paranoia. Players NOT mentioned will also be paranoid ("why didn't Guzman mention me -- does he know something?").

### Behavioral vs. Quote References: Behavioral Patterns

**Recommendation:** Primarily reference behavioral patterns (silence, aggression, alliance-forming) rather than specific things players said. Player quotes can be subtly twisted-referenced but should not be the focus.

**Rationale:** The mission narrative is a public group message. Quoting specific messages (even twisted) could reveal that the bot reads and processes individual messages, breaking the immersion of Guzman's "gut feeling." Behavioral patterns feel more natural: "Ahmed har vart for tyst... vad doljer du, bre?"

### Role Hints: Stay Purely Behavioral

**Recommendation:** Do NOT drop subtle role hints. Keep all references purely behavioral.

**Rationale:** The mission is a public group message seen by all players. Any role hints, even subtle ones, could give one side an unfair advantage. This is a social deduction game -- information control is paramount. The prompt should explicitly forbid role-related commentary.

### Truthfulness: Real Behavior, Guzman's Interpretation

**Recommendation:** Guzman references real observed behavior but interprets it through his paranoid lens. He frames normal behavior as suspicious and suspicious behavior as damning. He never fabricates behavior that did not occur.

**Rationale:** This maintains the "never fabricates" constraint from Phase 4 while allowing Guzman to be manipulative. Saying "@Sara har blivit plotsligt aktiv -- det oroar mig" about a genuinely active player is truthful observation with paranoid interpretation. Saying "Sara har forsokt kontakta aina" when Sara hasn't is fabrication.

### Escalation Pattern: Gradual Build

**Recommendation:** Dynamics content intensity escalates over rounds:
- Round 1: No dynamics (no data)
- Round 2: 1-2 brief vague mentions ("nagon beter sig konstigt")
- Round 3: Named callouts begin, more specific observations
- Round 4-5: Maximum intensity, direct confrontations, multiple named callouts

**Rationale:** Mirrors the whisper escalation pattern (vague -> specific -> pointed). Creates narrative arc. Early rounds let data accumulate; late rounds leverage it for maximum impact.

## Open Questions

1. **Should the dev.ts handler also pass behavioral data?**
   - What we know: `dev.ts` calls `scheduleHandlers.onMissionPost()` which goes through the full pipeline.
   - What's unclear: Whether the dev trigger needs special handling.
   - Recommendation: No special handling needed. `onMissionPost()` is the unified entry point. The dev trigger goes through the same path and will get dynamics data if available.

2. **Should `generateMissionNarrative` have default params or require explicit args?**
   - What we know: Only `onMissionPost()` in game-loop.ts calls `generateMissionNarrative()`. But the function signature is exported.
   - Recommendation: Use default params (`groupDynamics = ""`, `groupMood = "active"`) for backward compatibility. If any other call site exists or is added later, it gracefully degrades.

3. **max_tokens budget with dynamics content**
   - What we know: Current `max_tokens: 800` produces ~1200-1500 char missions. Adding dynamics content means the AI needs to fit both heist description and behavioral commentary in the same budget.
   - Recommendation: Keep at 800. The 70/30 split instruction handles budget allocation. If testing shows truncation, bump to 1000 (still within Telegram's 4096 limit after sanitization). Monitor in playtesting.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/ai-prompts.ts` -- existing `buildMissionPrompt()`, line 76-100
- Codebase analysis: `src/lib/ai-guzman.ts` -- existing `generateMissionNarrative()`, line 65-105
- Codebase analysis: `src/handlers/game-loop.ts` -- existing `onMissionPost()`, line 1494-1569
- Codebase analysis: `src/lib/behavioral-analysis.ts` -- `analyzeBehavior()`, `computeGroupMood()`, `buildPlayerSummary()`
- Codebase analysis: `src/db/types.ts` -- `GuzmanContext` shape (playerNotes, mood, roundSummaries)
- Codebase analysis: `src/handlers/whisper-handler.ts` -- fresh `analyzeBehavior()` call pattern at line 437

### Secondary (MEDIUM confidence)
- `.planning/phases/05-mission-adaptation/05-CONTEXT.md` -- locked decisions and discretion areas
- `.planning/REQUIREMENTS.md` -- GROUP-04 requirement definition
- `.planning/ROADMAP.md` -- Phase 5 goal and dependencies
- `.planning/STATE.md` -- accumulated decisions, established patterns
- `.planning/phases/04-gap-fill-accusations/04-RESEARCH.md` -- fresh behavioral data pattern, mood computation pattern
- `.planning/phases/03-whisper-integration/03-RESEARCH.md` -- behavioral data in prompts pattern, label leaking prevention

### Tertiary (LOW confidence)
- None. All findings derived from direct codebase analysis and locked decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing code examined
- Architecture: HIGH -- clear extension points identified, same patterns used in Phase 3 and 4
- Prompt engineering: MEDIUM -- prompt design is inherently experimental, needs gameplay testing to tune the dynamics/heist balance
- Pitfalls: HIGH -- based on actual codebase data flow analysis and lessons from Phase 3/4 research

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days -- prompt engineering may need iterative tuning through playtesting but architecture is stable)
