# Phase 2: Behavioral Analysis - Research

**Researched:** 2026-02-11
**Domain:** Heuristic text classification, behavioral stats computation, compressed summary generation, anomaly detection -- all pure TypeScript with existing stack
**Confidence:** HIGH

## Summary

Phase 2 creates a behavioral analysis module that reads captured player messages (from Phase 1's `player_messages` table), computes activity stats, classifies tone via Swedish keyword matching, detects anomalies, and writes compressed structured summaries into `GuzmanContext.playerNotes`. The integration seam already exists: `playerNotes` is a `Record<string, string>` in the `GuzmanContext` type, already read by `buildWhisperPrompt()` (ai-prompts.ts line 150), but currently always empty (`{}`). Phase 2 populates it.

The entire phase is pure computation with no external dependencies. The data pipeline (Phase 1) provides `getAllRecentMessages(gameId)` and `getRecentPlayerMessages(gameId, gamePlayerId)` as data sources. The output is a single `GuzmanContext` update via `updateGuzmanContext()`. No new database tables, no new npm packages, no user-facing changes. The main challenge is designing heuristic keyword lists for Swedish orten-slang tone classification and balancing anomaly detection sensitivity to avoid false positives in a low-message-volume environment (ring buffer holds max 10 messages per player).

**Primary recommendation:** Create a single new module `src/lib/behavioral-analysis.ts` with pure functions for stats computation, tone classification, anomaly detection, and summary building. Expose one main function `analyzeBehavior(gameId)` that returns a `Record<string, string>` ready to be written into `playerNotes`. Call it from `updateNarrativeContext()` in ai-guzman.ts so behavioral summaries refresh after each round reveal.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Format:** Structured labels, not narrative -- e.g. `Ton: defensiv | Aktivitet: hog | Anomali: ingen`
- **Language:** Swedish -- consistent with the game language and existing Swedish prompts
- **Content:** Behavior classifications only -- no quotes or paraphrases of what players said
- **Primary focus:** Overall pattern across the game, not just recent round activity
- **Relationships:** Include key relationship data -- who a player engages with or targets most (e.g. "Riktar sig mot: Kansen")
- **Inactive players:** Minimal flag only -- just "inaktiv" marker to save tokens for active players
- **Token budget:** ~50 per player, flex within CONST-02 (2x baseline total)
- **Anomaly baseline:** Relative to the player's own history
- **Anomaly timeframe:** Track across rounds, not just per-round

### Claude's Discretion
- Tone label rigidity (fixed 5 vs primary+secondary blends)
- Token budget flexibility within CONST-02 constraint
- Anomaly detection sensitivity thresholds
- Anomaly format in playerNote (separate field vs inline)
- Heuristic keyword lists for Swedish suburb slang tone classification

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (All Existing -- Zero New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 | Pure computation module | All analysis is string processing + arithmetic |
| @supabase/supabase-js | ^2.95.3 | Read player_messages, write guzman_context | Already used for all DB operations |

### Supporting (All Existing)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openai | ^6.21.0 | NOT used in Phase 2 | Behavioral analysis is heuristic, not AI-powered |
| zod | ^4.3.6 | Optional: validate analysis output shape | Only if type safety on summary format is desired |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Heuristic keyword matching | AI-based tone classification via OpenAI | AI adds latency, cost, and a failure mode for what is fundamentally a labeling task. Per-message AI analysis explicitly out of scope (REQUIREMENTS.md "Out of Scope"). Heuristics are deterministic, free, and fast. |
| Swedish keyword lists | NLP library (e.g. sentiment analysis) | No Swedish NLP library handles orten-slang. Would add a dependency (violates CONST-01). Custom keyword lists are more accurate for this narrow domain. |
| Storing analysis in playerNotes (JSONB) | Separate behavioral_analysis table | playerNotes already exists as the integration seam. Adding a table adds complexity with no benefit -- downstream consumers (prompts) only need the compressed string. |

**Installation:** None needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure (Changes Only)

```
src/
  lib/
    behavioral-analysis.ts   # NEW: all analysis logic (pure functions + orchestrator)
    ai-guzman.ts             # MODIFY: call analyzeBehavior() from updateNarrativeContext()
```

### Pattern 1: Single Analysis Module with Pure Functions

**What:** One module with all behavioral analysis functions. Pure functions for each concern (stats, tone, anomaly, summary). One orchestrator function that composes them.
**When to use:** When the entire feature is pure computation over existing data.
**Why:** Testable in isolation, no side effects, clear data flow. The module reads data (via DB functions) and returns a result. The caller (ai-guzman.ts) decides when to persist.

```typescript
// Source: codebase pattern (game-state.ts uses pure functions + types)
// File: src/lib/behavioral-analysis.ts

// Types for internal analysis pipeline
type PlayerStats = {
  messageCount: number;
  avgLength: number;
  timeSinceLastMsg: number | null; // minutes, null if no messages
  frequency: number; // messages per hour
  targetedPlayers: Map<string, number>; // name -> mention count
};

type ToneLabel = "anklagande" | "defensiv" | "tyst" | "neutral" | "kaotisk";

type PlayerAnalysis = {
  stats: PlayerStats;
  primaryTone: ToneLabel;
  secondaryTone: ToneLabel | null;
  anomalies: string[];
};

// Main orchestrator
export async function analyzeBehavior(
  gameId: string,
): Promise<Record<string, string>> {
  // 1. Fetch all messages for the game
  // 2. Group by player
  // 3. Compute stats per player
  // 4. Classify tone per player
  // 5. Detect anomalies per player
  // 6. Build compressed summary strings
  // 7. Return Record<playerName, summaryString>
}
```

### Pattern 2: Refresh at Round Reveal (updateNarrativeContext Hook)

**What:** Call `analyzeBehavior()` inside `updateNarrativeContext()` so that playerNotes refresh every time the narrative context updates -- which happens after every round reveal.
**When to use:** Behavioral data should be current for the next AI generation call (whisper, gap-fill, mission).
**Why:** `updateNarrativeContext()` is already called after every mission reveal (game-loop.ts lines 620 and 741). Adding behavioral analysis here ensures playerNotes are always fresh before the next scheduled whisper or gap-fill.

```typescript
// In ai-guzman.ts updateNarrativeContext()
export async function updateNarrativeContext(
  gameId: string,
  roundNumber: number,
  missionTheme: string,
  outcome: "success" | "fail" | "kaos_fail",
  narrativeBeats: string,
): Promise<void> {
  const context = await dbGetGuzmanContext(gameId);

  // ... existing round summary + mood logic ...

  // Refresh behavioral analysis (Phase 2)
  try {
    const playerNotes = await analyzeBehavior(gameId);
    context.playerNotes = playerNotes;
  } catch (err) {
    console.warn("[ai-guzman] Behavioral analysis failed:", err);
    // Keep existing playerNotes on failure
  }

  await dbUpdateGuzmanContext(gameId, context);
}
```

### Pattern 3: Player Name Resolution via Existing getGamePlayersWithInfo

**What:** The analysis module needs player names (for summaries and relationship tracking). Use `getGamePlayersWithInfo(gameId)` which already joins game_players with players to get `first_name`/`username`.
**When to use:** Any time you need to map `game_player_id` to a display name.
**Why:** Avoids N+1 queries. The function already exists and is used throughout the codebase.

```typescript
// Existing function in db/client.ts
const playersWithInfo = await getGamePlayersWithInfo(gameId);

// Build a lookup map: game_player_id -> display name
const nameMap = new Map<string, string>();
for (const gp of playersWithInfo) {
  const name = gp.players.username
    ? `@${gp.players.username}`
    : gp.players.first_name || "Okand";
  nameMap.set(gp.id, name);
}
```

### Pattern 4: Previous Round Stats for Anomaly Baseline

**What:** Anomaly detection compares current behavior to past behavior. Since `playerNotes` is overwritten each analysis cycle, the previous cycle's data needs to be available during analysis.
**When to use:** When detecting "player X was active but is now quiet."
**Why:** The CONTEXT.md specifies anomalies must be relative to the player's own history and tracked across rounds.

**Approach:** Store a separate lightweight history in `GuzmanContext` for cross-round tracking. Add a `behavioralHistory` field that records per-player stats snapshots per round. This is cheaper than re-querying old messages (which are pruned by the ring buffer anyway).

```typescript
// Extend GuzmanContext type
type GuzmanContext = {
  storyArc: string;
  roundSummaries: Array<{ ... }>;
  playerNotes: Record<string, string>;
  mood: string;
  // NEW: lightweight per-round stats for anomaly baseline
  behavioralHistory?: Record<string, Array<{
    round: number;
    messageCount: number;
    primaryTone: string;
  }>>;
};
```

### Anti-Patterns to Avoid

- **Calling AI for tone classification:** BEHAV-02 explicitly says "heuristic keyword matching." Calling OpenAI per player per round adds cost, latency, and a failure mode. The entire behavioral analysis module should be synchronous computation (after the initial DB fetch).
- **Storing raw message quotes in playerNotes:** CONTEXT.md explicitly says "Behavior classifications only -- no quotes or paraphrases of what players said." CONST-03 says "All behavioral data is internal to AI."
- **Running analysis on every message:** Per-message AI analysis is explicitly out of scope. Analysis runs at round reveal time, not per-message.
- **Overcomplicating anomaly detection:** With max 10 messages per player in the ring buffer and 5 rounds max per game, the data volume is tiny. Simple threshold comparisons are sufficient.
- **Ignoring the ring buffer constraint:** The player_messages table only holds the last ~10 messages per player per game. Historical analysis beyond that requires the `behavioralHistory` snapshot approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Player name resolution | Manual DB queries per player | `getGamePlayersWithInfo()` (existing) | Already handles the join, used everywhere in codebase |
| Message fetching | Custom queries | `getAllRecentMessages()` / `getRecentPlayerMessages()` (existing) | Already built in Phase 1, handles ordering |
| Context persistence | Direct DB writes | `updateGuzmanContext()` (existing) | Handles JSONB serialization, used by ai-guzman.ts |
| Swedish stemming/NLP | Custom NLP pipeline | Substring/regex keyword matching | Orten-slang doesn't follow standard Swedish morphology; simple matching works |

**Key insight:** Phase 2 is almost entirely pure computation. The only I/O is reading messages and writing the updated GuzmanContext. Everything in between is string processing and arithmetic with no external dependencies needed.

## Common Pitfalls

### Pitfall 1: Empty Messages Leading to Division-by-Zero

**What goes wrong:** A player has zero messages (joined but never typed). Computing averages or frequencies produces NaN or Infinity.
**Why it happens:** Not all players are active in group chat. Some only interact via DM buttons (votes, mission actions).
**How to avoid:** Guard all division operations. If `messageCount === 0`, immediately classify as "inaktiv" and skip detailed analysis. This aligns with the CONTEXT.md decision: "Inactive players: Minimal flag only -- just 'inaktiv' marker."
**Warning signs:** `NaN` or `undefined` appearing in playerNotes strings.

### Pitfall 2: Name Mentions for Relationship Detection Are Unreliable

**What goes wrong:** Trying to detect "who Player X targets" by searching for other player names in their messages. But names can appear in many contexts, usernames might not match display names, and players might use nicknames.
**Why it happens:** Telegram users reference each other informally. `@username` mentions are reliable, but free-text name references are noisy.
**How to avoid:** Primary signal for relationship detection should be `@username` mentions (exact match). Secondary signal: first_name substring match (case-insensitive). Accept that this is approximate -- false negatives are fine, false positives are worse. Only report a relationship if mention count >= 2 to filter noise.
**Warning signs:** playerNotes showing "Riktar sig mot: X" when X was only mentioned once casually.

### Pitfall 3: Ring Buffer Message Loss Distorts Historical Comparison

**What goes wrong:** Player sent 20 messages in round 1, but the ring buffer only keeps 10. In round 3, computing "total messages across the game" only sees the latest 10, not the original 20. Historical comparison is skewed.
**Why it happens:** The PostgreSQL trigger prunes to 10 messages per player per game. Old messages are gone.
**How to avoid:** The `behavioralHistory` snapshot approach: at each analysis cycle, record `messageCount` as a cumulative stat in GuzmanContext. Then anomaly detection uses the snapshot history, not raw message counts. The raw messages are only used for tone classification (which only needs recent messages anyway).
**Warning signs:** Anomaly detection failing to notice a previously active player going quiet because old messages were pruned.

### Pitfall 4: Swedish Character Encoding in Keyword Matching

**What goes wrong:** Keywords like "anklagande" fail to match because the message text contains different Unicode normalization forms, or keyword lists use the wrong characters.
**Why it happens:** Swedish characters (a/o) can be encoded differently. Copy-paste from different sources may introduce invisible Unicode differences.
**How to avoid:** Always use proper Swedish characters in keyword lists. Apply `toLowerCase()` before matching. For extra safety, normalize with `String.prototype.normalize("NFC")` before comparison. This is a known project requirement (MEMORY.md: "All Swedish text MUST use proper characters").
**Warning signs:** Tone classifier always returning "neutral" because no keywords match.

### Pitfall 5: Token Budget Overflow with Many Players

**What goes wrong:** 10-player game produces summaries that exceed CONST-02's 500-token budget (10 players x 50 tokens = 500, right at the limit). With relationship data and anomalies, individual summaries creep above 50 tokens.
**Why it happens:** Relationship data ("Riktar sig mot: X") and anomaly descriptions ("Blivit tystare sedan runda 2") add tokens beyond the base stats.
**How to avoid:** Measure actual token count of generated summaries. Use a conservative estimate: 1 Swedish word = ~1.5 tokens (Swedish words are longer than English). Hard-cap individual summaries at a character limit (~200 chars per active player). Inactive players get exactly "inaktiv" (1 token). Budget math: 6 active players * 50 tokens + 4 inactive * 1 token = 304 tokens -- well within budget.
**Warning signs:** AI generation calls failing or producing truncated output because context is too large.

### Pitfall 6: GuzmanContext Type Extension Breaking Existing Code

**What goes wrong:** Adding `behavioralHistory` to the `GuzmanContext` type causes issues with existing games that have persisted context without this field.
**Why it happens:** `GuzmanContext` is stored as JSONB in the `games` table. Existing games won't have the new field.
**How to avoid:** Make `behavioralHistory` optional (`behavioralHistory?: ...`). In the analysis code, handle the case where it's undefined (first analysis for this game). The existing `getGuzmanContext()` already handles partial JSONB by returning defaults.
**Warning signs:** `TypeError: Cannot read properties of undefined` when accessing behavioralHistory.

## Code Examples

### Complete Tone Classification with Swedish Keywords

```typescript
// Source: domain knowledge + Swedish orten-slang context from ai-prompts.ts
// File: src/lib/behavioral-analysis.ts

type ToneLabel = "anklagande" | "defensiv" | "tyst" | "neutral" | "kaotisk";

// Swedish keyword sets for tone classification
// These cover standard Swedish + orten-slang variants

const TONE_KEYWORDS: Record<Exclude<ToneLabel, "tyst" | "neutral">, string[]> = {
  anklagande: [
    // Direct accusations
    "golare", "gola", "golat", "rat", "ratta",
    // Suspicion language
    "misstanker", "suspekt", "shady", "skum", "lansen", "konstigt",
    // Pointing fingers
    "det var", "maste vara", "jag tror att", "nagon av er",
    "saboterar", "sabotage",
    // Orten-slang accusations
    "bansen", "tjansen", "snitch", "sansen",
    // Aggressive questioning
    "varfor", "forklara", "bevis",
  ],
  defensiv: [
    // Self-defense
    "jag gjorde inget", "det var inte jag", "oskyldig",
    "lojal", "lojalitet", "litar",
    // Deflection
    "kolla pa", "istallet", "inte jag utan",
    // Pleading
    "tro mig", "wallah", "jag svarer", "svarer",
    // Orten-slang defense
    "bre jag svarer", "shuno", "pa min mamma",
  ],
  kaotisk: [
    // Chaos/excitement
    "haha", "lol", "lmao", "xd",
    // Random/off-topic indicators (excessive emoji/caps detected separately)
    "yolo", "yalla", "kaooooos", "kaos",
    // Disruption
    "alla golar", "nej nej nej", "vad hander",
    // Spam-like patterns detected by frequency, not keywords
  ],
};

/**
 * Classify a player's tone based on their recent messages.
 * Returns primary tone and optional secondary.
 *
 * Classification logic:
 * 1. If zero messages -> "tyst"
 * 2. Count keyword hits per tone category
 * 3. Highest count = primary tone
 * 4. Second highest (if > 0) = secondary tone
 * 5. If no keywords match -> "neutral"
 */
function classifyTone(
  messages: string[],
): { primary: ToneLabel; secondary: ToneLabel | null } {
  if (messages.length === 0) {
    return { primary: "tyst", secondary: null };
  }

  const combined = messages.join(" ").toLowerCase().normalize("NFC");
  const scores: Record<string, number> = {
    anklagande: 0,
    defensiv: 0,
    kaotisk: 0,
  };

  for (const [tone, keywords] of Object.entries(TONE_KEYWORDS)) {
    for (const kw of keywords) {
      // Count occurrences (not just presence)
      const regex = new RegExp(kw, "gi");
      const matches = combined.match(regex);
      if (matches) {
        scores[tone] += matches.length;
      }
    }
  }

  // Sort by score descending
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a);

  const topScore = sorted[0][1];
  const secondScore = sorted[1][1];

  if (topScore === 0) {
    return { primary: "neutral", secondary: null };
  }

  const primary = sorted[0][0] as ToneLabel;
  const secondary = secondScore > 0 ? sorted[1][0] as ToneLabel : null;

  return { primary, secondary };
}
```

### Activity Stats Computation

```typescript
// Source: pure computation, no external deps
// File: src/lib/behavioral-analysis.ts

type PlayerStats = {
  messageCount: number;
  avgLength: number;
  timeSinceLastMsg: number | null; // minutes
  frequency: number; // messages per hour since first message
};

function computeStats(
  messages: Array<{ message_text: string; sent_at: string }>,
): PlayerStats {
  if (messages.length === 0) {
    return { messageCount: 0, avgLength: 0, timeSinceLastMsg: null, frequency: 0 };
  }

  const messageCount = messages.length;
  const avgLength = Math.round(
    messages.reduce((sum, m) => sum + m.message_text.length, 0) / messageCount,
  );

  // Messages are ordered newest-first from DB
  const newestTime = new Date(messages[0].sent_at).getTime();
  const timeSinceLastMsg = Math.round((Date.now() - newestTime) / (1000 * 60));

  // Frequency: messages per hour since oldest message in buffer
  const oldestTime = new Date(messages[messages.length - 1].sent_at).getTime();
  const spanHours = Math.max((newestTime - oldestTime) / (1000 * 60 * 60), 0.1);
  const frequency = Math.round((messageCount / spanHours) * 10) / 10;

  return { messageCount, avgLength, timeSinceLastMsg, frequency };
}
```

### Anomaly Detection

```typescript
// Source: domain logic based on CONTEXT.md anomaly requirements
// File: src/lib/behavioral-analysis.ts

type HistoryEntry = {
  round: number;
  messageCount: number;
  primaryTone: string;
};

/**
 * Detect behavioral anomalies by comparing current stats to player's own history.
 * Returns list of Swedish anomaly descriptions (empty if none).
 */
function detectAnomalies(
  currentStats: PlayerStats,
  currentTone: ToneLabel,
  history: HistoryEntry[],
): string[] {
  const anomalies: string[] = [];
  if (history.length === 0) return anomalies;

  // Calculate historical averages
  const avgHistoricMsgCount =
    history.reduce((sum, h) => sum + h.messageCount, 0) / history.length;

  // Anomaly: Suspicious silence (active -> quiet)
  // Threshold: current messages < 30% of historical average AND had at least 3 avg
  if (avgHistoricMsgCount >= 3 && currentStats.messageCount <= avgHistoricMsgCount * 0.3) {
    anomalies.push("plotsligt tyst");
  }

  // Anomaly: Aggression spike (tone shift to accusatory)
  // Check if player was NOT accusatory before but is now
  const wasAccusatory = history.some((h) => h.primaryTone === "anklagande");
  if (currentTone === "anklagande" && !wasAccusatory) {
    anomalies.push("aggressionstopp");
  }

  // Anomaly: Activity spike (quiet -> very active)
  if (avgHistoricMsgCount <= 2 && currentStats.messageCount >= 6) {
    anomalies.push("plotsligt aktiv");
  }

  // Anomaly: Gradual silence trend across rounds
  if (history.length >= 2) {
    const recent = history.slice(-2);
    const declining = recent.every((h, i) =>
      i === 0 || h.messageCount < recent[i - 1].messageCount,
    );
    if (declining && currentStats.messageCount < recent[recent.length - 1].messageCount) {
      anomalies.push("blir tystare");
    }
  }

  return anomalies;
}
```

### Compressed Summary Builder

```typescript
// Source: CONTEXT.md format requirements
// File: src/lib/behavioral-analysis.ts

/**
 * Build a compressed behavioral summary for a single player.
 * Target: ~50 tokens per active player.
 *
 * Format example (active player):
 *   "Ton: anklagande/defensiv | Aktivitet: hog (8 msg) | Riktar sig mot: @Kansen | Anomali: aggressionstopp"
 *
 * Format example (inactive player):
 *   "inaktiv"
 */
function buildPlayerSummary(
  stats: PlayerStats,
  tone: { primary: ToneLabel; secondary: ToneLabel | null },
  anomalies: string[],
  topTarget: string | null,
): string {
  // Inactive: minimal flag
  if (stats.messageCount === 0) {
    return "inaktiv";
  }

  const parts: string[] = [];

  // Tone (with optional secondary blend)
  const toneStr = tone.secondary
    ? `Ton: ${tone.primary}/${tone.secondary}`
    : `Ton: ${tone.primary}`;
  parts.push(toneStr);

  // Activity level (mapped from frequency/count)
  const activityLevel =
    stats.messageCount >= 7 ? "hog"
    : stats.messageCount >= 3 ? "medel"
    : "lag";
  parts.push(`Aktivitet: ${activityLevel} (${stats.messageCount} msg)`);

  // Relationship target (if any)
  if (topTarget) {
    parts.push(`Riktar sig mot: ${topTarget}`);
  }

  // Anomalies (if any)
  if (anomalies.length > 0) {
    parts.push(`Anomali: ${anomalies.join(", ")}`);
  }

  return parts.join(" | ");
}
```

### Relationship Detection via @mentions

```typescript
// Source: Telegram message patterns + codebase displayName logic
// File: src/lib/behavioral-analysis.ts

/**
 * Detect which other players a given player mentions/targets most.
 * Uses @username mentions (reliable) and first_name substring matches (fuzzy).
 * Returns the most-targeted player name, or null if none.
 */
function detectTopTarget(
  messages: string[],
  otherPlayers: Array<{ name: string; username: string | null }>,
): string | null {
  if (messages.length === 0) return null;

  const combined = messages.join(" ").toLowerCase();
  const mentionCounts = new Map<string, number>();

  for (const other of otherPlayers) {
    let count = 0;

    // Primary: @username mention (exact, reliable)
    if (other.username) {
      const usernameRegex = new RegExp(`@${other.username.toLowerCase()}`, "g");
      const matches = combined.match(usernameRegex);
      if (matches) count += matches.length * 2; // Weight @mentions higher
    }

    // Secondary: first_name substring (fuzzy, lower weight)
    if (other.name && other.name.length >= 3) {
      const nameRegex = new RegExp(other.name.toLowerCase(), "g");
      const matches = combined.match(nameRegex);
      if (matches) count += matches.length;
    }

    if (count > 0) {
      const displayName = other.username ? `@${other.username}` : other.name;
      mentionCounts.set(displayName, count);
    }
  }

  // Only report if mentioned >= 2 times (filter noise)
  let topName: string | null = null;
  let topCount = 1; // Minimum threshold
  for (const [name, count] of mentionCounts) {
    if (count > topCount) {
      topName = name;
      topCount = count;
    }
  }

  return topName;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| playerNotes always empty `{}` | Populated with behavioral summaries after each round | v1.1 Phase 2 | Whispers, gap-fill, missions all receive player behavior context |
| No behavioral tracking | Heuristic-based stats + tone + anomalies | v1.1 Phase 2 | Guzman becomes reactive to actual player behavior |
| Static whisper context (only round events) | Round events + per-player behavioral notes | v1.1 Phase 2 | Whispers reference observable behavioral patterns |

**What stays unchanged:**
- `trackGroupMessage()` in whisper-handler.ts -- still needed for gap-fill activity detection (different purpose: hourly count, not content analysis)
- All handler Composers -- no changes to game mechanics
- All AI prompt functions -- Phase 3 modifies prompts, not Phase 2
- Message capture middleware in bot.ts -- data pipeline unchanged

## Integration Points (Critical for Planning)

### Data Source: player_messages table

- `getAllRecentMessages(gameId)` returns all messages for all players, newest first
- `getRecentPlayerMessages(gameId, gamePlayerId, limit=10)` returns per-player messages
- Ring buffer: max 10 messages per player per game (pruned by DB trigger)
- Schema: `{ id, game_id, game_player_id, message_text, sent_at }`

### Data Sink: GuzmanContext.playerNotes

- Type: `Record<string, string>` -- key is player display name, value is summary string
- Already read by `buildWhisperPrompt()` (ai-prompts.ts line 150): `gameContext.playerNotes[targetPlayerName] || "Ingen historik"`
- Persisted via `updateGuzmanContext(gameId, context)` in `games.guzman_context` JSONB

### Trigger Point: updateNarrativeContext()

- Called after every round reveal (game-loop.ts lines 620 and 741)
- Called after kaos-fail (game-loop.ts line 741)
- Non-critical: wrapped in try/catch, failure logged but doesn't crash game
- This is where behavioral analysis should be invoked

### Player Name Resolution: getGamePlayersWithInfo()

- Returns `Array<GamePlayer & { players: Player }>` with `username`, `first_name`
- Display name logic: prefer `@username`, fall back to `first_name`, then "Okand"
- The display name used as key in `playerNotes` must match what prompts use

### GuzmanContext Type Extension

- Current type in db/types.ts line 142-152
- Must add optional `behavioralHistory` field for cross-round anomaly tracking
- Optional field ensures backward compatibility with existing games

## Token Budget Analysis

**CONST-02 constraint:** Token budget increase capped at 2x baseline (~500 additional tokens per AI call via compressed summaries).

**Estimation (worst case: 10-player game):**
- Active players (~6): 6 * ~50 tokens = ~300 tokens
- Inactive players (~4): 4 * 1 token ("inaktiv") = ~4 tokens
- Total: ~304 tokens -- well within 500-token budget

**Estimation (typical: 5-player game):**
- Active players (~4): 4 * ~50 tokens = ~200 tokens
- Inactive player (~1): 1 token
- Total: ~201 tokens

**Token counting heuristic:** Swedish words average ~6 characters. GPT tokenizer splits Swedish at ~4-5 chars per token. A summary like `Ton: anklagande/defensiv | Aktivitet: hog (8 msg) | Riktar sig mot: @Kansen | Anomali: aggressionstopp` is ~85 characters = ~20 tokens. Well under 50-token per-player target.

**Safety valve:** If total summary exceeds ~450 tokens (leaving buffer), truncate least-active players to "lag aktivitet" (short form).

## Design Recommendations (Claude's Discretion Areas)

### Tone Labels: Fixed 5 with Primary/Secondary Blends

**Recommendation:** Use the fixed 5 categories (`anklagande`, `defensiv`, `tyst`, `neutral`, `kaotisk`) as primary, with optional secondary blend. This gives downstream prompts clear labels while capturing nuance (e.g., "anklagande/defensiv" for a player who accuses but also defends themselves).

**Rationale:** Fixed categories are parseable by AI models and humans. Blends capture the common pattern of players exhibiting mixed behavior. The `/` separator is compact and unambiguous.

### Anomaly Format: Inline in playerNote

**Recommendation:** Include anomalies inline as the last field in the structured summary: `... | Anomali: plotsligt tyst`. If no anomaly, omit the field entirely (saves tokens).

**Rationale:** Separate storage adds complexity. Inline anomalies are immediately visible to the AI when reading playerNotes. Omitting the field for normal players saves tokens and reduces noise.

### Anomaly Sensitivity: Moderate (Fewer False Positives)

**Recommendation:** Set thresholds to require significant deviation before flagging anomalies:
- Silence: current < 30% of historical average AND historical average >= 3 messages
- Aggression spike: tone category changed AND was never accusatory before
- Activity spike: was at <= 2 messages AND jumped to >= 6

**Rationale:** In a 10-message ring buffer with 5 rounds, data is sparse. Trigger-happy anomaly detection would produce constant false positives. Better to flag real anomalies rarely than noise constantly.

### Swedish Keyword Lists: Broad Coverage with Orten-Slang

**Recommendation:** Include both standard Swedish and orten-slang in keyword lists. The Guzman persona establishes orten-slang as the game's register, and players will mirror it. Keywords should cover:
- Standard: `misstanker`, `oskyldig`, `lojal`, `forklara`
- Orten-slang: `wallah`, `shuno`, `bre`, `svarer pa mamma`
- Game-specific: `golare`, `gola`, `sabotage`, `team`

**Rationale:** Players will use a mix of registers. Missing orten-slang keywords would make the classifier blind to the dominant communication style.

## Open Questions

1. **Should behavioral analysis also run before whisper generation (not just at round reveal)?**
   - What we know: Currently, `updateNarrativeContext()` runs after round reveals. Whispers run on a schedule (13:00 and 19:00). If a round reveal happens at 21:00 and the next whisper is at 13:00 the next day, the analysis is 16 hours stale.
   - What's unclear: Whether mid-round messages significantly change behavioral profiles.
   - Recommendation: For Phase 2, refreshing at round reveal is sufficient. The behavioral profile captures overall game patterns, not moment-to-moment changes. Phase 3 (whisper integration) can add a freshness check if needed.

2. **How to handle the first round when there's no behavioral history?**
   - What we know: In round 1, `behavioralHistory` is empty. Anomaly detection has no baseline.
   - What's unclear: Whether to generate any playerNotes in round 1 or wait until round 2.
   - Recommendation: Generate playerNotes in round 1 with whatever data is available (messages sent during lobbying/round 1 discussion). Anomaly detection simply returns empty -- no anomalies for round 1. This is correct: nothing can be anomalous without a baseline.

3. **Should the `behavioralHistory` grow unbounded across rounds?**
   - What we know: Games have max 5 rounds. History entries are tiny (~20 bytes each).
   - What's unclear: Whether to cap history length.
   - Recommendation: No cap needed. With max 5 rounds and 10 players, the history is at most 50 entries (~1KB). Well within JSONB limits. Clean up naturally when game finishes.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: all source files in `/Users/martinnordlund/golare/src/` -- types, DB client, AI prompts, handlers
- CONTEXT.md (Phase 2): locked decisions on format, language, content, relationships, anomalies
- REQUIREMENTS.md: BEHAV-01 through BEHAV-04, CONST-01, CONST-02
- ROADMAP.md: phase dependencies and key decisions

### Secondary (MEDIUM confidence)
- OpenAI tokenizer behavior for Swedish text: estimated from known tokenization patterns (BPE on UTF-8). Actual token counts should be verified during implementation.

### Tertiary (LOW confidence)
- None. All findings derived from direct codebase analysis and locked decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing
- Architecture: HIGH -- single new module, clear integration points verified in codebase
- Tone classification: MEDIUM -- keyword lists are initial guesses that need tuning through gameplay testing
- Anomaly detection: MEDIUM -- thresholds are reasonable estimates but need real-game validation
- Token budget: HIGH -- arithmetic verified against actual summary format and player counts
- Pitfalls: HIGH -- derived from direct code inspection and known patterns

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days -- stable domain, no external APIs or moving targets)
