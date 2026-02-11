# Phase 3: Whisper Integration - Research

**Researched:** 2026-02-11
**Domain:** AI prompt engineering for behavior-aware whisper DMs, data pipeline from behavioral analysis to whisper generation, gossip-dealer persona design
**Confidence:** HIGH

## Summary

Phase 3 transforms Guzman's whisper DMs from generic suspicion-sowing messages into behavior-aware gossip that references what players actually said. The infrastructure is already in place: Phase 1 captures messages to `player_messages`, Phase 2 computes behavioral summaries into `GuzmanContext.playerNotes`, and the whisper generation pipeline (`whisper-handler.ts` -> `ai-guzman.ts` -> `ai-prompts.ts`) already reads `playerNotes`. The current whisper prompt (`buildWhisperPrompt()` in ai-prompts.ts) uses `playerNotes[targetPlayerName]` but only gets structured labels like `Ton: anklagande | Aktivitet: hog`. Phase 3 enriches this with actual message content (paraphrased) and all-player behavioral context.

The core work is: (1) fetching 1-2 actual player message quotes at whisper generation time and passing them to the prompt builder, (2) building a compressed all-players behavioral overview string, (3) rewriting the whisper prompt to enforce the gossip-dealer persona with oblique references, role-aware paranoia calibration, and context-dependent distortion rules, and (4) updating the whisper handler's `sendWhisper()` function to gather and pass this new data. No new database tables, no new npm packages, no new message types, no game mechanic changes.

The main design challenge is prompt engineering: crafting instructions that make the AI produce gossip-style paraphrases (twisted, out of context) without ever quoting directly, referencing timestamps, or exposing the behavioral analysis as structured data. The gossip-dealer voice ("Mannen, du vet inte vad folk sager om dig...") must feel natural and paranoia-inducing while staying within the CONST-03 constraint (behavioral data is internal to AI, never exposed to players as stats).

**Primary recommendation:** Modify three files: `ai-prompts.ts` (rewrite `buildWhisperPrompt()`), `ai-guzman.ts` (expand `generateWhisperMessage()` to accept behavioral data), and `whisper-handler.ts` (expand `sendWhisper()` to fetch and pass message quotes + all-player overview). Keep the same `gpt-4o-mini` model and structured response format. Add a new helper function to select and prepare message quotes for the prompt.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Paraphrasing style:**
- Context-dependent distortion: twist innocent messages more, keep already-suspicious messages closer to reality
- Guzman's voice is gossip dealer: "Mannen, du vet inte vad folk sager om dig..." -- spreading rumors, creating paranoia between players
- Occasionally weave multiple players' messages into conspiracy narratives, but only when messages happen to line up in a suspicious-looking way -- don't force it
- Never quote directly or reference timestamps (WHISP-03) -- everything framed as gossip and rumors Guzman "heard"

**Behavioral density:**
- Behavioral data about OTHER players: depends on what's notable -- if everyone's boring, brief overview; if someone stands out, zoom in on them
- Target player's own behavior: mix of direct confrontation ("du har vart tyst") and indirect framing ("folk har markt att...") -- keep the player guessing which voice Guzman is using
- No hard cap on behavioral references per whisper -- let the prompt and AI decide naturally based on available signal

**Paranoia calibration:**
- Baseline aggression varies by game role: more aggressive/confrontational toward informants (snitches), more seductive/conspiratorial toward the mole
- Disinformation: mostly truthful behavioral references, but RARELY drop a complete lie as a wildcard -- players can never fully trust whispers
- Anomaly reaction proportional to severity: small behavioral shift = subtle mention, big change = dramatic callout
- Role-behavior contradictions (e.g. mole being super helpful): subtly flag to OTHER players -- "nan har spelar hjalte lite for hart" -- without naming the mechanic

**Trigger conditions:**
- Every whisper includes behavioral references -- Guzman always reads the room, even if it's just a brief mention
- Gossip distribution: mix of shared and exclusive intel -- some gossip goes to multiple players with different spin (conflicting narratives), some is exclusive to one player (information asymmetry)
- Behavioral references are purely flavor -- they shape what Guzman SAYS but never influence game mechanics, targeting, or outcomes

### Claude's Discretion
- Whether paraphrasing escalates over game rounds (vague early -> pointed late) or stays consistent
- How to handle thin behavioral data (early game, quiet players) -- graceful fallback vs speculation
- Trust/doubt balance -- whether Guzman occasionally reassures players ("du ar den enda jag litar pa") as a manipulation tool

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (All Existing -- Zero New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | ^6.21.0 | Whisper generation via gpt-4o-mini with structured output | Already used for all whisper generation (MODEL_MAP.whisper) |
| zod | ^4.3.6 | WhisperResponseSchema for structured whisper response parsing | Already used in generateWhisperMessage() for truth_level extraction |
| @supabase/supabase-js | ^2.95.3 | Fetch player messages, read GuzmanContext | Already used for all data access |

### Supporting (All Existing)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | ^5.9.3 | Type-safe prompt builders and data transforms | All new code is TypeScript |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prompt-based paraphrasing (AI does the twisting) | Application-code paraphrasing (deterministic transforms) | Prompt-based is better: the AI naturally produces orten-slang gossip when instructed, while deterministic transforms would sound mechanical and require extensive Swedish language processing |
| Passing raw messages to prompt | Pre-summarizing messages before prompt | Raw messages give the AI more to work with for creative paraphrasing. Pre-summarizing adds a step and loses the specific wording the AI can twist. CONST-02 budget allows it (1-2 quotes = ~30-60 tokens) |
| gpt-4o-mini for whispers | gpt-4.1-nano for whispers | gpt-4o-mini is already the whisper model. The gossip-dealer persona with paraphrasing needs subtlety -- nano would struggle with the nuanced distortion/oblique reference requirements |

**Installation:** None needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure (Changes Only)

```
src/
  lib/
    ai-prompts.ts        # MODIFY: rewrite buildWhisperPrompt() with behavioral data params
    ai-guzman.ts         # MODIFY: expand generateWhisperMessage() signature + data gathering
    behavioral-analysis.ts  # MODIFY: add helper to select message quotes for whisper context
  handlers/
    whisper-handler.ts   # MODIFY: expand sendWhisper() to gather behavioral data + quotes
```

### Pattern 1: Data Enrichment at Whisper Send Time

**What:** The `sendWhisper()` function in whisper-handler.ts already gathers round events and player names. Extend it to also fetch message quotes for the target player and build an all-player behavioral overview, then pass both to `generateWhisperMessage()`.
**When to use:** When the data needed for prompt enrichment is already available via existing DB functions and in-memory context.
**Why:** Keeps the data gathering close to the point of use. The whisper handler already has access to the game, round, target player, and all players. Adding two more data fetches (messages + behavioral overview) is a natural extension.

```typescript
// In whisper-handler.ts sendWhisper()
// CURRENT flow:
//   guzmanCtx -> roundEvents -> buildWhisperPrompt(ctx, name, others, events)
//
// NEW flow:
//   guzmanCtx -> roundEvents
//             -> targetQuotes (1-2 paraphrased message quotes for target)
//             -> allPlayerOverview (compressed behavioral summary for all players)
//             -> targetRole (for paranoia calibration)
//             -> buildWhisperPrompt(ctx, name, others, events, quotes, overview, role)
```

### Pattern 2: Message Quote Selection and Preparation

**What:** A helper function that selects 1-2 recent messages from the target player's message buffer, choosing messages with the most behavioral signal (longest, most keyword-rich, or most anomalous).
**When to use:** Before every whisper generation, to pick the best raw material for Guzman's gossip.
**Why:** Random message selection would often pick bland messages. Signal-based selection gives the AI better material to work with, producing more engaging gossip.

```typescript
// New helper in behavioral-analysis.ts or ai-guzman.ts
export function selectQuotesForWhisper(
  messages: PlayerMessage[],
  maxQuotes: number,
): string[] {
  // 1. Filter to messages with substance (> 15 chars, not just emoji)
  // 2. Score by: length + keyword presence + recency
  // 3. Return top maxQuotes messages as raw text strings
  // Never return verbatim to player -- these go into the AI prompt
  // which paraphrases them as gossip
}
```

### Pattern 3: All-Player Behavioral Overview for Whisper Context

**What:** A function that compresses all players' `playerNotes` into a single overview string suitable for the whisper prompt. Highlights notable players (anomalies, high activity, accusations) and condenses boring players.
**When to use:** When building whisper prompts (WHISP-02: whisper prompts include all players' behavioral overview for context).
**Why:** The whisper AI needs to know what's happening with ALL players to make interesting cross-player references and conspiracy narratives. But we can't dump 10 full playerNotes -- need a compressed overview.

```typescript
// New function in behavioral-analysis.ts
export function buildAllPlayerOverview(
  playerNotes: Record<string, string>,
  targetPlayerName: string,
): string {
  // Separate target player from others
  // For others: if notable (has anomaly or high activity), include detail
  // For boring players: group as "Ovriga: neutral/lag aktivitet"
  // Target player is excluded (they get their own detailed section)
  // Hard-cap at ~150 tokens total
}
```

### Pattern 4: Role-Aware Prompt Sections

**What:** The rewritten whisper prompt includes role-specific instructions for paranoia calibration. The target player's role determines Guzman's approach: aggressive/confrontational for golare, seductive/conspiratorial for akta, special treatment for hogra_hand.
**When to use:** The CONTEXT.md explicitly requires role-aware paranoia calibration.
**Why:** Different roles create different gameplay experiences. Golare (informants) should feel Guzman breathing down their neck. Akta (loyal) should feel recruited into Guzman's paranoia. This makes whispers feel personalized beyond just behavioral data.

**CRITICAL SAFETY NOTE:** The role is used ONLY for AI persona calibration in the prompt system instructions. The whisper text itself must NEVER reference or hint at the target player's actual role. This is enforced by prompt rules (same pattern as existing buildWhisperPrompt which says "Inkludera ALDRIG information om spelares roller").

```typescript
// Role-to-tone mapping for prompt construction
type WhisperTone = "aggressive" | "conspiratorial" | "trusted";

function getWhisperTone(role: PlayerRole): WhisperTone {
  switch (role) {
    case "golare": return "aggressive";      // confrontational, suspicious
    case "akta": return "conspiratorial";    // seductive, recruiting
    case "hogra_hand": return "trusted";     // sharing intel, inner circle
  }
}
```

### Pattern 5: Prompt-Level Escalation Over Rounds

**What:** Whisper intensity escalates over game rounds. Round 1-2: vague references, building atmosphere. Round 3: more specific paraphrases, naming behaviors. Round 4-5: pointed, dramatic, high-pressure gossip.
**When to use:** Per Claude's Discretion area -- recommended approach.
**Why:** Escalation creates narrative arc within the game. Early vagueness lets behavioral data accumulate. Late-game specificity increases paranoia when it matters most (closer to endgame decisions). Also handles the thin-data problem naturally: early rounds have less data, so vagueness is appropriate.

```typescript
// Escalation tier based on round number
function getWhisperIntensity(roundNumber: number): "vague" | "specific" | "pointed" {
  if (roundNumber <= 2) return "vague";
  if (roundNumber <= 3) return "specific";
  return "pointed";
}
```

### Anti-Patterns to Avoid

- **Passing player roles in whisper text:** Roles go into the SYSTEM-level prompt calibration, NEVER into the generated whisper text. The AI must not mention roles. Existing rule in prompts already enforces this; the new prompt must maintain it.
- **Verbatim quotes in the prompt output:** The AI prompt must explicitly forbid verbatim quoting. Messages go into the prompt as raw material for paraphrasing, but the OUTPUT must never reproduce them word-for-word. This is WHISP-03.
- **Exposing behavioral stats to players:** `playerNotes` structured labels (Ton: anklagande, Aktivitet: hog) must NEVER appear in whisper text. The AI converts these to natural gossip language. CONST-03 requires this.
- **Fetching messages on every whisper for every player:** Only fetch messages for the TARGET player (quotes) and read cached `playerNotes` for all-player overview. Don't run the full `analyzeBehavior()` at whisper time -- it already runs at round reveal.
- **Hard-capping behavioral references:** CONTEXT.md says "No hard cap on behavioral references per whisper." Don't add artificial limits like "max 2 references." Let the prompt and AI decide naturally.
- **Forcing conspiracy narratives:** CONTEXT.md says conspiracy narratives should only happen "when messages happen to line up in a suspicious-looking way." Don't always instruct the AI to connect dots.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message paraphrasing | Deterministic text transforms | AI prompt instructions | Swedish orten-slang paraphrasing is complex; the AI already speaks the register |
| Behavioral summary retrieval | Re-running behavioral analysis | Read `GuzmanContext.playerNotes` (already computed) | Analysis runs at round reveal; reading cached results is free |
| Player message fetching | Custom queries | `getRecentPlayerMessages(gameId, gamePlayerId)` (existing) | Already built in Phase 1, handles ordering and limits |
| Role-based prompt branching | Complex if/else chains | Prompt template sections with role-to-tone mapping | Cleaner, more maintainable, AI handles the nuance |
| Token budget management | Manual token counting | Character-based hard caps on prompt sections | Swedish tokenization is unpredictable; character caps are reliable and sufficient |

**Key insight:** Phase 3 is primarily prompt engineering. The data pipeline and behavioral analysis are done. The work is: gather the right data at the right time, and write prompts that produce compelling gossip.

## Common Pitfalls

### Pitfall 1: Whisper Leaking Structured Behavioral Labels

**What goes wrong:** Guzman's whisper says "Ton: anklagande, Aktivitet: hog" instead of natural gossip language. The player sees the analysis machinery.
**Why it happens:** The AI model sees the structured labels in the prompt context and reproduces them in the output.
**How to avoid:** The prompt must explicitly instruct: "Du har tillgang till intern data om spelarnas beteende. Anvand ALDRIG dessa etiketter i ditt meddelande. Oversatt allt till naturligt skvaller." Add negative examples in the prompt.
**Warning signs:** Whisper text containing words like "Ton:", "Aktivitet:", "Anomali:", pipe characters, or structured label syntax.

### Pitfall 2: AI Quoting Messages Verbatim Despite Instructions

**What goes wrong:** Guzman's whisper contains exact quotes from the target's messages, violating WHISP-03.
**Why it happens:** When raw message text is in the prompt, the AI may reproduce it verbatim despite instructions not to. This is a known LLM failure mode.
**How to avoid:** (1) Strong negative instruction: "Du FAR ALDRIG citera nagons meddelande ordagrant. Parafrasera ALLTID." (2) Frame the messages as "things Guzman heard" not as direct quotes in the prompt. (3) Post-processing safety check: compare output against input quotes using simple substring matching. If a quote appears verbatim (>10 consecutive shared words), regenerate or strip.
**Warning signs:** Exact phrases from player messages appearing in whisper output.

### Pitfall 3: Token Budget Exceeded with Behavioral Data + Messages

**What goes wrong:** The whisper prompt becomes too large with all the behavioral context + message quotes, exceeding cost/latency expectations.
**Why it happens:** Adding playerNotes for all players + 1-2 message quotes + round events + role calibration can push the prompt from ~300 tokens to 600-800 tokens.
**How to avoid:** Budget the prompt carefully:
- System prompt (Guzman persona): ~400 tokens (existing, unchanged)
- User prompt base (instructions, game context): ~200 tokens
- Target player quotes (1-2 messages, capped at 100 chars each): ~60 tokens
- Target player behavioral note: ~50 tokens
- All-player overview (compressed): ~100-150 tokens
- Total: ~850-900 tokens -- within CONST-02's 2x baseline
**Warning signs:** Whisper generation latency increasing noticeably, or generation costs spiking.

### Pitfall 4: Empty Behavioral Data in Early Rounds

**What goes wrong:** Round 1 has no or minimal behavioral data. The whisper prompt has empty quotes and generic playerNotes. Guzman produces generic whispers no different from v1.
**Why it happens:** Behavioral data accumulates over rounds. Round 1 has sparse data.
**How to avoid:** Per Claude's Discretion: graceful escalation. Round 1-2 whispers use whatever data is available (even just "du har vart tyst" or speculation). The prompt should have a fallback instruction: "Om det inte finns mycket beteendedata, spekulera baserat pa magkansla och skapa mystik istallet." This matches the gossip-dealer persona -- gossip doesn't need evidence.
**Warning signs:** Early-game whispers feeling empty or mechanical compared to late-game whispers.

### Pitfall 5: Role Data Leaking into Whisper Text

**What goes wrong:** Guzman's whisper hints at the target player's actual role, giving away game information.
**Why it happens:** The role is passed into the prompt for paranoia calibration. The AI might reference it in the output.
**How to avoid:** (1) Put role information in the SYSTEM prompt section, not the USER message. (2) Explicit negative instruction: "Du vet spelarens roll internt for att kalibrera din ton, men du FAR ALDRIG antyda eller avsloja rollen i ditt meddelande." (3) The role determines TONE (aggressive vs conspiratorial), not CONTENT. This is the same pattern used by `buildSpaningPrompt()` and `buildSurveillanceCluePrompt()` which both handle role data safely.
**Warning signs:** Whispers to golare players mentioning "infiltrator," "lojalitet," or similar role-adjacent language.

### Pitfall 6: Conflicting Narratives Breaking Game Immersion

**What goes wrong:** Guzman tells Player A one thing about Player B, and tells Player B the exact opposite, but the contradictions are so obvious that players comparing notes immediately see through Guzman as unreliable.
**Why it happens:** The AI generates each whisper independently with no memory of what it told other players.
**How to avoid:** This is actually a FEATURE, not a bug. Per CONTEXT.md: "some gossip goes to multiple players with different spin (conflicting narratives)." The key is that Guzman IS unreliable -- players should discover contradictions and debate what's true. No mitigation needed; just ensure the AI produces varied enough content that contradictions feel like gossip, not bugs. If anything, add a prompt note: "Du ger ibland olika versioner av samma historia till olika spelare. Det ar meningen."
**Warning signs:** None -- contradictions are intentional.

## Code Examples

### Rewritten buildWhisperPrompt with Behavioral Data

```typescript
// Source: codebase pattern (existing buildWhisperPrompt in ai-prompts.ts)
// File: src/lib/ai-prompts.ts

export function buildWhisperPrompt(
  gameContext: GuzmanContext,
  targetPlayerName: string,
  targetRole: PlayerRole,
  otherPlayerNames: string[],
  roundEvents: string,
  targetQuotes: string[],       // NEW: 1-2 actual messages from target
  allPlayerOverview: string,    // NEW: compressed all-player behavioral overview
  roundNumber: number,          // NEW: for escalation
): string {
  const playerNote = gameContext.playerNotes[targetPlayerName] || "Ingen historik";
  const intensity = getWhisperIntensity(roundNumber);
  const tone = getWhisperTone(targetRole);

  // Build quotes section (only if quotes available)
  const quotesSection = targetQuotes.length > 0
    ? `\nSAKER DU HORT (aldrig citera ordagrant, parafrasera som skvaller):\n${targetQuotes.map((q, i) => `${i + 1}. "${q}"`).join("\n")}`
    : "\nIngen har hort nagonting fran den har personen an -- anvand det.";

  return `Skriv ett hemligt DM-meddelande (viskning) fran Guzman till <b>${targetPlayerName}</b>.

INTERN BETEENDEANALYS (anvand ALDRIG dessa etiketter i meddelandet -- oversatt till skvaller):
- Om ${targetPlayerName}: ${playerNote}
- Ovriga spelare: ${allPlayerOverview}
${quotesSection}

KONTEXT:
- Mottagare: ${targetPlayerName}
- Ovriga spelare: ${otherPlayerNames.join(", ")}
- Stamning: ${gameContext.mood}
- Handelser denna runda: ${roundEvents}
- Runda: ${roundNumber} av 5

GUZMANS ROST -- SKVALLERKUNGEN:
Du ar skvallerkungen. Du sprider rykten, skapar paranoia, och far alla att misstanka varandra.
Du pratar som att du "hort saker" och har "kansla for folk" -- aldrig som att du last data.
${tone === "aggressive"
    ? "Var konfrontativ och pressande. Den har spelaren kanns inte palitlig."
    : tone === "conspiratorial"
      ? "Var forforisk och konspirerande. Rekrytera den har spelaren till din sida."
      : "Var fortrolig och delande. Den har spelaren ar i din inre cirkel."}

INTENSITET (${intensity}):
${intensity === "vague"
    ? "Var vag och mystisk. Antyda utan detaljer. 'Jag har hort saker, bre...'"
    : intensity === "specific"
      ? "Namn specifika beteenden och ge parafraserat skvaller. 'Nagon sa nagonting intressant om dig...'"
      : "Var direkt och dramatisk. Konfrontera med tydliga (men forvrangda) detaljer."}

REGLER:
- ALDRIG citera nagons meddelande ordagrant. Parafrasera ALLTID som rykten/skvaller.
- ALDRIG referera till tidsangivelser ("klockan 14" eller "for 2 timmar sedan").
- ALDRIG visa beteendedata som statistik (inga procent, inga siffror, inga etiketter).
- ALDRIG avsloja spelares roller. Basera allt pa OBSERVERBART beteende.
- Allt du sager ska kannas som skvaller fran gatan, inte dataanalys.
- Du far ljuga ibland (sallsynt) -- spelare ska aldrig kunna lita helt pa dig.
- Anvand BARA namnen som listas ovan. Hitta ALDRIG PA namn som inte finns i spelet.

Ange vilken strategi du valde som FORSTA raden: [SANNING], [HALV_SANNING] eller [LOGN]

Hall meddelandet under 600 tecken. Anvand <b> och <i>.`;
}
```

### Message Quote Selection Helper

```typescript
// Source: pure computation over existing PlayerMessage type
// File: src/lib/behavioral-analysis.ts

import type { PlayerMessage } from "../db/types.js";

/**
 * Select 1-2 messages from a player's recent messages that have the most
 * behavioral signal -- longest, most keyword-rich, or most recent.
 * Returns raw message text strings for use in whisper prompts.
 *
 * Messages are NEVER passed to players verbatim -- they go into the AI
 * prompt which paraphrases them as gossip (WHISP-03, CONST-03).
 */
export function selectQuotesForWhisper(
  messages: PlayerMessage[],
  maxQuotes: number = 2,
): string[] {
  if (messages.length === 0) return [];

  // Filter: minimum substance (>15 chars, not just emoji/reactions)
  const substantial = messages.filter(
    (m) => m.message_text.length > 15 && /[a-zA-ZåäöÅÄÖ]{3,}/.test(m.message_text),
  );

  if (substantial.length === 0) return [];

  // Score each message: length + keyword presence + recency bonus
  const scored = substantial.map((msg, idx) => {
    let score = 0;
    // Length: longer messages have more material (cap contribution at 100 chars)
    score += Math.min(msg.message_text.length, 100);
    // Recency: newer messages get bonus (messages are newest-first from DB)
    score += Math.max(0, 20 - idx * 5);
    // Keyword bonus: messages with game-relevant words are more interesting
    const lower = msg.message_text.toLowerCase();
    const keywords = ["gola", "misstank", "team", "rost", "lag", "litar", "suspekt"];
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 15;
    }
    return { text: msg.message_text.slice(0, 100), score }; // Cap at 100 chars
  });

  // Sort by score descending, take top maxQuotes
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxQuotes).map((s) => s.text);
}
```

### All-Player Behavioral Overview Builder

```typescript
// Source: compresses existing playerNotes for whisper context
// File: src/lib/behavioral-analysis.ts

/**
 * Build a compressed all-player behavioral overview for whisper prompts.
 * Highlights notable players and condenses boring ones.
 * Excludes the target player (they get their own detailed section).
 *
 * Output format (natural language, not structured labels):
 * "Ahmed ar valdigt aktiv och pekar ut folk. Sara har blivit tystare.
 *  Ovriga ar lugna."
 */
export function buildAllPlayerOverview(
  playerNotes: Record<string, string>,
  targetPlayerName: string,
): string {
  const notable: string[] = [];
  const quiet: string[] = [];

  for (const [name, note] of Object.entries(playerNotes)) {
    if (name === targetPlayerName) continue;

    // Classify as notable or quiet based on content
    const isNotable =
      note.includes("Anomali:") &&
      !note.includes("Anomali: ingen") ||
      note.includes("Aktivitet: hog") ||
      note.includes("anklagande");

    if (note === "inaktiv") {
      quiet.push(name);
    } else if (isNotable) {
      // Convert structured note to natural language hint
      notable.push(`${name}: ${note}`);
    } else {
      quiet.push(name);
    }
  }

  const parts: string[] = [];
  if (notable.length > 0) {
    parts.push(`Markvardiga: ${notable.join("; ")}`);
  }
  if (quiet.length > 0) {
    parts.push(`Ovriga (lugna/neutrala): ${quiet.join(", ")}`);
  }

  const result = parts.join(". ");
  // Hard-cap at 400 chars to stay within token budget
  if (result.length > 400) {
    return result.slice(0, 397) + "...";
  }
  return result || "Ingen beteendedata tillganglig an.";
}
```

### Updated sendWhisper in whisper-handler.ts

```typescript
// Source: existing sendWhisper pattern, extended with behavioral data
// File: src/handlers/whisper-handler.ts

async function sendWhisper(
  game: Game,
  round: Round,
  target: PlayerWithInfo,
  players: PlayerWithInfo[],
  triggerType: WhisperTrigger,
): Promise<boolean> {
  try {
    const guzmanCtx = await getGuzmanContext(game.id);
    const otherNames = players
      .filter((p) => p.id !== target.id)
      .map((p) => displayName(p.players));
    const roundEvents = gatherRoundEvents(game, round, players);

    // NEW: Fetch target player's recent messages for quote selection
    const targetMessages = await getRecentPlayerMessages(
      game.id,
      target.id,
      10,
    );
    const targetQuotes = selectQuotesForWhisper(targetMessages, 2);

    // NEW: Build all-player behavioral overview
    const allPlayerOverview = buildAllPlayerOverview(
      guzmanCtx.playerNotes,
      displayName(target.players),
    );

    const whisperResult = await generateWhisperMessage(
      guzmanCtx,
      displayName(target.players),
      target.role ?? "akta",     // NEW: role for paranoia calibration
      otherNames,
      roundEvents,
      targetQuotes,              // NEW
      allPlayerOverview,         // NEW
      round.round_number,        // NEW: for escalation
    );

    // ... rest unchanged (send DM, persist whisper)
  } catch (err) {
    // ... existing error handling
  }
}
```

### Verbatim Quote Safety Check (Post-Processing)

```typescript
// Source: defensive programming pattern
// File: src/lib/ai-guzman.ts

/**
 * Check if the AI output contains a near-verbatim quote from the input messages.
 * Returns true if a suspicious match is found (>6 consecutive shared words).
 */
function containsVerbatimQuote(
  output: string,
  inputQuotes: string[],
): boolean {
  const outputWords = output.toLowerCase().split(/\s+/);

  for (const quote of inputQuotes) {
    const quoteWords = quote.toLowerCase().split(/\s+/);
    if (quoteWords.length < 4) continue; // Too short to be a meaningful quote

    // Sliding window: check for 6+ consecutive matching words
    for (let i = 0; i <= quoteWords.length - 6; i++) {
      const window = quoteWords.slice(i, i + 6).join(" ");
      if (outputWords.join(" ").includes(window)) {
        return true;
      }
    }
  }

  return false;
}
```

## State of the Art

| Old Approach (v1) | New Approach (Phase 3) | Impact |
|---|---|---|
| Whisper prompt uses only round events + generic playerNote | Prompt includes message quotes + all-player overview + role calibration + escalation | Whispers reference actual player behavior, feel personalized and paranoia-inducing |
| `buildWhisperPrompt()` takes 4 params | Takes 8 params (adds quotes, overview, role, round) | Richer context for AI generation |
| `sendWhisper()` only fetches round events | Also fetches player messages + builds behavioral overview | Two additional lightweight DB reads per whisper |
| Generic suspicion strategies (truth/half_truth/lie) | Context-dependent distortion with gossip-dealer persona | More immersive, character-consistent whispers |
| No role-aware tone | Aggressive for golare, conspiratorial for akta, trusted for hogra_hand | Different gameplay experience per role |
| Same intensity all game | Escalation: vague -> specific -> pointed over rounds 1-5 | Narrative arc within the game |

**What stays unchanged:**
- `WhisperResponseSchema` (zod): still returns `{ truth_level, message }` -- no schema changes
- `MODEL_MAP.whisper`: stays gpt-4o-mini -- no model change
- Whisper scheduling (13:00 and 19:00): unchanged
- Whisper target selection logic: unchanged
- Whisper persistence (createWhisper): unchanged
- Gap-fill commentary: unchanged (Phase 4's concern)
- Event-triggered whispers: same flow, just richer content

## Integration Points (Critical for Planning)

### Data Flow: Message Quotes

```
player_messages table
  -> getRecentPlayerMessages(gameId, targetId, 10)  [existing DB function]
  -> selectQuotesForWhisper(messages, 2)             [NEW helper]
  -> buildWhisperPrompt(..., targetQuotes, ...)      [MODIFIED prompt builder]
  -> AI generates paraphrased gossip                 [existing pipeline]
  -> sanitizeForTelegram()                           [existing]
  -> Telegram DM to player                           [existing]
```

### Data Flow: All-Player Overview

```
GuzmanContext.playerNotes  [populated by Phase 2 at round reveal]
  -> buildAllPlayerOverview(playerNotes, targetName)  [NEW helper]
  -> buildWhisperPrompt(..., allPlayerOverview, ...)  [MODIFIED prompt builder]
```

### Data Flow: Role Calibration

```
target.role  [from game_players table, already available in sendWhisper]
  -> getWhisperTone(role)                            [NEW mapping]
  -> buildWhisperPrompt(..., targetRole, ...)        [MODIFIED prompt builder]
  -> Prompt calibrates Guzman's tone                 [AI interpretation]
  -> Role NEVER appears in output text               [enforced by prompt rules]
```

### Function Signature Changes

```typescript
// ai-prompts.ts: buildWhisperPrompt
// OLD: (gameContext, targetPlayerName, otherPlayerNames, roundEvents)
// NEW: (gameContext, targetPlayerName, targetRole, otherPlayerNames,
//        roundEvents, targetQuotes, allPlayerOverview, roundNumber)

// ai-guzman.ts: generateWhisperMessage
// OLD: (gameContext, targetPlayerName, otherPlayerNames, roundEvents)
// NEW: (gameContext, targetPlayerName, targetRole, otherPlayerNames,
//        roundEvents, targetQuotes, allPlayerOverview, roundNumber)
```

### Files Modified and Why

| File | Change | Why |
|------|--------|-----|
| `src/lib/ai-prompts.ts` | Rewrite `buildWhisperPrompt()` | New params, gossip-dealer persona, escalation, role calibration (WHISP-01, WHISP-02, WHISP-03) |
| `src/lib/ai-guzman.ts` | Expand `generateWhisperMessage()` signature, add verbatim safety check | Pass-through new params, post-processing safety (WHISP-03) |
| `src/lib/behavioral-analysis.ts` | Add `selectQuotesForWhisper()`, `buildAllPlayerOverview()` | Data preparation helpers (WHISP-01, WHISP-02) |
| `src/handlers/whisper-handler.ts` | Expand `sendWhisper()` to gather quotes + overview + role | Data gathering at whisper time (orchestration) |

## Design Recommendations (Claude's Discretion Areas)

### Escalation Over Rounds: Yes, Recommended

**Recommendation:** Implement round-based escalation: vague (round 1-2) -> specific (round 3) -> pointed (round 4-5).

**Rationale:** This solves the thin-data problem naturally (early rounds have less data, so vagueness is appropriate). It also creates a narrative arc -- the paranoia builds over the game. Players feel the noose tightening. Early vagueness also means the AI can produce good whispers even with minimal behavioral data, since being vague requires less evidence.

### Thin Data Handling: Speculation + Atmosphere

**Recommendation:** When behavioral data is thin (early game, quiet players), the prompt should instruct Guzman to speculate and create atmosphere. "Jag har inte hort nagot fran dig... och det oroar mig." Silence itself becomes a talking point.

**Rationale:** The gossip-dealer persona handles thin data naturally -- gossip doesn't require evidence. "Mannen, folk har borjat prata om dig..." works even when nobody has actually said anything about the target. The key is that CONST-03 keeps behavioral data internal, so the player can never verify whether Guzman's gossip has real backing or not.

### Trust as Manipulation Tool: Yes, Include

**Recommendation:** Add trust/reassurance as a manipulation strategy alongside the existing truth/half_truth/lie framework. Guzman occasionally tells a player "du ar den enda jag litar pa" as a way to create information asymmetry and false security.

**Rationale:** This is a powerful social deduction mechanic. Players who receive "trust" from Guzman will be suspected by others who didn't receive it, or may let their guard down. It's within the gossip-dealer persona -- gossip dealers often create allies. Implementation: add it as a prompt instruction, not a new truth_level.

## Open Questions

1. **Should the verbatim quote check trigger a regeneration or silent strip?**
   - What we know: Post-processing can detect near-verbatim quotes. Regeneration adds latency and cost. Silent stripping might produce a broken message.
   - What's unclear: How often gpt-4o-mini will reproduce verbatim quotes despite instructions.
   - Recommendation: Log a warning and send the whisper anyway if the verbatim match is borderline (<8 words). Only regenerate (once) for clear verbatim matches (>8 consecutive words). In practice, with strong prompt instructions, this should rarely trigger.

2. **Token budget for the expanded whisper prompt: is it within CONST-02?**
   - What we know: Current whisper prompt is ~300 user tokens + ~400 system tokens. New prompt adds ~200-250 tokens (quotes + overview + calibration). Total: ~900-950 tokens.
   - What's unclear: Whether CONST-02's "2x baseline" applies per-call or across all AI calls.
   - Recommendation: The 2x baseline likely means the behavioral data addition (~500 extra tokens across all AI paths). The whisper prompt growth (~250 tokens) is well within that. Monitor actual token usage in early testing.

3. **Should `selectQuotesForWhisper` prefer messages from the current round or across all buffered messages?**
   - What we know: The ring buffer holds the last 10 messages per player per game (across all rounds). Current-round messages are the most relevant for "what just happened" gossip.
   - What's unclear: Whether cross-round messages add value or just noise.
   - Recommendation: Use all buffered messages but weight recency. The scoring function already gives recency bonus. This way, a dramatic round 1 quote can still surface in round 3 if it's the most interesting thing the player said.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `src/lib/ai-prompts.ts` (existing buildWhisperPrompt), `src/lib/ai-guzman.ts` (generateWhisperMessage and WhisperResponseSchema), `src/handlers/whisper-handler.ts` (sendWhisper flow), `src/lib/behavioral-analysis.ts` (existing analysis module), `src/db/client.ts` (getRecentPlayerMessages, getGuzmanContext), `src/db/types.ts` (GuzmanContext, PlayerMessage, PlayerRole)
- CONTEXT.md (Phase 3): locked decisions on paraphrasing, density, calibration, triggers
- REQUIREMENTS.md: WHISP-01, WHISP-02, WHISP-03, CONST-03
- PROJECT.md: key decisions on tiered models, template fallbacks, message queue

### Secondary (MEDIUM confidence)
- Phase 2 RESEARCH.md: behavioral analysis architecture, playerNotes format, token budget analysis -- all verified against implemented code
- OpenAI gpt-4o-mini prompt engineering patterns: instruction-following for paraphrasing, structured output with zod -- verified by existing working whisper implementation

### Tertiary (LOW confidence)
- None. All findings derived from direct codebase analysis and locked decisions.

## Metadata

**Confidence breakdown:**
- Architecture (data flow, integration points): HIGH -- all code paths verified, existing patterns extended
- Prompt engineering (gossip-dealer persona, escalation): MEDIUM -- prompt design is inherently experimental, needs gameplay testing to tune
- Token budget: HIGH -- arithmetic verified, well within CONST-02 based on existing implementation baseline
- Verbatim quote prevention: MEDIUM -- post-processing approach is sound, but LLM compliance rate with "don't quote" instructions varies and needs real testing
- Role calibration safety: HIGH -- same pattern used successfully by existing buildSpaningPrompt and buildSurveillanceCluePrompt

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days -- prompt engineering may need iterative tuning through playtesting but architecture is stable)
