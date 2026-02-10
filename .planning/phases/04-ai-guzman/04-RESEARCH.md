# Phase 4: AI Guzman - Research

**Researched:** 2026-02-10
**Domain:** OpenAI integration, AI persona/character generation, template fallback architecture
**Confidence:** HIGH

## Summary

Phase 4 transforms Guzman from static template strings into a living AI character. The core challenge is integrating OpenAI's API into an existing game loop that already dispatches all messages through a `MessageQueue` singleton, replacing static `MESSAGES.*` calls with AI-generated content while maintaining bulletproof fallback to the existing templates when OpenAI is unavailable.

The OpenAI Node.js SDK v6.x provides a clean TypeScript-first API with built-in retry logic, timeout handling, and structured output parsing via Zod. The recommended cost strategy is a tiered model approach: `gpt-4.1-nano` ($0.10/$0.40 per 1M tokens) for routine gap-fill commentary, and `gpt-4o-mini` ($0.15/$0.60 per 1M tokens) for mission narratives and dramatic reveals that need higher quality. Both models are extremely cheap -- a full 5-round game with all AI features would cost well under $0.01.

The existing codebase has a clean integration surface: every outbound message flows through `MESSAGES.*` constants/functions and `MessageQueue.send()`. The AI layer should sit between these -- an `aiGuzman` module that game-loop handlers call instead of `MESSAGES.*` directly, which internally attempts OpenAI generation and falls back to existing templates on any failure.

**Primary recommendation:** Create a single `src/lib/ai-guzman.ts` module that wraps OpenAI calls with try/catch fallback to existing MESSAGES templates. Use `gpt-4.1-nano` for routine messages and `gpt-4o-mini` for narratives. Store game narrative context in a `guzman_context` JSONB column on the `games` table for story arc continuity.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Personality:** Full orten suburb slang -- yalla, wallah, mannen, bror. Rosengard/Rinkeby register throughout. Manipulation style: both paranoia-stirring AND playing favorites. Drops hints that make everyone suspect each other, publicly praises/mocks specific players, creates social pressure. Occasionally breaks the fourth wall -- mostly in character but sometimes jokes about the game being a game. Light meta-humor, not constant.
- **Narrative style:** Full story narratives for mission briefings -- multiple paragraphs with character, setting, stakes. Continuous story arc across rounds -- Round 1's outcome affects Round 2's narrative. Serial storytelling throughout a game. Dramatic buildup for result reveals -- tension-building, teasing, hinting before dropping the outcome. Theatrical. Always references specific players by name -- "@Erik, du var tyst idag... intressant." Makes it personal and social.
- **Whisper behavior:** Dual trigger system: scheduled baseline whispers per round (1-2 players) PLUS bonus whispers triggered by game events (failed missions, close votes, suspicious patterns). Guzman sometimes lies -- mix of truth, half-truths, and outright lies. Players never know what to believe. Info scope: role-adjacent hints -- "Jag litar inte pa alla i det laget, bror." Directional hints about roles but never explicit role reveals. Voting pattern hints, behavioral observations.
- **Fallback experience:** In-character acknowledgment when AI is unavailable -- Guzman says something like "Orka snacka idag..." rather than silently swapping to templates.

### Claude's Discretion
- Whether Guzman's personality is consistent across games or varies by mood per game
- Whether whispers feel exclusive or sometimes hint that others got whispers too -- whatever creates the most drama per situation
- Number of template variants per message type (balance effort vs variety)
- Whether whispers use templates or are disabled during fallback
- Cost management strategy (budget caps, smart model routing, or hybrid)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | ^6.18.0 | OpenAI API client | Official SDK, TypeScript-first, built-in retries/timeouts |
| zod | ^3.24.0 | Schema validation for structured outputs | OpenAI SDK peer dependency for zodResponseFormat |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (existing) grammy | ^1.40.0 | Telegram bot framework | Already installed, no changes needed |
| (existing) @supabase/supabase-js | ^2.95.3 | Database persistence | Already installed, add guzman_context column |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| openai SDK direct | Vercel AI SDK (ai) | Adds abstraction layer; unnecessary for single-provider use case |
| zod | Manual JSON schema | Zod gives type inference + runtime validation in one step |
| Responses API | Chat Completions API | Responses API is newer but Chat Completions is simpler for this use case, widely documented, and supported indefinitely. No benefit from agentic primitives here |

**Installation:**
```bash
npm install openai zod
```

**Note:** `zod` is an optional peer dependency of the `openai` package -- it must be installed separately for structured output parsing.

## Architecture Patterns

### Recommended Module Structure
```
src/
  lib/
    ai-guzman.ts          # AI generation layer (the core new module)
    ai-prompts.ts          # System prompts and prompt builders
    ai-client.ts           # OpenAI client singleton + config
    messages.ts            # Existing templates (unchanged, used as fallback)
  handlers/
    game-loop.ts           # Modified: calls ai-guzman instead of MESSAGES directly
    whisper-handler.ts     # NEW: whisper scheduling + event triggers
```

### Pattern 1: AI-with-Fallback Wrapper
**What:** Every AI generation call wraps OpenAI in try/catch with template fallback.
**When to use:** Every single place Guzman speaks.
**Example:**
```typescript
// Source: Custom pattern based on OpenAI SDK error handling docs
import OpenAI from "openai";
import { MESSAGES } from "./messages.js";

const client = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
  timeout: 10_000,     // 10s timeout -- game can't wait forever
  maxRetries: 1,       // One retry, then fall back to template
});

export async function generateMissionNarrative(
  roundNumber: number,
  gameContext: GameNarrativeContext,
  playerNames: string[],
): Promise<string> {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        { role: "user", content: buildMissionPrompt(roundNumber, gameContext, playerNames) },
      ],
      max_tokens: 500,
      temperature: 0.9,  // High creativity for narrative variety
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");
    return content;
  } catch (err) {
    console.warn("[ai-guzman] Mission narrative failed, using template:", err);
    return MESSAGES.MISSION_POST(roundNumber);
  }
}
```

### Pattern 2: Game Narrative Context Accumulation
**What:** Store narrative state in DB so each round's AI generation builds on previous outcomes.
**When to use:** Mission narratives, result reveals, and any message that should reference game history.
**Example:**
```typescript
// JSONB column on games table
type GuzmanContext = {
  storyArc: string;           // Running narrative summary
  roundSummaries: Array<{
    round: number;
    missionTheme: string;     // e.g., "vapenaffar i Rosengard"
    outcome: "success" | "fail" | "kaos_fail";
    narrativeBeats: string;   // Key story points from this round
  }>;
  playerNotes: Record<string, string>;  // Per-player narrative threads
  mood: string;               // Current Guzman mood for consistency
};
```

### Pattern 3: Tiered Model Selection
**What:** Route requests to different models based on message importance.
**When to use:** Cost optimization without quality sacrifice.
**Example:**
```typescript
type MessageTier = "narrative" | "commentary" | "whisper";

const MODEL_MAP: Record<MessageTier, string> = {
  narrative: "gpt-4o-mini",    // Missions, reveals -- need quality
  commentary: "gpt-4.1-nano",  // Gap-fill, reactions -- speed + cheapness
  whisper: "gpt-4o-mini",      // Manipulation needs subtlety
};
```

### Pattern 4: Prompt with Game State Injection
**What:** System prompt defines persona; user message injects game-specific context.
**When to use:** Every AI call. Keeps the persona stable while varying the situational content.
**Example:**
```typescript
function buildGuzmanSystemPrompt(): string {
  return `Du ar Guzman -- ligaledaren. Du driver ett hemligt natverk i fororten.

PERSONLIGHET:
- Du pratar orten-slang: bre, shuno, wallah, yalla, mannen, para, beckna, guss
- Du ar paranoid men karismatisk. Du litar inte pa nagon fullt ut
- Du spelar folk mot varandra -- ibland berommer du nagon, ibland hotar du
- Du blandar humor med allvar. Ibland bryter du fjarde vaggen
- Du ar dramatisk som fan -- allt ar liv och dod for dig

STIL:
- Skriv pa svenska med orten-register. Aldrig formell svenska
- Anvand emojis sparsamt men effektfullt
- Namna spelare vid namn -- gor det personligt
- Bygg spanning och drama fore avslojanden
- Hal ihop en lopande story genom hela spelet

FORMAT:
- Anvand HTML-formatering: <b>fetstil</b> for viktig text
- Inga markdown -- bara HTML-taggar
- Hala texten kort nog for Telegram (max ~2000 tecken)`;
}
```

### Anti-Patterns to Avoid
- **Blocking game flow on AI:** Never await AI without a timeout + fallback. The game must never stall because OpenAI is slow or down.
- **Sending raw AI output without sanitization:** AI might generate markdown, special characters, or exceed Telegram message length limits. Always sanitize and truncate.
- **Storing full conversation history per call:** Token costs scale with context length. Use compressed summaries in guzman_context, not full message logs.
- **Calling AI for every single message:** Some messages (vote tally updates, keyboard confirmations) should stay as templates. Only narrative/character messages need AI.
- **Hardcoding model names:** Use a config map so models can be swapped without code changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI retries | Custom retry loop | SDK built-in `maxRetries` option | Handles exponential backoff, 429s, timeouts correctly |
| Token counting | Character-based estimation | Response `usage.total_tokens` from API response | Accurate per-call tracking from actual API response |
| JSON schema from TS types | Manual JSON schema | `zodResponseFormat` from `openai/helpers/zod` | Keeps schema + types in sync, auto-parsing |
| Rate limiting to OpenAI | Custom queue | SDK built-in rate limit handling + `maxRetries` | SDK already handles 429 with retry-after |
| HTML sanitization for Telegram | Regex stripping | grammY's `parse_mode: "HTML"` + simple tag allowlist | Telegram only supports a subset of HTML tags |

**Key insight:** The OpenAI Node.js SDK v6.x handles nearly all infrastructure concerns (retries, timeouts, rate limits) out of the box. The only custom code needed is the persona/prompt layer and the try/catch fallback pattern.

## Common Pitfalls

### Pitfall 1: AI Response Exceeds Telegram Message Limit
**What goes wrong:** Telegram messages have a 4096 character limit. AI generates longer text, sendMessage fails silently or throws.
**Why it happens:** max_tokens controls token count, not character count. Swedish text with special characters can be especially long.
**How to avoid:** Set `max_tokens` conservatively (400-600 for narratives) and add a truncation safety net before sending. Split into multiple messages if needed.
**Warning signs:** Messages failing to send, "message is too long" errors from Telegram API.

### Pitfall 2: AI Breaks HTML Formatting
**What goes wrong:** The AI generates invalid HTML tags, unclosed tags, or markdown instead of HTML, causing Telegram parse errors.
**Why it happens:** LLMs don't reliably follow formatting instructions 100% of the time, especially with creative prompts.
**How to avoid:** Strip all HTML tags except `<b>`, `<i>`, `<code>`, and `<a>` from AI output before sending. Add a sanitization step. Alternatively, send without parse_mode if sanitization fails.
**Warning signs:** "Can't parse entities" errors from Telegram API.

### Pitfall 3: Context Window Overflow Over Multiple Rounds
**What goes wrong:** As the game progresses through 5 rounds, the accumulated narrative context grows too large for the system prompt.
**Why it happens:** Each round adds story summary, player observations, etc. By round 5, context could be 2000+ tokens.
**How to avoid:** Keep `guzman_context` summaries compressed. Cap at ~500 tokens of context per call. Summarize older rounds more aggressively. gpt-4o-mini has 128k context but costs scale with input tokens.
**Warning signs:** Increasing latency and cost per call in later rounds.

### Pitfall 4: AI Reveals Role Information It Shouldn't Know
**What goes wrong:** Guzman's whispers accidentally reveal too much about player roles, or the AI "knows" who is Golare and leaks it.
**Why it happens:** If role information is included in the prompt context, the AI may reference it despite instructions not to.
**How to avoid:** Never include actual role assignments in whisper generation prompts. Only include observable information (voting patterns, team selections, mission results). The AI should generate role-adjacent hints based on behavioral data, not actual role knowledge.
**Warning signs:** Players consistently guessing correctly after whispers (indicates leakage).

### Pitfall 5: Inconsistent Guzman Personality Across Calls
**What goes wrong:** Each API call produces a slightly different "character" -- sometimes too formal, sometimes too crude, sometimes losing the orten register.
**Why it happens:** Each call is stateless. Without a strong system prompt and few-shot examples, the model drifts.
**How to avoid:** Use a detailed, prescriptive system prompt with 2-3 example outputs as few-shot demonstrations. Include specific slang vocabulary. Set temperature to 0.8-0.9 for creativity but not randomness. Store the "mood" in game context for consistency within a game.
**Warning signs:** Players noticing "Guzman sounds different today" in a bad way.

### Pitfall 6: Fallback Transition Feels Jarring
**What goes wrong:** Game switches from rich AI narratives to terse templates mid-game when API goes down. Players notice the quality cliff.
**Why it happens:** Existing templates in MESSAGES are functional but lack the personality depth of AI generation.
**How to avoid:** Enrich existing templates with more personality variants (3-5 per message type). Use the in-character "Orka snacka idag..." transition message. Have the fallback templates be "lazy Guzman" rather than "different person."
**Warning signs:** Player complaints about Guzman "changing personality" mid-game.

## Code Examples

Verified patterns from official sources:

### OpenAI Client Initialization
```typescript
// Source: https://github.com/openai/openai-node README
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 10_000,
  maxRetries: 1,
});
```

### Chat Completions with Error Handling
```typescript
// Source: https://github.com/openai/openai-node README
try {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 500,
    temperature: 0.9,
  });

  const content = completion.choices[0]?.message?.content;
  const usage = completion.usage; // { prompt_tokens, completion_tokens, total_tokens }

} catch (err) {
  if (err instanceof OpenAI.APIError) {
    console.error(`OpenAI API error: ${err.status} ${err.message}`);
    // Fall back to template
  }
}
```

### Structured Output with Zod (for whisper generation)
```typescript
// Source: openai-node helpers.md + structured outputs guide
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const WhisperSchema = z.object({
  targetPlayerName: z.string(),
  message: z.string().describe("The whisper message in Swedish orten slang"),
  truthLevel: z.enum(["truth", "half_truth", "lie"]),
  intent: z.enum(["paranoia", "false_evidence", "praise", "threat"]),
});

const completion = await client.chat.completions.parse({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: guzmanWhisperPrompt },
    { role: "user", content: whisperContextPrompt },
  ],
  response_format: zodResponseFormat(WhisperSchema, "whisper"),
  max_tokens: 300,
});

const whisper = completion.choices[0]?.message?.parsed;
if (whisper) {
  // whisper.message is typed string
  // whisper.truthLevel tells us if Guzman is lying
}
```

### Integration Point: Replacing MESSAGES.MISSION_POST in Scheduler
```typescript
// Before (current code in game-loop.ts line ~1413):
await queue.send(
  game.group_chat_id,
  MESSAGES.MISSION_POST(round.round_number),
  { parse_mode: "HTML" },
);

// After:
const missionText = await generateMissionNarrative(
  round.round_number,
  await getGuzmanContext(game.id),
  playerNames,
);
await queue.send(
  game.group_chat_id,
  missionText,
  { parse_mode: "HTML" },
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chat Completions API only | Responses API (new primary) | March 2025 | Chat Completions still fully supported, but Responses API recommended for new projects |
| `role: "system"` | `role: "developer"` (o-series) or `role: "system"` (GPT-series) | 2025 | Use `"system"` for GPT-4o-mini and GPT-4.1-nano (non-reasoning models) |
| GPT-4o-mini cheapest | GPT-4.1-nano now cheapest | April 2025 | $0.10/$0.40 vs $0.15/$0.60 per 1M tokens. Nano is faster and cheaper |
| `openai` v4.x | `openai` v6.x | 2025-2026 | Major version bump; API patterns evolved but chat.completions.create still works |
| Manual JSON schema | `zodResponseFormat` (SDK 4.55+) | Aug 2024 | Zod schemas auto-convert to JSON schema + parse responses |

**Deprecated/outdated:**
- Assistants API: being sunsetted August 2026. Do not use.
- `openai` v3.x: completely different API surface. All examples online from 2023 are outdated.
- JSON mode (`response_format: { type: "json_object" }`): Superseded by structured outputs which guarantee schema adherence.

## Cost Analysis

### Per-Game Estimate (5 rounds, 6 players)

| Message Type | Count/Game | Model | Est. Tokens/Call | Cost/Call | Total |
|-------------|-----------|-------|-----------------|----------|-------|
| Mission narrative | 5 | gpt-4o-mini | ~800 (in+out) | $0.0003 | $0.0015 |
| Result reveal | 5 | gpt-4o-mini | ~600 | $0.0002 | $0.001 |
| Whispers (baseline) | 10 | gpt-4o-mini | ~500 | $0.0002 | $0.002 |
| Whispers (event) | ~5 | gpt-4o-mini | ~500 | $0.0002 | $0.001 |
| Gap-fill commentary | ~15 | gpt-4.1-nano | ~300 | $0.00003 | $0.0005 |
| **TOTAL per game** | | | | | **~$0.006** |

At ~$0.006 per game, cost is negligible. Even 1000 games/month would be ~$6.

### Recommended Cost Management (Claude's Discretion)
Given the extremely low per-game cost, a simple approach is best:
1. **Log usage per game:** Track `completion.usage.total_tokens` per call, sum per game
2. **Monthly budget alert:** Set a soft cap (e.g., $10/month) with logging alert, not hard cutoff
3. **Model tiering:** Use nano for commentary, mini for narratives (already recommended)
4. **No hard budget cap needed** at this cost level -- just monitoring

## Discretion Recommendations

### Guzman Personality Consistency
**Recommendation:** Consistent base personality per game, with mood shifts based on game events. At game start, set an initial "mood" in guzman_context (e.g., "suspicious", "overconfident", "paranoid"). Mood evolves based on outcomes (mission failures make Guzman angrier, successes make him cocky). This creates natural variation between games while maintaining consistency within a game.

### Whisper Exclusivity Feel
**Recommendation:** Dynamic approach -- sometimes hint that others got whispers, sometimes don't. Specifically: when Guzman sends a truth, include "och jag har sagt samma sak till alla" (implies shared info, actually a lie about that). When sending a lie, keep it exclusive: "det har stannar mellan oss, bre." This maximizes paranoia because players can never be sure if info was shared.

### Template Variants
**Recommendation:** 3 variants per high-frequency message type (mission post, result reveal, round end, vote prompt). 1 variant for low-frequency messages (game win, sista chansen). This gives enough variety for fallback mode without excessive effort. All variants should be "lazy Guzman" style -- shorter, less elaborate, but still in character.

### Whispers During Fallback
**Recommendation:** Disable whispers during fallback. Whispers are deeply personalized manipulation -- template whispers would feel generic and break immersion. Better to have Guzman "go quiet" (in character) than send unconvincing template whispers. The gap-fill silence is itself a feature: "Guzman ar tyst idag... vad vet han som vi inte vet?"

## Database Changes Needed

### New Column: `games.guzman_context`
```sql
ALTER TABLE games ADD COLUMN guzman_context JSONB DEFAULT '{}';
```
Stores narrative state for story arc continuity across rounds.

### New Table: `whispers`
```sql
CREATE TABLE whispers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) NOT NULL,
  round_number INTEGER NOT NULL,
  target_player_id UUID REFERENCES game_players(id) NOT NULL,
  message TEXT NOT NULL,
  truth_level TEXT NOT NULL DEFAULT 'truth', -- truth, half_truth, lie
  trigger_type TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, event
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```
Tracks all whispers for game history and prevents duplicate sends.

## Open Questions

1. **Gap-fill message frequency tuning**
   - What we know: Gap-fill should react to group chat activity between fixed events
   - What's unclear: How to detect "silence" vs "active discussion" in a Telegram group. grammY can listen to all messages, but what's the threshold for "too quiet"?
   - Recommendation: Track message count per hour in-memory. If < 2 messages in 2 hours during active game hours (09:00-21:00), trigger a gap-fill. If > 10 messages in 30 min, trigger a "heated discussion" reaction. Start conservative and tune.

2. **Whisper scheduling mechanism**
   - What we know: Dual trigger -- scheduled baseline + event-triggered bonus
   - What's unclear: Whether to add new cron jobs or piggyback on existing scheduler ticks
   - Recommendation: Add one whisper cron job (e.g., 13:00 and 19:00) for baseline whispers. Event-triggered whispers fire inline during result reveal and vote resolution handlers. No new Croner dependency needed.

3. **HTML sanitization approach**
   - What we know: AI might generate invalid HTML; Telegram only supports `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a>`
   - What's unclear: Whether to use a library or simple regex
   - Recommendation: Simple regex strip -- remove all tags except the allowed set. AI output is short enough that regex is safe. No library needed.

## Sources

### Primary (HIGH confidence)
- [openai/openai-node GitHub](https://github.com/openai/openai-node) - SDK API patterns, error handling, structured outputs
- [openai-node/helpers.md](https://github.com/openai/openai-node/blob/master/helpers.md) - zodResponseFormat, parse(), streaming structured outputs
- [OpenAI Pricing](https://pricepertoken.com/pricing-page/provider/openai) - Current model pricing verified Feb 2026

### Secondary (MEDIUM confidence)
- [OpenAI Structured Outputs Guide](https://platform.openai.com/docs/guides/structured-outputs) - zodResponseFormat patterns and model compatibility
- [OpenAI Chat Completions API Reference](https://platform.openai.com/docs/api-reference/chat) - Message roles, parameters
- [OpenAI Responses API Migration](https://platform.openai.com/docs/guides/migrate-to-responses) - Responses vs Chat Completions status

### Tertiary (LOW confidence)
- Cost estimates are based on current pricing and typical token usage patterns -- actual costs may vary based on prompt length and output verbosity
- Gap-fill message frequency thresholds are untested estimates -- will need tuning in practice

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - OpenAI SDK is well-documented, pricing verified from multiple sources
- Architecture: HIGH - Integration surface in existing code is clearly understood; fallback pattern is straightforward
- Pitfalls: HIGH - Based on known Telegram API limitations and common LLM integration issues
- Cost estimates: MEDIUM - Based on token estimates, actual usage may vary
- Gap-fill/whisper scheduling: MEDIUM - Mechanism is sound but thresholds need tuning

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (OpenAI pricing and models can change; SDK is stable)
