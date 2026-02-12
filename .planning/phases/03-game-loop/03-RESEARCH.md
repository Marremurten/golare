# Phase 3: Game Loop - Research

**Researched:** 2026-02-10
**Domain:** Game state machine, scheduled events, Telegram inline keyboard interactions, database-driven round tracking
**Confidence:** HIGH

## Summary

Phase 3 implements the complete 5-round daily game cycle for an Avalon-inspired social deduction game running on Telegram. The core technical challenge is a database-driven state machine that transitions through daily phases (mission posting, Capo nomination, team voting, secret execution, result reveal) on an automated schedule, with all state persisted in Supabase so the game survives bot restarts.

The implementation requires three main subsystems: (1) a scheduler that fires events at fixed daily times (09:00, 12:00, 15:00, 18:00, 21:00) with restart recovery, (2) a state machine that manages round/phase transitions with edge cases like failed votes, Kaos-mataren auto-fail, and the Sista Chansen endgame, and (3) interactive Telegram inline keyboard flows for nomination, voting, and mission execution.

**Primary recommendation:** Use Croner (v10, zero-dependency) for cron scheduling with database-backed game phase state for restart recovery. Implement a custom FSM as a pure function that takes current state + event and returns next state, with all transitions persisted to Supabase. All keyboard interactions use the established callback data pattern (`action:uuid`) with editMessageText for live updates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Capo doesn't nominate before deadline: bot sends reminder 1h before; if still no nomination, rotates to next player and counts as a failed vote (Kaos-mataren +1)
- Missing votes at deadline: count as abstain (only cast votes determine outcome, majority of actual votes decides)
- Team member doesn't choose [Sakra]/[Gola] before deadline: defaults to Sakra (assumes loyalty)
- Reminders sent both via DM to the player who needs to act AND a group chat reminder, 1h before each deadline
- Capo selects team via inline buttons in group chat -- bot shows player list as toggleable buttons, Capo taps to select/deselect, then confirms
- Capo CAN include themselves on the team (standard Avalon-style)
- Rotation follows join order -- predictable and fair, players can anticipate who's next
- Nomination happens publicly in group chat -- everyone sees the deliberation, creates social pressure
- JA/NEJ votes are secret during voting, then ALL votes revealed at once after deadline (who voted what). Maximum drama.
- Live tally shows WHO has voted (but not what): "Rostat: 4/7" with names checked off. Encourages stragglers.
- Mission results show pass/fail + sabotage count: "Uppdraget misslyckades. 2 golare saboterade." Players know how many betrayed, not who.
- Kaos-mataren displayed through Guzman's escalating tone -- no explicit visual counter
- Guessing team gets a group DM discussion period -- collaborative deliberation before the vote
- 2-hour window for discussion and voting -- enough time to deliberate seriously
- Guess presented as inline buttons with all player names (same UX pattern as other votes)
- Symmetrisk: Ligan wins -> Golare guess Hogra Hand; Golare wins -> Akta guess one Golare
- Final reveal is delayed and dramatic -- Guzman builds suspense with a message sequence before showing the result (30-60 second pacing)

### Claude's Discretion
- Exact scheduling implementation (cron, setTimeout, external scheduler)
- Template message copy and tone (within Guzman's established persona)
- State machine design and phase transition logic
- Database schema for rounds, votes, and mission results
- How the "group DM discussion" for Sista Chansen is technically implemented (could be a temporary group or sequential DMs)
- Exact reminder message timing and frequency

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| croner | 10.x | Cron scheduling at fixed daily times | Zero dependencies, ESM-native, TypeScript support, timezone-aware, used by PM2/Uptime Kuma. Actively maintained (10.0.1 released Feb 2025) |
| grammy | 1.40.x | (existing) Telegram bot framework | Already in project, InlineKeyboard + callbackQuery cover all UX needs |
| @supabase/supabase-js | 2.95.x | (existing) Database client | Already in project, handles all state persistence |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @grammyjs/auto-retry | 2.x | (existing) Telegram API retry | Already handles 429 errors on message edits |
| @grammyjs/transformer-throttler | 1.x | (existing) API throttling | Already rate-limits outbound calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Croner | node-cron | node-cron is more popular (40M weekly downloads) but has dependencies and no timezone option. Croner is zero-dep, ESM-native, timezone-aware |
| Croner | node-schedule | node-schedule supports Date objects but is less actively maintained and heavier |
| Croner | setTimeout chains | Works but messy, no cron expression support, harder to reason about restart recovery |

**Installation:**
```bash
npm install croner
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── bot.ts                    # (existing) Bot setup, add game loop handler
├── config.ts                 # (existing) Add TIMEZONE config
├── db/
│   ├── client.ts             # (existing) Add round/vote/mission CRUD
│   ├── types.ts              # (existing) Add Round, Vote, MissionAction types
│   └── schema.sql            # (existing) Add rounds, votes, mission_actions tables
├── handlers/
│   ├── start.ts              # (existing)
│   ├── lobby.ts              # (existing)
│   ├── game-commands.ts      # (existing)
│   ├── dm-flow.ts            # (existing)
│   └── game-loop.ts          # NEW: all game loop callback handlers
├── lib/
│   ├── messages.ts           # (existing) Add game loop templates
│   ├── errors.ts             # (existing) Add game loop error variants
│   ├── roles.ts              # (existing)
│   ├── game-state.ts         # NEW: FSM logic (pure functions)
│   └── scheduler.ts          # NEW: Croner-based event scheduler
└── queue/
    └── message-queue.ts      # (existing)
```

### Pattern 1: Database-Driven State Machine
**What:** A pure-function FSM where the current phase is stored in a `rounds` table column, and transitions are computed by a function that takes `(currentPhase, event) => nextPhase`. The database is the source of truth; in-memory state is always loaded fresh.
**When to use:** Every phase transition -- mission post, nomination, voting, execution, reveal.

**Game phases (per round):**
```
mission_posted -> nomination -> voting -> execution -> reveal -> (next round or game_end)
```

**Additional edge-case phases:**
```
vote_failed (NEJ majority) -> rotates Capo, back to nomination
kaos_fail (3rd consecutive NEJ) -> auto-fail, to reveal
sista_chansen -> guess -> final_reveal -> game_end
```

**Example:**
```typescript
// src/lib/game-state.ts
// Source: Custom FSM design (project decision: no XState)

type RoundPhase =
  | "mission_posted"
  | "nomination"
  | "voting"
  | "execution"
  | "reveal";

type GamePhase =
  | "round_active"     // Normal round in progress
  | "sista_chansen"    // Endgame guessing phase
  | "finished";        // Game over

type PhaseEvent =
  | "schedule_mission"     // 09:00 trigger
  | "schedule_nomination"  // 12:00 trigger
  | "nomination_submitted" // Capo confirmed team
  | "schedule_voting"      // 15:00 trigger
  | "vote_approved"        // JA majority
  | "vote_rejected"        // NEJ majority
  | "kaos_triggered"       // 3rd consecutive NEJ
  | "schedule_execution"   // 18:00 trigger
  | "schedule_reveal"      // 21:00 trigger
  | "reveal_complete"      // Round done, check win
  | "game_won"             // Side reached 3 wins
  | "sista_chansen_guess"  // Guess submitted
  | "nomination_timeout";  // Capo didn't nominate

function nextRoundPhase(current: RoundPhase, event: PhaseEvent): RoundPhase {
  // Pure function -- no side effects, easy to test
  switch (current) {
    case "mission_posted":
      if (event === "schedule_nomination") return "nomination";
      break;
    case "nomination":
      if (event === "nomination_submitted") return "voting";
      if (event === "nomination_timeout") return "nomination"; // rotate Capo
      break;
    case "voting":
      if (event === "vote_approved") return "execution";
      if (event === "vote_rejected") return "nomination"; // rotate Capo
      if (event === "kaos_triggered") return "reveal"; // auto-fail
      break;
    case "execution":
      if (event === "schedule_reveal") return "reveal";
      break;
    case "reveal":
      if (event === "reveal_complete") return "mission_posted"; // next round
      break;
  }
  return current; // No valid transition -- stay in current phase
}
```

### Pattern 2: Restart-Safe Scheduler
**What:** Croner handles the daily cron schedule (09:00, 12:00, etc.), but the actual game state lives in the database. On bot restart, Croner jobs are re-registered. Each cron tick checks the database for active games that need processing at this time, rather than relying on in-memory state.
**When to use:** All scheduled events.

```typescript
// src/lib/scheduler.ts
import { Cron } from "croner";

const TIMEZONE = "Europe/Stockholm";

// These jobs run for ALL active games -- not per-game
const jobs: Cron[] = [];

export function startScheduler(handlers: ScheduleHandlers): void {
  jobs.push(
    new Cron("0 9 * * 1-5", { timezone: TIMEZONE }, handlers.onMissionPost),
    new Cron("0 11 * * 1-5", { timezone: TIMEZONE }, handlers.onNominationReminder), // 1h before
    new Cron("0 12 * * 1-5", { timezone: TIMEZONE }, handlers.onNominationDeadline),
    new Cron("0 14 * * 1-5", { timezone: TIMEZONE }, handlers.onVotingReminder),    // 1h before
    new Cron("0 15 * * 1-5", { timezone: TIMEZONE }, handlers.onVotingDeadline),
    new Cron("0 17 * * 1-5", { timezone: TIMEZONE }, handlers.onExecutionReminder), // 1h before
    new Cron("0 18 * * 1-5", { timezone: TIMEZONE }, handlers.onExecutionDeadline),
    new Cron("0 21 * * 1-5", { timezone: TIMEZONE }, handlers.onResultReveal),
  );
}

export function stopScheduler(): void {
  for (const job of jobs) job.stop();
  jobs.length = 0;
}
```

**Restart recovery pattern:**
```typescript
// On bot startup, after scheduler starts:
// 1. Query all games with state='active'
// 2. Check current time vs. round phase
// 3. If a scheduled event was missed (e.g., bot was down at 09:00),
//    execute it immediately
// This is simple because the DB stores the expected phase --
// if it's still "reveal" from yesterday and it's now 09:01,
// we know the mission_post was missed.
```

### Pattern 3: Toggleable Inline Keyboard for Capo Nomination
**What:** Capo selects team members by tapping player name buttons that toggle on/off. The message is re-edited on each tap to show the current selection. A "Bekrafta" (confirm) button finalizes.
**When to use:** Capo nomination phase.

```typescript
// Callback data format: nom_t:{roundId}:{playerId} (toggle)
//                        nom_c:{roundId} (confirm)
// All within 64-byte limit since UUIDs are 36 chars

function buildNominationKeyboard(
  roundId: string,
  players: Array<{ id: string; name: string }>,
  selected: Set<string>,
  teamSize: number,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const player of players) {
    const isSelected = selected.has(player.id);
    const label = isSelected ? `[x] ${player.name}` : `[ ] ${player.name}`;
    kb.text(label, `nom_t:${roundId}:${player.id}`).row();
  }
  if (selected.size === teamSize) {
    kb.text("Bekrafta team!", `nom_c:${roundId}`);
  }
  return kb;
}
```

**Important:** Callback data `nom_t:{roundId}:{playerId}` could exceed 64 bytes if both IDs are full UUIDs (36+36+6 = 78 bytes). Solution: use a short round sequence number instead of UUID in callback data, or truncate the player ID. Since rounds are per-game and numbered 1-5, and player index is 0-9, we can use compact formats like `nom_t:1:3` (toggle player index 3 in round 1) and resolve against the database. This keeps callback data well under 64 bytes.

### Pattern 4: Secret Vote with Live Tally
**What:** Players vote JA/NEJ via inline buttons in group chat. The message shows who has voted but not how. After all votes are in (or deadline), the message is edited one final time to reveal all votes.
**When to use:** Team voting phase (LOOP-03).

```typescript
// Callback data: vote:{roundId}:ja or vote:{roundId}:nej
// Use compact round number, not UUID

function buildVoteTallyText(
  voted: string[],    // names of players who have voted
  total: number,      // total players
): string {
  const voterList = voted.map(n => `  [x] ${n}`).join("\n");
  return (
    `Rostat: ${voted.length}/${total}\n\n` +
    voterList
  );
}

// On vote callback: save vote to DB, edit message with updated tally
// On deadline: query all votes, build reveal message, edit final time
```

### Pattern 5: Private Mission Execution via DM
**What:** After a team is approved, each team member receives a DM with [Sakra] and [Gola] buttons. Their choice is saved to DB. After all team members have chosen (or deadline), results are computed.
**When to use:** Mission execution phase (LOOP-04).

```typescript
// Callback data: exec:{roundId}:s (Sakra) or exec:{roundId}:g (Gola)
// Sent as DM to each team member via MessageQueue

function buildExecutionKeyboard(roundId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("Sakra uppdraget", `exec:${roundId}:s`)
    .text("Gola!", `exec:${roundId}:g`);
}
```

### Anti-Patterns to Avoid
- **In-memory game state:** Never store round/vote state only in memory. The bot WILL restart. Always read from and write to Supabase.
- **Per-game cron jobs:** Don't create individual Croner jobs per active game. Instead, have global time-based jobs that query ALL active games and process them. This avoids memory leaks and simplifies restart.
- **Direct bot.api calls:** All outbound messages must go through MessageQueue.send() (established project pattern).
- **Full UUIDs in callback data:** Telegram's 64-byte limit means callback data must be compact. Use short identifiers (round number 1-5, player index 0-9) and resolve against DB.
- **Blocking on editMessageText:** The "message is not modified" error is benign when multiple users click fast. Always catch and ignore it (established pattern in lobby.ts).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setTimeout chains with manual time math | Croner with cron expressions | Timezone handling, DST transitions, restart-safe patterns are deceptively complex |
| Rate limiting | Manual delay logic for Telegram API | Existing MessageQueue + auto-retry plugin | Already battle-tested in Phases 1-2 |
| Inline keyboard building | Raw Telegram API JSON structures | grammY InlineKeyboard class | Builder pattern handles rows, limits, and serialization |
| Shuffle/random | Math.random for any game-critical randomness | node:crypto randomInt (already in roles.ts) | Cryptographic randomness for fair selection |

**Key insight:** The scheduling layer is the biggest risk. Don't try to build a perfect distributed job queue -- Croner + database state + restart recovery is simple and sufficient for a single-process bot.

## Common Pitfalls

### Pitfall 1: Callback Data Exceeding 64 Bytes
**What goes wrong:** Using full UUIDs in callback data like `nominate:{uuid}:{uuid}` creates strings over 64 bytes, which Telegram silently truncates or rejects.
**Why it happens:** Developers forget the 64-byte limit when designing callback data formats.
**How to avoid:** Use compact identifiers. Round numbers are 1-5, player indices are 0-9. Store the mapping context (which game, which round) server-side and resolve from the callback handler. Format: `nom_t:1:3` (7 bytes), `vote:2:ja` (9 bytes), `exec:3:g` (8 bytes).
**Warning signs:** Callback query handlers never fire, or `ctx.match` returns unexpected values.

### Pitfall 2: Race Conditions on Concurrent Votes
**What goes wrong:** Two players vote simultaneously. Both read "3 votes cast," both write "4 votes cast." One vote is lost.
**Why it happens:** Read-then-write without atomicity.
**How to avoid:** Use Supabase INSERT for each vote (not UPDATE of a counter). Use UNIQUE constraint on `(round_id, player_id)` to prevent double-voting. Count votes with a SELECT COUNT query, not a stored counter.
**Warning signs:** Vote counts don't match number of voters, or duplicate vote errors.

### Pitfall 3: Scheduler Drift Across DST Changes
**What goes wrong:** Bot schedules events at 09:00 CET but after DST switch they fire at 08:00 or 10:00.
**Why it happens:** Using UTC offsets instead of timezone names.
**How to avoid:** Always use IANA timezone names (`Europe/Stockholm`) with Croner's `timezone` option. Never use fixed UTC offsets.
**Warning signs:** Events fire at wrong times in spring/autumn.

### Pitfall 4: Editing Messages After They're Too Old
**What goes wrong:** Bot tries to editMessageText on a message sent hours ago, Telegram returns error.
**Why it happens:** Telegram limits editing of messages that are too old (48 hours for inline keyboards, but can be flaky).
**How to avoid:** For deadline-triggered updates (e.g., revealing votes), send a NEW message with the results rather than editing the original vote message. Or edit immediately and have a fallback to send new if edit fails.
**Warning signs:** `GrammyError: Bad Request: message can't be edited` errors in logs.

### Pitfall 5: Kaos-mataren Counter Reset
**What goes wrong:** Consecutive NEJ counter is tracked per-game instead of per-round, or resets incorrectly after a successful vote.
**Why it happens:** Ambiguous counter semantics.
**How to avoid:** Store `consecutive_failed_votes` on the `rounds` table row. Reset to 0 when a vote passes (JA majority). Increment on NEJ. When it hits 3, trigger auto-fail. The counter resets per round because it tracks consecutive failures within the same mission/round.
**Warning signs:** Kaos-mataren triggers after non-consecutive failures, or never triggers.

### Pitfall 6: Sista Chansen Assumes Both Sides Know Roles
**What goes wrong:** Implementing Sista Chansen without considering that the guessing team needs to deliberate privately.
**Why it happens:** Forgetting that the guess is collaborative, not individual.
**How to avoid:** Use DMs to each member of the guessing team. Send the player list as inline buttons to each guesser. First to vote locks in the guess (or use majority if multiple guessers). The "group DM discussion" from CONTEXT.md can be implemented as sequential DMs to each team member with a shared inline keyboard vote.
**Warning signs:** Sista Chansen guess reveals information to the wrong team.

## Database Schema Design

### New Tables Needed

```sql
-- Rounds table: one row per round in a game (5 rounds max)
CREATE TABLE IF NOT EXISTS rounds (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                  UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number             INT NOT NULL,            -- 1-5
  phase                    TEXT NOT NULL DEFAULT 'mission_posted',
  capo_player_id           UUID REFERENCES game_players(id),
  team_player_ids          UUID[] DEFAULT '{}',     -- selected team member IDs
  consecutive_failed_votes INT NOT NULL DEFAULT 0,  -- Kaos-mataren counter
  mission_result           TEXT,                     -- 'success', 'fail', 'kaos_fail', null
  ligan_point              BOOLEAN,                  -- true = Ligan scored, false = Aina scored
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_round_per_game UNIQUE (game_id, round_number),
  CONSTRAINT valid_round_number CHECK (round_number BETWEEN 1 AND 5),
  CONSTRAINT valid_phase CHECK (phase IN (
    'mission_posted', 'nomination', 'voting', 'execution', 'reveal'
  ))
);

-- Votes table: team approval votes (JA/NEJ) per round
CREATE TABLE IF NOT EXISTS votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  game_player_id  UUID NOT NULL REFERENCES game_players(id),
  vote            TEXT NOT NULL,  -- 'ja' or 'nej'
  voted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_vote_per_round UNIQUE (round_id, game_player_id),
  CONSTRAINT valid_vote CHECK (vote IN ('ja', 'nej'))
);

-- Mission actions: secret [Sakra] or [Gola] choices by team members
CREATE TABLE IF NOT EXISTS mission_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  game_player_id  UUID NOT NULL REFERENCES game_players(id),
  action          TEXT NOT NULL,  -- 'sakra' or 'gola'
  acted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_action_per_round UNIQUE (round_id, game_player_id),
  CONSTRAINT valid_action CHECK (action IN ('sakra', 'gola'))
);

-- Sista Chansen guesses
CREATE TABLE IF NOT EXISTS sista_chansen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  guessing_side   TEXT NOT NULL,   -- 'golare' or 'akta'
  target_player_id UUID NOT NULL REFERENCES game_players(id),
  guessed_by_id   UUID NOT NULL REFERENCES game_players(id),
  correct         BOOLEAN,
  guessed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Existing Table Modifications

The `games` table already has `round`, `ligan_score`, `aina_score`, `team_size`, and `state` columns. These are sufficient. The `state` column values need to expand:

```typescript
// Current GameState
type GameState = "lobby" | "active" | "finished" | "cancelled";

// Phase 3 needs no change to GameState -- "active" covers the entire game loop.
// The detailed phase tracking is on the rounds table.
// When game ends: update to "finished".
```

The `game_players` table needs a `join_order` column for Capo rotation:

```sql
ALTER TABLE game_players ADD COLUMN join_order INT;
```

This is set at game start time based on the order players appear in `getGamePlayers` (sorted by `joined_at`).

### TypeScript Types

```typescript
// New types for Phase 3
type RoundPhase = "mission_posted" | "nomination" | "voting" | "execution" | "reveal";
type VoteChoice = "ja" | "nej";
type MissionAction = "sakra" | "gola";
type MissionResult = "success" | "fail" | "kaos_fail";

type Round = {
  id: string;
  game_id: string;
  round_number: number;
  phase: RoundPhase;
  capo_player_id: string | null;
  team_player_ids: string[];
  consecutive_failed_votes: number;
  mission_result: MissionResult | null;
  ligan_point: boolean | null;
  created_at: string;
  updated_at: string;
};

type Vote = {
  id: string;
  round_id: string;
  game_player_id: string;
  vote: VoteChoice;
  voted_at: string;
};

type MissionActionRow = {
  id: string;
  round_id: string;
  game_player_id: string;
  action: MissionAction;
  acted_at: string;
};
```

## Callback Data Format Design

The 64-byte Telegram callback data limit requires compact formats. The existing project uses `action:uuid` format. For the game loop, we need game context but can use shorter identifiers since rounds are numbered 1-5 and player indices are 0-9.

| Action | Format | Example | Bytes |
|--------|--------|---------|-------|
| Toggle nomination | `nt:{gameId8}:{playerIdx}` | `nt:a1b2c3d4:3` | ~14 |
| Confirm nomination | `nc:{gameId8}` | `nc:a1b2c3d4` | ~11 |
| Vote JA | `vj:{gameId8}:{roundNum}` | `vj:a1b2c3d4:2` | ~14 |
| Vote NEJ | `vn:{gameId8}:{roundNum}` | `vn:a1b2c3d4:2` | ~14 |
| Mission Sakra | `ms:{gameId8}:{roundNum}` | `ms:a1b2c3d4:3` | ~14 |
| Mission Gola | `mg:{gameId8}:{roundNum}` | `mg:a1b2c3d4:3` | ~14 |
| Sista Chansen guess | `sc:{gameId8}:{playerIdx}` | `sc:a1b2c3d4:5` | ~14 |

**Strategy:** Use first 8 characters of the game UUID as a short ID. Collision risk is negligible for active games (there's only one per group). The handler looks up the full game from the active game in the group context.

Alternative: Use the full game UUID (36 chars) and keep action prefix short. `nt:{uuid}:3` = 36+4+1 = 41 bytes -- still under 64. This is safer and simpler.

**Recommended approach:** Full game UUID with short action prefix. Example: `nt:{uuid}:{idx}` where prefix is 2-3 chars. Max: `nt:` (3) + UUID (36) + `:` (1) + index (1-2) = 41-42 bytes. Well within limit.

## Code Examples

### Scheduler Setup with Restart Recovery

```typescript
// src/lib/scheduler.ts
import { Cron } from "croner";

const TIMEZONE = "Europe/Stockholm";

export interface ScheduleHandlers {
  onMissionPost: () => Promise<void>;
  onNominationReminder: () => Promise<void>;
  onNominationDeadline: () => Promise<void>;
  onVotingReminder: () => Promise<void>;
  onVotingDeadline: () => Promise<void>;
  onExecutionReminder: () => Promise<void>;
  onExecutionDeadline: () => Promise<void>;
  onResultReveal: () => Promise<void>;
}

const jobs: Cron[] = [];

export function startScheduler(handlers: ScheduleHandlers): void {
  // Monday-Friday schedule
  jobs.push(
    new Cron("0 9 * * 1-5", { timezone: TIMEZONE }, handlers.onMissionPost),
    new Cron("0 11 * * 1-5", { timezone: TIMEZONE }, handlers.onNominationReminder),
    new Cron("0 12 * * 1-5", { timezone: TIMEZONE }, handlers.onNominationDeadline),
    new Cron("0 14 * * 1-5", { timezone: TIMEZONE }, handlers.onVotingReminder),
    new Cron("0 15 * * 1-5", { timezone: TIMEZONE }, handlers.onVotingDeadline),
    new Cron("0 17 * * 1-5", { timezone: TIMEZONE }, handlers.onExecutionReminder),
    new Cron("0 18 * * 1-5", { timezone: TIMEZONE }, handlers.onExecutionDeadline),
    new Cron("0 21 * * 1-5", { timezone: TIMEZONE }, handlers.onResultReveal),
  );
}

export function stopScheduler(): void {
  for (const job of jobs) job.stop();
  jobs.length = 0;
}
```

### Capo Rotation Logic

```typescript
// Get current Capo based on round number and failed vote count
function getCapoIndex(
  playerCount: number,
  roundNumber: number,
  failedVotesInRound: number,
): number {
  // Base Capo for this round (0-indexed)
  const baseIndex = (roundNumber - 1) % playerCount;
  // Each failed vote rotates to next player
  return (baseIndex + failedVotesInRound) % playerCount;
}
```

### Vote Result Computation

```typescript
function computeVoteResult(
  votes: Vote[],
  totalPlayers: number,
): { approved: boolean; jaCount: number; nejCount: number; abstainCount: number } {
  const jaCount = votes.filter(v => v.vote === "ja").length;
  const nejCount = votes.filter(v => v.vote === "nej").length;
  const abstainCount = totalPlayers - votes.length;
  // Majority of ACTUAL votes (not all players)
  const approved = jaCount > nejCount;
  return { approved, jaCount, nejCount, abstainCount };
}
```

### Mission Result Computation

```typescript
function computeMissionResult(
  actions: MissionActionRow[],
  teamSize: number,
): { success: boolean; golaCount: number } {
  // Default: missing actions count as Sakra (loyalty assumed)
  const golaCount = actions.filter(a => a.action === "gola").length;
  const success = golaCount === 0;
  return { success, golaCount };
}
```

### Sista Chansen Determination

```typescript
function getSistaChansen(liganScore: number, ainaScore: number): {
  guessingSide: "golare" | "akta";
  targetDescription: string;
} | null {
  if (liganScore < 3 && ainaScore < 3) return null; // Game not over
  if (liganScore >= 3) {
    // Ligan wins -> Golare guess Hogra Hand
    return { guessingSide: "golare", targetDescription: "Guzmans Hogra Hand" };
  }
  // Aina wins -> Akta guess one Golare
  return { guessingSide: "akta", targetDescription: "en Golare" };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-cron for scheduling | Croner 10.x (zero-dep, ESM, timezone) | 2024-2025 | Better TypeScript/ESM support, timezone handling |
| XState for game FSM | Custom FSM for linear flows | Project decision | Zero dependencies, simpler for 5-8 states |
| In-memory game state | Database-first state (Supabase) | Project decision | Survives restarts, handles concurrency |
| Per-game timers | Global cron + DB query pattern | Best practice | Memory-safe, restart-safe, simpler cleanup |

**Deprecated/outdated:**
- Telegraf: EOL Feb 2025, replaced by grammY (already decided)
- node-schedule: Less actively maintained than Croner, not recommended for new projects

## Capo Rotation and Join Order

The CONTEXT.md specifies "Rotation follows join order." The `game_players` table has `joined_at` timestamps. For reliable ordering:

1. At game start, assign `join_order` (1, 2, 3, ...) to each player based on `joined_at` ASC
2. Round 1 Capo = player with join_order 1
3. Round N Capo = player with join_order ((N-1) % playerCount) + 1
4. On failed vote, the Capo rotates to the NEXT player in join_order within the same round

This means `join_order` must be stored on the `game_players` row, not computed dynamically from `joined_at` (which could theoretically have ties).

## Message Template Needs

Phase 3 requires these new template messages (all in Guzman persona, Swedish with proper aao):

| Template | Context | Dynamic Data |
|----------|---------|-------------|
| MISSION_POST | Group, 09:00 | round_number, mission_description |
| NOMINATION_PROMPT | Group, 12:00 | capo_name, team_size |
| NOMINATION_REMINDER | Group + DM, 11:00 | capo_name |
| NOMINATION_TIMEOUT | Group | old_capo_name, new_capo_name |
| TEAM_PROPOSED | Group | capo_name, team_member_names |
| VOTE_PROMPT | Group | team_member_names |
| VOTE_TALLY | Group (edited) | voted_names, total |
| VOTE_REVEAL | Group | vote_details (who voted what) |
| VOTE_APPROVED | Group | team_member_names |
| VOTE_REJECTED | Group | nej_count, new_capo_name |
| KAOS_WARNING_1 | Group | (escalating tone) |
| KAOS_WARNING_2 | Group | (more aggressive) |
| KAOS_TRIGGERED | Group | (maximum aggression, auto-fail) |
| EXECUTION_PROMPT | DM to team | round_number |
| EXECUTION_REMINDER | DM to team + Group | player_name |
| EXECUTION_DEFAULT | DM to player | (defaulted to Sakra) |
| MISSION_SUCCESS | Group | |
| MISSION_FAIL | Group | gola_count |
| SCORE_UPDATE | Group | ligan_score, aina_score |
| ROUND_END | Group | round_number, next_round |
| GAME_WON_LIGAN | Group | ligan_score, aina_score |
| GAME_WON_AINA | Group | ligan_score, aina_score |
| SISTA_CHANSEN_INTRO | Group | guessing_side |
| SISTA_CHANSEN_DM | DM to guessers | target_description, player_list |
| SISTA_CHANSEN_GUESS | Group | guessing_player, target_name |
| SISTA_CHANSEN_CORRECT | Group | winning_side |
| SISTA_CHANSEN_WRONG | Group | winning_side |
| FINAL_REVEAL | Group | all_roles_revealed |
| VOTE_REMINDER | Group + DM | voter_name |

## Sista Chansen Implementation

The "group DM discussion" for Sista Chansen can be implemented as:

1. **Sequential DMs** to each member of the guessing team with a message explaining the situation
2. Each guesser receives the same inline keyboard with all candidate player names
3. First valid guess locks in the choice (or use majority if multiple guessers -- recommend first-guess-wins for simplicity)
4. After guess is submitted (or 2-hour timeout), reveal sequence plays out in group chat with 30-60 second delays between messages for drama

This avoids the complexity of temporary Telegram groups and uses the existing DM infrastructure.

## Open Questions

1. **Weekend games**
   - What we know: Schedule is Monday-Friday (1-5 in cron)
   - What's unclear: What if a game is created on Thursday? Does it span into next week?
   - Recommendation: For v1, games always run 5 consecutive weekdays. If started mid-week, round 1 starts next available weekday morning. Document this behavior.

2. **Multiple active games across different groups**
   - What we know: One active game per group (enforced by unique index)
   - What's unclear: The global scheduler processes ALL active games. If 10 groups have games, all 10 get mission posts at 09:00.
   - Recommendation: This is fine -- the scheduler queries all active games and processes each. MessageQueue handles per-chat rate limiting.

3. **Capo nomination timeout specifics**
   - What we know: Timeout at deadline (12:00), reminder at 11:00, counts as failed vote
   - What's unclear: If the Capo for round 1 doesn't nominate, and the next Capo also doesn't by 12:00, is that 2 failed votes?
   - Recommendation: Only one nomination attempt per scheduled window. If Capo times out at 12:00, rotate once, and the new Capo gets until 15:00 voting deadline to nominate (or it auto-fails again). This keeps the daily rhythm intact.

4. **Game start timing**
   - What we know: Game transitions from lobby to active when admin clicks start
   - What's unclear: If admin starts game at 14:00, does round 1 begin at 09:00 the next day?
   - Recommendation: Yes. The next 09:00 cron tick after game state becomes "active" triggers round 1 mission post. The game start monologue (already implemented) tells players to wait.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/db/types.ts`, `src/db/client.ts`, `src/db/schema.sql`, `src/handlers/lobby.ts`, `src/handlers/game-commands.ts`, `src/lib/roles.ts`, `src/lib/messages.ts`, `src/queue/message-queue.ts`
- [Croner GitHub](https://github.com/Hexagon/croner) - v10.0.1, zero-dep ESM scheduler with timezone support
- [grammY Inline Keyboard Plugin](https://grammy.dev/plugins/keyboard) - InlineKeyboard API, callback handling
- [Telegram Bot API](https://core.telegram.org/bots/api) - 64-byte callback data limit, editMessageText constraints

### Secondary (MEDIUM confidence)
- [Croner NPM](https://www.npmjs.com/package/croner) - ~2.5M weekly downloads, actively maintained
- [BetterStack Node.js Schedulers Comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) - Scheduler landscape overview
- [Avalon Rules](https://avalon-game.com/wiki/rules/) - Game mechanic reference for state machine design
- [Supabase Enums vs CHECK constraints](https://supabase.com/docs/guides/database/postgres/enums) - CHECK constraints for phase/vote columns

### Tertiary (LOW confidence)
- [Medium: Multiselection Inline Keyboards](https://medium.com/@moraneus/enhancing-user-engagement-with-multiselection-inline-keyboards-in-telegram-bots-7cea9a371b8d) - Toggle pattern inspiration (unverified implementation details)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Croner verified via official GitHub, grammY/Supabase already in project
- Architecture: HIGH - State machine design derived from Avalon rules + existing codebase patterns
- Database schema: HIGH - Extends existing schema patterns, uses established Supabase conventions
- Pitfalls: HIGH - Derived from Telegram API docs (64-byte limit), database concurrency patterns, and existing project experience
- Scheduling: MEDIUM - Croner timezone handling verified, but restart recovery pattern is a custom design (no library support)
- Sista Chansen: MEDIUM - Implementation approach is sound but untested, DM-based discussion is simpler than alternatives

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable domain, no fast-moving dependencies)
