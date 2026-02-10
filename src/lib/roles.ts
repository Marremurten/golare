import { randomInt } from "node:crypto";
import type { PlayerRole } from "../db/types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoleAssignment = {
  playerId: string;
  role: PlayerRole;
};

// ---------------------------------------------------------------------------
// Balancing table (from PROJECT.md)
// ---------------------------------------------------------------------------

/**
 * Role distribution per player count.
 * - golare: number of Golare in the game
 * - akta: number of Äkta (including the one who becomes Högra Hand)
 * - teamSize: mission team size for this player count
 */
export const ROLE_BALANCING: Record<
  number,
  { golare: number; akta: number; teamSize: number }
> = {
  4: { golare: 1, akta: 3, teamSize: 2 },
  5: { golare: 1, akta: 4, teamSize: 2 },
  6: { golare: 2, akta: 4, teamSize: 3 },
  7: { golare: 2, akta: 5, teamSize: 3 },
  8: { golare: 2, akta: 6, teamSize: 3 },
  9: { golare: 3, akta: 6, teamSize: 4 },
  10: { golare: 3, akta: 7, teamSize: 4 },
};

// ---------------------------------------------------------------------------
// Shuffle (Fisher-Yates with crypto randomness)
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle using cryptographically secure randomness.
 * Returns a NEW shuffled array -- does NOT mutate the input.
 */
function cryptoShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Role assignment
// ---------------------------------------------------------------------------

/**
 * Assign roles to a list of player IDs based on the balancing table.
 *
 * Distribution:
 * 1. Shuffle player IDs (crypto-random)
 * 2. First N players become Golare
 * 3. Remaining players form the Äkta pool
 * 4. One random Äkta becomes Högra Hand (Guzmans Högra Hand)
 *
 * @throws Error if player count is not between 4 and 10
 */
export function assignRoles(playerIds: string[]): RoleAssignment[] {
  const count = playerIds.length;
  const balancing = ROLE_BALANCING[count];

  if (!balancing) {
    throw new Error(
      `Invalid player count: ${count}. Must be between 4 and 10.`,
    );
  }

  const shuffled = cryptoShuffle(playerIds);
  const assignments: RoleAssignment[] = [];

  // First N are Golare
  const golareIds = shuffled.slice(0, balancing.golare);
  for (const id of golareIds) {
    assignments.push({ playerId: id, role: "golare" });
  }

  // Remaining are the Äkta pool
  const aktaPool = shuffled.slice(balancing.golare);

  // Pick one random Äkta to be Högra Hand
  const hograHandIndex = randomInt(0, aktaPool.length);

  for (let i = 0; i < aktaPool.length; i++) {
    assignments.push({
      playerId: aktaPool[i],
      role: i === hograHandIndex ? "hogra_hand" : "akta",
    });
  }

  return assignments;
}
