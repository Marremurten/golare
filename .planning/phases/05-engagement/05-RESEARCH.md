# Phase 5: Engagement - Research

**Researched:** 2026-02-11
**Domain:** Telegram bot DM interactions, AI-driven game mechanics, async engagement patterns
**Confidence:** HIGH

## Summary

Phase 5 adds four distinct player-facing features (anonymous whispers, surveillance, Spaning investigation, anti-blowout scoring) plus a dramatic role reveal ceremony. The entire codebase is mature with 13 plans already executed -- patterns are well-established. All new features follow existing patterns: Composer-based callback handlers, MessageQueue for all outbound messages, Supabase for persistent state, and AI generation with template fallbacks.

The key technical challenge is not complexity but UX design: how players initiate whispers and surveillance via Telegram's constrained interface (DM commands vs inline buttons). The codebase already handles DM interactions extensively (role reveals, execution prompts, Sista Chansen), so the patterns are proven. The new features add DM-initiated freeform text handling (anonymous whispers) and new callback data patterns (surveillance, Spaning).

**Primary recommendation:** Use DM commands (`/viska`, `/spana`, `/spaning`) for player-initiated actions. This matches the existing command pattern (`/regler`, `/status`, `/avbryt`) and avoids cluttering group chat with inline buttons. Each action stores state in new Supabase tables and routes through existing MessageQueue and AI generation infrastructure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Unlimited whispers -- no per-round or per-window cap; let players whisper freely
- Players can send general whispers to the group OR target a specific player
- Guzman relays whispers with a cryptic hint about the sender's role (not identity) -- adds a deduction layer for the group to analyze
- Non-team players can surveil a team member for a cryptic clue
- Surveilled player is SOMETIMES notified ("Nagon har riktat blicken mot dig") -- random chance, creates risk/reward
- Each Akta player gets one Spaning per game -- ask Guzman about a player's role
- Guzman answers mostly truthfully (70-80% chance of truth, 20-30% chance of lie) -- creates doubt even after using it
- Hogra Hand's Spaning remains guaranteed truthful (already implemented in Phase 3)
- When someone uses Spaning, Guzman announces to the group that a Spaning happened (but not who used it or who was targeted) -- "Nagon har bett mig kolla runt..."
- Final rounds worth double points for comeback possibility
- One-by-one dramatic reveal -- Guzman reveals each player's role individually with dramatic flair
- Reveal order: Akta first, Golare last -- build suspense, save traitors for the finale

### Claude's Discretion
- Whisper initiation UX (DM command vs inline button)
- Surveillance clue type, frequency, and delivery method
- Akta Spaning presentation style and timing restrictions
- Double-point round math and interaction with win conditions
- Role reveal + Sista Chansen sequencing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | ^1.40.0 | Bot framework -- Composer, callbacks, DM handling | Already in use |
| @supabase/supabase-js | ^2.95.3 | Database -- new tables for whispers, surveillance, spaning | Already in use |
| openai | ^6.21.0 | AI generation for whisper relay, surveillance clues, Spaning answers | Already in use |
| zod | ^4.3.6 | Structured AI response parsing (already used for whisper schema) | Already in use |
| croner | ^10.0.1 | No new cron jobs needed -- existing scheduler sufficient | Already in use |

### Supporting (no new libraries needed)
This phase requires zero new dependencies. All features build on the existing stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DM commands for whisper initiation | grammY conversations plugin | Conversations adds complexity, session dependency, and statefulness that conflicts with database-first design. DM commands + freeform text listener is simpler |
| Inline buttons in group for whisper | DM commands | Inline buttons in group would reveal who's whispering. DMs maintain anonymity |
| Per-player rate limiting library | Simple in-memory Maps | No library needed -- rate limiting is per-game-per-player, tracked in DB |

## Architecture Patterns

### Recommended Project Structure (changes only)
```
src/
  handlers/
    engagement.ts       # New Composer: /viska, /spana, /spaning commands + callback handlers
  lib/
    ai-guzman.ts        # Extended: new AI generation functions for whisper relay, surveillance clues, Spaning
    ai-prompts.ts       # Extended: new prompt builders for engagement features
    messages.ts         # Extended: new template messages for all engagement features
    game-state.ts       # Extended: anti-blowout scoring logic (double points)
  db/
    types.ts            # Extended: new types for anonymous_whispers, surveillance, player_spanings
    client.ts           # Extended: new CRUD functions for engagement tables
```

### Pattern 1: DM Command Handler (for player-initiated actions)
**What:** Players initiate whispers, surveillance, and Spaning via DM commands to the bot
**When to use:** For all three player-initiated engagement actions
**Why:** Matches existing patterns (Composer chatType filter), maintains anonymity, no group chat clutter

```typescript
// Pattern from existing codebase: game-commands.ts
const engagementHandler = new Composer();

// DM-only commands using chatType filter
engagementHandler
  .chatType("private")
  .command("viska", async (ctx) => {
    // 1. Look up player and their active game
    // 2. Verify player is NOT on current team (non-team only)
    // 3. Present target options or accept general whisper
    // 4. Enter "awaiting whisper text" state
  });
```

### Pattern 2: Freeform Text Capture (for whisper message content)
**What:** After `/viska`, the bot waits for the player's next text message as the whisper content
**When to use:** When a player has initiated a whisper and needs to type their message
**Why:** Telegram bots can't prompt for input inline -- need a two-step flow

```typescript
// In-memory state tracking (same pattern as Sista Chansen)
type PendingWhisper = {
  gameId: string;
  playerId: string;
  target: "group" | string;  // "group" or specific game_player_id
  createdAt: number;
};

const pendingWhispers = new Map<number, PendingWhisper>(); // keyed by telegram_user_id

// Step 1: /viska command sets up pending state
// Step 2: Text message handler checks for pending whisper
engagementHandler
  .chatType("private")
  .on("message:text", async (ctx, next) => {
    const pending = pendingWhispers.get(ctx.from.id);
    if (!pending) {
      await next(); // Not a whisper -- pass through
      return;
    }
    // Process the whisper text, relay to group via Guzman
    pendingWhispers.delete(ctx.from.id);
  });
```

### Pattern 3: AI-Augmented Relay (for whisper messages)
**What:** Guzman relays anonymous whispers to the group, adding a cryptic hint about the sender's role
**When to use:** Every time a player whisper is relayed to the group
**Why:** Locked decision -- adds deduction layer

```typescript
// Extend existing AI generation pattern from ai-guzman.ts
export async function generateWhisperRelay(
  playerRole: PlayerRole,
  whisperText: string,
  gameContext: GuzmanContext,
): Promise<string> {
  // AI adds Guzman's "read" on the sender's role
  // Template fallback if AI unavailable
}
```

### Pattern 4: Probabilistic Mechanics (for surveillance notification and Spaning truthfulness)
**What:** Random chance determines whether surveillance target gets notified and whether Spaning answer is truthful
**When to use:** Surveillance (random notify) and Akta Spaning (70-80% truth)
**Why:** Core game design -- uncertainty creates paranoia

```typescript
// Use node:crypto randomInt for security-critical game mechanics
// (consistent with existing role assignment pattern)
import { randomInt } from "node:crypto";

const SURVEILLANCE_NOTIFY_CHANCE = 0.4; // 40% chance target is notified
const SPANING_TRUTH_CHANCE = 0.75;      // 75% chance of truthful answer

function shouldNotifySurveillance(): boolean {
  return randomInt(0, 100) < SURVEILLANCE_NOTIFY_CHANCE * 100;
}

function shouldSpaningBeTruthful(): boolean {
  return randomInt(0, 100) < SPANING_TRUTH_CHANCE * 100;
}
```

### Pattern 5: Enhanced Role Reveal (one-by-one with delays)
**What:** Replace existing batch FINAL_REVEAL with sequential per-player reveals
**When to use:** End of game, after Sista Chansen resolves
**Why:** Locked decision -- Akta first, Golare last for maximum drama

```typescript
// Modify existing performFinalReveal in game-loop.ts
// Use existing sleep() helper with delays between each reveal
// AI-generated individual reveal messages with Guzman commentary
for (const player of sortedPlayers) {
  const revealMsg = await generateRoleReveal(player, gameContext);
  await queue.send(groupChatId, revealMsg, { parse_mode: "HTML" });
  await sleep(suspenseDelay);
}
```

### Anti-Patterns to Avoid
- **Conversations plugin for simple two-step flows:** The existing codebase uses in-memory Maps for transient state (Sista Chansen pattern). Conversations plugin adds session dependency that conflicts with database-first design. Use the Map pattern.
- **Direct bot.api calls for group messages:** All outbound group messages MUST go through MessageQueue.send(). This is a hard rule established in Phase 1.
- **Storing transient DM state in Supabase:** Pending whisper input state is ephemeral (seconds, not hours). Use in-memory Maps like Sista Chansen does. Persist only completed actions.
- **Making engagement actions blocking:** Whisper relay, surveillance clues, and Spaning answers should never block the game loop. Use fire-and-forget for non-critical AI calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Whisper anonymity | Custom encryption/anonymization | Guzman relay pattern -- whisper goes through AI, never attributed to sender in group | Simpler, already has AI infra |
| Rate limiting whispers | Custom rate limiter | Unlimited per decision, but natural throttle via MessageQueue 3s spacing | Decision says unlimited |
| Spaning truth/lie logic | Complex trust system | Simple randomInt probability check (75% truth) | Decision specifies 70-80% range |
| Role reveal ordering | Complex sorting | Simple array sort: akta first, hogra_hand middle, golare last | Static ordering, no dynamic logic |
| Double-point scoring | Complex scoring engine | Modify existing checkWinCondition to check round number | 2-line change to existing function |

## Common Pitfalls

### Pitfall 1: Handler Registration Order
**What goes wrong:** The freeform text listener for whisper input catches ALL DM text messages, breaking /status, /regler, and other DM commands
**Why it happens:** grammY processes handlers in registration order. A broad `on("message:text")` handler registered early eats all messages
**How to avoid:** Register the engagement handler AFTER existing handlers in bot.ts. Inside the text handler, check if there's a pending whisper state -- if not, call `await next()` to pass through. The pending-state check acts as a guard.
**Warning signs:** Other DM commands stop working after adding the engagement handler

### Pitfall 2: Non-Team Player Verification
**What goes wrong:** Team members use whisper/surveillance actions that should be restricted to non-team players
**Why it happens:** Player eligibility depends on the current round's team_player_ids, which changes between rounds
**How to avoid:** Always fetch the current round and check team_player_ids at action time, never cache eligibility. Also consider: during what phases are these actions valid? (Between nomination and reveal -- not during lobby or finished)
**Warning signs:** Team members sending anonymous whispers about themselves

### Pitfall 3: Stale Pending Whisper State
**What goes wrong:** Player types /viska but never sends a message. Pending state sits in memory indefinitely. Hours later, they send an unrelated DM and it gets treated as a whisper.
**Why it happens:** No timeout on pending state
**How to avoid:** Add a TTL to pending whispers (e.g., 5 minutes). Clean up stale entries. Same pattern as Sista Chansen timeouts.
**Warning signs:** Random DM messages being relayed as anonymous whispers

### Pitfall 4: Spaning Already Used Check
**What goes wrong:** Player uses their one-per-game Spaning multiple times due to race conditions
**Why it happens:** Check-then-insert without atomicity
**How to avoid:** Use UNIQUE constraint on (game_id, player_id) in player_spanings table, same pattern as Sista Chansen's UNIQUE constraint on game_id. Catch unique violation error.
**Warning signs:** Multiple Spaning records for the same player in the same game

### Pitfall 5: Double-Point Scoring Edge Cases
**What goes wrong:** Double points cause a team to win with more than 3 points, breaking downstream logic that assumes max 3
**Why it happens:** checkWinCondition checks >= 3, which still works. But score display shows "4-2" which looks wrong.
**How to avoid:** Double points don't mean "2 points per win" -- they mean the round's outcome is worth 2 toward the score. Cap at 3 (first-to-3 means the winning point brings you TO 3, not above). Alternatively: keep it simple -- only double the LAST round (round 5), making it "if you were losing 2-1, a double-point win on round 5 gives you 3-2 comeback".
**Warning signs:** Scores above 3, games ending in unexpected states

### Pitfall 6: Role Reveal During Active Sista Chansen
**What goes wrong:** The new one-by-one role reveal is triggered before Sista Chansen resolves, spoiling the guess
**Why it happens:** performFinalReveal is called with wrong timing
**How to avoid:** The existing flow already handles this correctly -- performFinalReveal is called AFTER Sista Chansen resolves. The change is purely cosmetic: replace the batch FINAL_REVEAL message with sequential per-player messages inside the existing performFinalReveal function.
**Warning signs:** Roles revealed before Sista Chansen guess is made

## Code Examples

### DB Schema: New Tables

```sql
-- Anonymous whispers from players relayed through Guzman
CREATE TABLE anonymous_whispers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) NOT NULL,
  round_number INTEGER NOT NULL,
  sender_player_id UUID REFERENCES game_players(id) NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('group', 'player')),
  target_player_id UUID REFERENCES game_players(id), -- NULL for group whispers
  original_message TEXT NOT NULL,
  relayed_message TEXT NOT NULL, -- Guzman's version with role hint
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Surveillance actions
CREATE TABLE surveillance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) NOT NULL,
  round_number INTEGER NOT NULL,
  surveiller_player_id UUID REFERENCES game_players(id) NOT NULL,
  target_player_id UUID REFERENCES game_players(id) NOT NULL,
  clue_message TEXT NOT NULL,
  target_notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spaning (investigation) usage tracking
CREATE TABLE player_spanings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) NOT NULL,
  player_id UUID REFERENCES game_players(id) NOT NULL,
  target_player_id UUID REFERENCES game_players(id) NOT NULL,
  answer_truthful BOOLEAN NOT NULL,
  answer_message TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (game_id, player_id)  -- one per player per game
);
```

### Engagement Handler Structure

```typescript
// src/handlers/engagement.ts
import { Composer, InlineKeyboard } from "grammy";
import type { Context } from "grammy";

export const engagementHandler = new Composer();

// Transient state for pending whisper input
type PendingWhisper = {
  gameId: string;
  playerId: string;  // game_player_id
  target: "group" | string;
  createdAt: number;
};

const pendingWhispers = new Map<number, PendingWhisper>();

// TTL cleanup for stale pending whispers (5 minutes)
const WHISPER_PENDING_TTL_MS = 5 * 60 * 1000;

// /viska -- initiate anonymous whisper (DM only)
engagementHandler
  .chatType("private")
  .command("viska", async (ctx) => {
    // 1. Look up player's active game
    // 2. Verify game is active, player exists
    // 3. Verify player is NOT on current team
    // 4. Show target selection: "Till gruppen" or specific players
    // 5. Set pending state
  });

// Callback: whisper target selection
engagementHandler.callbackQuery(/^wt:(.+):(.+)$/, async (ctx) => {
  // wt:{gameId}:{target} where target = "group" or player index
  // Set pending state, prompt for message text
});

// Freeform text handler -- MUST be registered last
engagementHandler
  .chatType("private")
  .on("message:text", async (ctx, next) => {
    const pending = pendingWhispers.get(ctx.from.id);
    if (!pending) {
      await next(); // Not a whisper -- pass through
      return;
    }

    // Check TTL
    if (Date.now() - pending.createdAt > WHISPER_PENDING_TTL_MS) {
      pendingWhispers.delete(ctx.from.id);
      await ctx.reply("Tiden gick ut, bre. Kor /viska igen.");
      return;
    }

    // Process whisper: AI relay to group, store in DB
    pendingWhispers.delete(ctx.from.id);
    // ...
  });
```

### Anti-Blowout: Double-Point Logic

```typescript
// In game-state.ts -- extend checkWinCondition or add new function
/**
 * Calculate points awarded for a round, considering anti-blowout.
 * Rounds 4 and 5 are worth double points.
 */
export function getRoundPointValue(roundNumber: number): number {
  return roundNumber >= 4 ? 2 : 1;
}

// In resolveExecution (game-loop.ts) -- modify score update:
const pointValue = getRoundPointValue(round.round_number);
const newLiganScore = success
  ? Math.min(game.ligan_score + pointValue, 3) // Cap at 3
  : game.ligan_score;
const newAinaScore = success
  ? game.aina_score
  : Math.min(game.aina_score + pointValue, 3); // Cap at 3
```

### AI Prompt: Whisper Relay with Role Hint

```typescript
// In ai-prompts.ts
export function buildWhisperRelayPrompt(
  senderRole: PlayerRole,
  whisperText: string,
  gameContext: GuzmanContext,
): string {
  const roleHint = senderRole === "golare"
    ? "nagon som kanner lukten av para"
    : senderRole === "hogra_hand"
      ? "nagon med skarpa ogon"
      : "nagon fran familjen";

  return `Nagon skickade ett anonymt meddelande genom dig. Relay det till gruppen.

AVSANDARENS ROLL (HEMLIGT -- ge bara en KRYPTISK LEDTRAD, aldrig avsloja rollen):
- Avsandaren ar: ${senderRole}
- Din kryptiska beskrivning: "${roleHint}" (anpassa fritt, var kreativ)

ORIGINALMEDDELANDE:
"${whisperText}"

UPPGIFT:
1. Presentera meddelandet som att nagon viskade till dig
2. Lagg till en subtil, kryptisk ledtrad om avsandarens roll (INTE namn, INTE exakt roll)
3. Holl Guzman-ton: paranoid, dramatisk, orten-slang
4. Max 600 tecken. Anvand <b> och <i>.`;
}
```

### One-by-One Role Reveal

```typescript
// Replace existing FINAL_REVEAL batch message with sequential reveals
// In game-loop.ts performFinalReveal function

// Sort: akta first, hogra_hand middle, golare last
const sortOrder: Record<string, number> = {
  akta: 0,
  hogra_hand: 1,
  golare: 2,
};

const sortedPlayers = [...players].sort(
  (a, b) => (sortOrder[a.role ?? "akta"] ?? 0) - (sortOrder[b.role ?? "akta"] ?? 0)
);

// Intro message
await queue.send(groupChatId, "<b>ROLLERNA AVSLOJAS</b>\n\nEn i taget...", {
  parse_mode: "HTML",
});
await sleep(suspenseDelay);

// Reveal each player one by one
for (const player of sortedPlayers) {
  const emoji = player.role === "golare" ? "rat" : player.role === "hogra_hand" ? "mag" : "person";
  const roleName = player.role === "golare" ? "GOLARE"
    : player.role === "hogra_hand" ? "Guzmans Hogra Hand"
    : "Akta";

  // Try AI-generated individual reveal, fall back to template
  let revealMsg: string;
  try {
    revealMsg = await generateIndividualReveal(player, gameContext);
  } catch {
    revealMsg = `<b>${displayName(player.players)}</b> -- ${roleName}`;
  }

  await queue.send(groupChatId, revealMsg, { parse_mode: "HTML" });
  await sleep(suspenseDelay);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Batch role reveal (FINAL_REVEAL template) | One-by-one sequential reveal | Phase 5 | More dramatic, builds suspense |
| Flat scoring (1 point per round) | Double points in rounds 4-5 | Phase 5 | Enables comebacks, more exciting endgame |
| Only Hogra Hand has Spaning | All Akta players get one (unreliable) Spaning | Phase 5 | More engagement for non-team players |
| Non-team players are passive | Whispers + surveillance give everyone actions | Phase 5 | Core engagement feature |

## Design Decisions (Claude's Discretion)

### Whisper Initiation: DM Command `/viska`
**Recommendation:** Use `/viska` as DM command. Two-step flow:
1. `/viska` shows inline buttons: "Till gruppen" or list of player names
2. After target selection, bot prompts "Skriv ditt meddelande"
3. Next text message is captured as the whisper content

**Why:** Keeps anonymity (group doesn't see who typed /viska), uses familiar DM command pattern, no complex conversation state.

### Surveillance: Once Per Round, Clue to Surveiller's DM
**Recommendation:**
- **Frequency:** Once per round per player (not once per game -- too restrictive for 5 rounds)
- **Clue type:** Mixed -- Guzman gives a vague clue based on the target's ACTIONS this round, not their role directly. E.g., "Den dar killen... han tvekade nar han rostade. Tveka ar farligt, bre."
- **Delivery:** Clue goes to surveiller's DM (not group) -- keeps it private, the player decides whether to share
- **Notification chance:** 40% chance the target gets notified ("Nagon har riktat blicken mot dig...")

**Why:** Per-round keeps engagement high every day. DM delivery is more strategic (player can share selectively). 40% notification creates meaningful risk without being guaranteed.

### Spaning Presentation: Cryptic vs Clear
**Recommendation:**
- **Akta Spaning:** Cryptic, unreliable -- Guzman answers in character with hedging. "Hmm... den dar personen... jag far en kansla av... lojalitet. Men kanslan kan ljuga, bre." (75% chance this is truthful)
- **Hogra Hand Spaning:** Clear and direct (already implemented) -- "Den dar personen ar [ROLL]. Punkt."
- **Timing:** Spaning can be used anytime during an active game. No phase restrictions -- it's a once-per-game ability, so restricting timing adds unnecessary friction.
- **Group notification:** When any Spaning is used, Guzman posts to group: "Nagon har bett mig kolla runt... intressant. Mycket intressant."

### Double-Point Math
**Recommendation:** Rounds 4 and 5 are worth 2 points each. Score is capped at 3 (first-to-3). This means:
- If you're losing 0-2 after round 3, winning rounds 4 AND 5 gives you 4 points (capped to 3) -- comeback to 3-2 win
- If you're losing 1-2 after round 3, winning round 4 gives you 3-2 -- immediate comeback
- The math interacts cleanly with first-to-3: the cap prevents scores above 3

This is the simplest approach that achieves the goal (comebacks possible) without changing the existing win condition logic (`>= 3` check).

### Role Reveal + Sista Chansen Sequencing
**Recommendation:**
1. Win announced (existing: GAME_WON_LIGAN/AINA)
2. Sista Chansen initiated (existing flow -- 2-hour timeout for guess)
3. Sista Chansen resolved (correct/wrong/timeout)
4. Dramatic pause (existing suspense delays)
5. **NEW:** One-by-one role reveal (Akta first, Hogra Hand middle, Golare last)
6. Game set to finished

This replaces step 4 (batch FINAL_REVEAL) in the existing `performFinalReveal` function. The Sista Chansen flow is UNCHANGED -- only the final reveal presentation changes.

## Open Questions

1. **Should whisper actions be available during ALL active game phases?**
   - What we know: Non-team players need engagement. "Non-team" only applies during execution/voting phases.
   - What's unclear: Can players whisper during nomination? During the gap between rounds? During Sista Chansen?
   - Recommendation: Allow whispers during any active game round (phases: mission_posted through reveal). Disable during lobby, Sista Chansen, and after game ends. This maximizes engagement without interfering with critical game moments.

2. **How to handle Hogra Hand's existing Spaning vs new Akta Spaning in same handler?**
   - What we know: Hogra Hand already has Spaning mentioned in role reveal but NO handler implemented yet (Phase 3 created the role reveal text, but no /spaning command exists)
   - What's unclear: Whether the original Hogra Hand Spaning was meant to be implemented in Phase 3 or deferred
   - Recommendation: Implement BOTH in Phase 5. Single `/spaning` command checks player's role: Hogra Hand gets guaranteed truth, Akta gets 75% truth. Different AI presentation for each.

3. **Should surveillance be restricted to non-team players only?**
   - What we know: CONTEXT.md says "non-team players can surveil a team member"
   - What's unclear: What about rounds with kaos-fail (no team was selected)?
   - Recommendation: Surveillance requires an active team to target. During kaos-fail rounds, surveillance is unavailable. This is fine -- kaos-fail rounds are chaotic enough.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: all 20 TypeScript source files read and analyzed
- `.planning/STATE.md` -- accumulated decisions and patterns
- `.planning/ROADMAP.md` -- phase descriptions and requirements
- `.planning/REQUIREMENTS.md` -- ENGAGE-01 through ENGAGE-05
- `.planning/phases/05-engagement/05-CONTEXT.md` -- locked decisions and discretion areas

### Secondary (MEDIUM confidence)
- [grammY official docs -- filter queries](https://grammy.dev/guide/filter-queries) -- chatType("private") pattern for DM commands
- [grammY official docs -- basics](https://grammy.dev/guide/basics) -- message text handling
- [grammY conversations plugin](https://grammy.dev/plugins/conversations) -- evaluated and rejected (conflicts with database-first design)

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing patterns
- Architecture: HIGH -- extends proven codebase patterns (Composer, MessageQueue, AI generation)
- Pitfalls: HIGH -- identified from actual codebase analysis (handler order, state management, race conditions)
- Discretion decisions: MEDIUM -- game design choices based on balancing analysis, not empirically validated

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (stable -- no external dependency changes)
