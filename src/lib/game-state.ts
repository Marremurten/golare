/**
 * Pure FSM functions for game phase transitions and round logic.
 * All functions are side-effect-free and testable in isolation.
 */

import type {
  RoundPhase,
  Vote,
  MissionActionRow,
  GuessingSide,
} from "../db/types.js";
import { ROLE_BALANCING } from "./roles.js";

// ---------------------------------------------------------------------------
// Phase events
// ---------------------------------------------------------------------------

export type PhaseEvent =
  | "schedule_mission"
  | "schedule_nomination"
  | "nomination_submitted"
  | "schedule_voting"
  | "vote_approved"
  | "vote_rejected"
  | "kaos_triggered"
  | "schedule_execution"
  | "schedule_reveal"
  | "reveal_complete"
  | "nomination_timeout";

// ---------------------------------------------------------------------------
// FSM: phase transitions
// ---------------------------------------------------------------------------

/**
 * Pure state transition function.
 * Returns the next phase given the current phase and an event.
 * If no valid transition exists, returns the current phase unchanged.
 */
export function nextRoundPhase(
  current: RoundPhase,
  event: PhaseEvent,
): RoundPhase {
  switch (current) {
    case "mission_posted":
      if (event === "schedule_nomination") return "nomination";
      break;
    case "nomination":
      if (event === "nomination_submitted") return "voting";
      if (event === "nomination_timeout") return "nomination"; // stays, Capo rotated externally
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
      if (event === "reveal_complete") return "mission_posted"; // next round (caller handles)
      break;
  }
  return current; // No valid transition
}

// ---------------------------------------------------------------------------
// Capo rotation
// ---------------------------------------------------------------------------

/**
 * Compute the index (0-based) of the current Capo in the ordered player list.
 * Rotation: base Capo for round N is player (N-1), then each failed vote
 * advances the Capo by one position.
 */
export function getCapoIndex(
  playerCount: number,
  roundNumber: number,
  failedVotesInRound: number,
): number {
  return (roundNumber - 1 + failedVotesInRound) % playerCount;
}

// ---------------------------------------------------------------------------
// Vote computation
// ---------------------------------------------------------------------------

/**
 * Compute the result of a team approval vote.
 * Majority of actual cast votes decides (abstains excluded).
 */
export function computeVoteResult(
  votes: Vote[],
  totalPlayers: number,
): { approved: boolean; jaCount: number; nejCount: number; abstainCount: number } {
  const jaCount = votes.filter((v) => v.vote === "ja").length;
  const nejCount = votes.filter((v) => v.vote === "nej").length;
  const abstainCount = totalPlayers - votes.length;
  // Majority of actual votes (jaCount > nejCount means approved)
  const approved = jaCount > nejCount;
  return { approved, jaCount, nejCount, abstainCount };
}

// ---------------------------------------------------------------------------
// Mission result computation
// ---------------------------------------------------------------------------

/**
 * Compute the result of a mission execution.
 * golaCount === 0 means success. Missing actions default to sakra.
 */
export function computeMissionResult(
  actions: MissionActionRow[],
  _teamSize: number,
): { success: boolean; golaCount: number } {
  const golaCount = actions.filter((a) => a.action === "gola").length;
  const success = golaCount === 0;
  return { success, golaCount };
}

// ---------------------------------------------------------------------------
// Team size lookup
// ---------------------------------------------------------------------------

/**
 * Get the team size for the given player count.
 * Delegates to the existing ROLE_BALANCING table.
 */
export function getTeamSize(playerCount: number): number {
  const balancing = ROLE_BALANCING[playerCount];
  if (!balancing) {
    throw new Error(`No balancing data for ${playerCount} players`);
  }
  return balancing.teamSize;
}

// ---------------------------------------------------------------------------
// Sista Chansen logic
// ---------------------------------------------------------------------------

/**
 * Determine which side gets to guess in Sista Chansen.
 * Returns null if the game is not over yet.
 *
 * - Ligan wins (>= 3 points): Golare guess Hogra Hand
 * - Aina wins (>= 3 points): Akta guess one Golare
 */
export function getSistaChansenSide(
  liganScore: number,
  ainaScore: number,
): GuessingSide | null {
  if (liganScore >= 3) return "golare";
  if (ainaScore >= 3) return "akta";
  return null;
}

// ---------------------------------------------------------------------------
// Win condition check
// ---------------------------------------------------------------------------

/**
 * Check if either side has won (first to 3).
 * Returns null if no winner yet.
 */
export function checkWinCondition(
  liganScore: number,
  ainaScore: number,
): "ligan" | "aina" | null {
  if (liganScore >= 3) return "ligan";
  if (ainaScore >= 3) return "aina";
  return null;
}
