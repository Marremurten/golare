import {
  getAllRecentMessages,
  getGamePlayersWithInfo,
  getGuzmanContext,
} from "../db/client.js";
import type { PlayerMessage } from "../db/types.js";

// ---------------------------------------------------------------------------
// Internal types (using `type` aliases per project convention)
// ---------------------------------------------------------------------------

type PlayerStats = {
  messageCount: number;
  avgLength: number;
  timeSinceLastMsg: number | null;
  frequency: number;
  targetedPlayers: Map<string, number>;
};

type ToneLabel = "anklagande" | "defensiv" | "tyst" | "neutral" | "kaotisk";

type PlayerAnalysis = {
  stats: PlayerStats;
  primaryTone: ToneLabel;
  secondaryTone: ToneLabel | null;
  anomalies: string[];
};

type BehavioralHistoryEntry = {
  round: number;
  messageCount: number;
  avgLength: number;
  frequency: number;
  primaryTone: string;
};

// ---------------------------------------------------------------------------
// Tone keyword maps (Swedish with proper characters)
// ---------------------------------------------------------------------------

const TONE_KEYWORDS: Record<Exclude<ToneLabel, "tyst" | "neutral">, string[]> = {
  anklagande: [
    "golare", "gola", "misstänker", "litar inte", "suspekt",
    "råtta", "förrädare", "ljuger", "snitch", "sus", "cap", "fake", "snitcha",
  ],
  defensiv: [
    "oskyld", "inte jag", "litar på mig", "lovar", "svär",
    "wallah det var inte", "jag svär", "det var inte jag", "tro mig",
  ],
  kaotisk: [
    "haha", "lol", "yolo", "skiter i", "kör",
    "yalla kör", "asså bre", "wallah", "bre va fan",
  ],
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Compute basic statistics for a player's messages.
 *
 * @param messages - The player's messages (any order).
 * @param allPlayerNames - Map of display names to game_player_ids for
 *   relationship detection (mention counting).
 */
export function computePlayerStats(
  messages: PlayerMessage[],
  allPlayerNames: Map<string, string>,
): PlayerStats {
  const messageCount = messages.length;

  // Average message length
  const avgLength =
    messageCount === 0
      ? 0
      : messages.reduce((sum, m) => sum + m.message_text.length, 0) / messageCount;

  // Time since most recent message (minutes). null if no messages.
  let timeSinceLastMsg: number | null = null;
  if (messageCount > 0) {
    const newest = messages.reduce((latest, m) =>
      new Date(m.sent_at) > new Date(latest.sent_at) ? m : latest,
    );
    timeSinceLastMsg =
      (Date.now() - new Date(newest.sent_at).getTime()) / 60_000;
  }

  // Frequency: messages per hour based on time span from oldest to newest.
  let frequency = 0;
  if (messageCount > 1) {
    const times = messages.map((m) => new Date(m.sent_at).getTime());
    const oldest = Math.min(...times);
    const newest = Math.max(...times);
    const spanHours = (newest - oldest) / 3_600_000;
    if (spanHours > 0) {
      frequency = messageCount / spanHours;
    }
  }

  // Targeted players: scan for @username and first_name mentions.
  const targetedPlayers = new Map<string, number>();
  const normalizedTexts = messages.map((m) =>
    m.message_text.normalize("NFC").toLowerCase(),
  );

  for (const [name] of allPlayerNames) {
    const normalizedName = name.normalize("NFC").toLowerCase();
    if (normalizedName.length === 0) continue;

    let count = 0;
    for (const text of normalizedTexts) {
      // Check @mention
      const mentionPattern = new RegExp(`@${escapeRegex(normalizedName)}\\b`, "g");
      const mentionMatches = text.match(mentionPattern);
      if (mentionMatches) count += mentionMatches.length;

      // Check first_name substring (case-insensitive)
      if (text.includes(normalizedName)) {
        count += 1;
      }
    }

    // Only count if threshold >= 2 to reduce noise
    if (count >= 2) {
      targetedPlayers.set(name, count);
    }
  }

  return { messageCount, avgLength, timeSinceLastMsg, frequency, targetedPlayers };
}

/**
 * Classify the tone of a set of messages using heuristic Swedish keyword matching.
 */
export function classifyTone(
  messages: PlayerMessage[],
): { primary: ToneLabel; secondary: ToneLabel | null } {
  // Override: 0-1 messages = "tyst"
  if (messages.length <= 1) {
    return { primary: "tyst", secondary: null };
  }

  // Score each tone category
  const scores: Record<string, number> = {
    anklagande: 0,
    defensiv: 0,
    kaotisk: 0,
  };

  for (const msg of messages) {
    const normalized = msg.message_text.normalize("NFC").toLowerCase();

    for (const [tone, keywords] of Object.entries(TONE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword.normalize("NFC").toLowerCase())) {
          scores[tone]++;
        }
      }
    }
  }

  // Sort tones by score descending
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  const [topTone, topScore] = sorted[0];
  const [secondTone, secondScore] = sorted[1];

  // If no keywords match, primary = "neutral"
  if (topScore === 0) {
    return { primary: "neutral", secondary: null };
  }

  const primary = topTone as ToneLabel;
  const secondary = secondScore >= 2 ? (secondTone as ToneLabel) : null;

  return { primary, secondary };
}

/**
 * Detect anomalies by comparing current stats/tone against the player's
 * own behavioral history across rounds.
 */
export function detectAnomalies(
  currentStats: PlayerStats,
  currentTone: ToneLabel,
  history: BehavioralHistoryEntry[] | undefined,
): string[] {
  // No history = first round = no baseline to compare
  if (!history || history.length === 0) {
    return [];
  }

  const anomalies: string[] = [];

  // 1. Suspicious silence: had >= 3 messages in any previous round but now 0-1
  const hadActive = history.some((h) => h.messageCount >= 3);
  if (hadActive && currentStats.messageCount <= 1) {
    anomalies.push("tystnat plotsligt");
  }

  // 2. Aggression spike: current tone is "anklagande" but previous rounds
  //    were mostly "neutral" or "defensiv"
  if (currentTone === "anklagande") {
    const nonAggressive = history.filter(
      (h) => h.primaryTone === "neutral" || h.primaryTone === "defensiv",
    );
    if (nonAggressive.length >= history.length * 0.5) {
      anomalies.push("aggressionsökning");
    }
  }

  // 3. Activity drop: current frequency < 30% of average historical frequency
  //    (only if history has >= 2 entries)
  if (history.length >= 2) {
    const avgHistFreq =
      history.reduce((sum, h) => sum + h.frequency, 0) / history.length;
    if (avgHistFreq > 0 && currentStats.frequency < avgHistFreq * 0.3) {
      anomalies.push("aktivitet sjunkit");
    }
  }

  // 4. Behavior shift: current tone differs from the most common historical tone (mode)
  //    Only trigger if history has >= 2 entries with the same tone
  if (history.length >= 2) {
    const toneCounts = new Map<string, number>();
    for (const h of history) {
      toneCounts.set(h.primaryTone, (toneCounts.get(h.primaryTone) ?? 0) + 1);
    }

    let modeTone = "";
    let modeCount = 0;
    for (const [tone, count] of toneCounts) {
      if (count > modeCount) {
        modeTone = tone;
        modeCount = count;
      }
    }

    if (modeCount >= 2 && currentTone !== modeTone) {
      anomalies.push("beteendeförändring");
    }
  }

  return anomalies;
}

/**
 * Build a structured Swedish summary string for a single player.
 * Hard-capped at 200 characters.
 */
export function buildPlayerSummary(
  _name: string,
  analysis: PlayerAnalysis,
): string {
  // Inactive players get minimal marker
  if (analysis.stats.messageCount === 0) {
    return "inaktiv";
  }

  // Tone label
  const toneStr = analysis.secondaryTone
    ? `Ton: ${analysis.primaryTone}/${analysis.secondaryTone}`
    : `Ton: ${analysis.primaryTone}`;

  // Activity label
  let activityLabel: string;
  const mc = analysis.stats.messageCount;
  if (mc === 0) activityLabel = "ingen";
  else if (mc <= 2) activityLabel = "låg";
  else if (mc <= 5) activityLabel = "medel";
  else activityLabel = "hög";

  // Target
  let targetStr = "";
  if (analysis.stats.targetedPlayers.size > 0) {
    let topTarget = "";
    let topCount = 0;
    for (const [name, count] of analysis.stats.targetedPlayers) {
      if (count > topCount) {
        topTarget = name;
        topCount = count;
      }
    }
    if (topCount >= 2) {
      targetStr = ` | Riktar sig mot: ${topTarget}`;
    }
  }

  // Anomaly
  const anomalyStr =
    analysis.anomalies.length > 0
      ? analysis.anomalies.join(", ")
      : "ingen";

  const summary = `${toneStr} | Aktivitet: ${activityLabel}${targetStr} | Anomali: ${anomalyStr}`;

  // Hard-cap at 200 characters
  if (summary.length > 200) {
    return summary.slice(0, 197) + "...";
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Analyze behavioral patterns for all players in a game.
 *
 * Returns playerNotes (keyed by display name) and historyUpdate (keyed by
 * game_player_id) for persisting to GuzmanContext.
 */
export async function analyzeBehavior(gameId: string): Promise<{
  playerNotes: Record<string, string>;
  historyUpdate: Record<string, BehavioralHistoryEntry[]>;
}> {
  // Fetch data
  const [messages, gamePlayers, context] = await Promise.all([
    getAllRecentMessages(gameId),
    getGamePlayersWithInfo(gameId),
    getGuzmanContext(gameId),
  ]);

  const existingHistory = context.behavioralHistory ?? {};

  // Build name mapping: display name -> game_player_id
  const nameMap = new Map<string, string>();
  const idToName = new Map<string, string>();

  for (const gp of gamePlayers) {
    const name = gp.players.first_name || gp.players.username || "Spelare";
    nameMap.set(name, gp.id);
    idToName.set(gp.id, name);
  }

  // Group messages by game_player_id
  const messagesByPlayer = new Map<string, PlayerMessage[]>();
  for (const gp of gamePlayers) {
    messagesByPlayer.set(gp.id, []);
  }
  for (const msg of messages) {
    const existing = messagesByPlayer.get(msg.game_player_id);
    if (existing) {
      existing.push(msg);
    }
  }

  // Determine current round number from context
  const currentRound =
    context.roundSummaries.length > 0
      ? context.roundSummaries[context.roundSummaries.length - 1].round
      : 1;

  // Analyze each player
  const playerNotes: Record<string, string> = {};
  const historyUpdate: Record<string, BehavioralHistoryEntry[]> = {};

  for (const gp of gamePlayers) {
    const playerMessages = messagesByPlayer.get(gp.id) ?? [];
    const displayName = idToName.get(gp.id) ?? "Spelare";
    const playerHistory = existingHistory[gp.id];

    // Compute stats
    const stats = computePlayerStats(playerMessages, nameMap);

    // Classify tone
    const { primary: primaryTone, secondary: secondaryTone } =
      classifyTone(playerMessages);

    // Detect anomalies
    const anomalies = detectAnomalies(stats, primaryTone, playerHistory);

    // Build analysis object
    const analysis: PlayerAnalysis = {
      stats,
      primaryTone,
      secondaryTone,
      anomalies,
    };

    // Build summary
    playerNotes[displayName] = buildPlayerSummary(displayName, analysis);

    // Build history update: append current round's stats to existing history
    const previousHistory = playerHistory ?? [];
    historyUpdate[gp.id] = [
      ...previousHistory,
      {
        round: currentRound,
        messageCount: stats.messageCount,
        avgLength: stats.avgLength,
        frequency: stats.frequency,
        primaryTone,
      },
    ];
  }

  return { playerNotes, historyUpdate };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
