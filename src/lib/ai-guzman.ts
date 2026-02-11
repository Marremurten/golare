import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getAIClient, MODEL_MAP } from "./ai-client.js";
import {
  buildGuzmanSystemPrompt,
  buildMissionPrompt,
  buildResultPrompt,
  buildWhisperPrompt,
  buildGapFillPrompt,
  buildWhisperRelayPrompt,
  buildSurveillanceCluePrompt,
  buildSpaningPrompt,
  buildIndividualRevealPrompt,
} from "./ai-prompts.js";
import { analyzeBehavior } from "./behavioral-analysis.js";
import { MESSAGES } from "./messages.js";
import {
  getGuzmanContext as dbGetGuzmanContext,
  updateGuzmanContext as dbUpdateGuzmanContext,
} from "../db/client.js";
import type { GuzmanContext, TruthLevel, PlayerRole } from "../db/types.js";

// ---------------------------------------------------------------------------
// HTML sanitization for Telegram
// ---------------------------------------------------------------------------

/** Allowed Telegram HTML tags */
const ALLOWED_TAGS = new Set(["b", "i", "code", "a"]);

/**
 * Strip all HTML tags except Telegram-safe ones (<b>, <i>, <code>, <a>).
 * Truncates to 4000 chars to stay within Telegram message limits.
 */
export function sanitizeForTelegram(text: string): string {
  // Replace disallowed HTML tags while keeping allowed ones
  const sanitized = text.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g,
    (match, tag: string) => {
      const lower = tag.toLowerCase();
      if (ALLOWED_TAGS.has(lower)) {
        // Keep the tag but for closing tags and simple opens, pass through
        return match;
      }
      return "";
    },
  );

  // Truncate to 4000 characters (Telegram limit is 4096, leave buffer)
  if (sanitized.length > 4000) {
    return sanitized.slice(0, 4000) + "...";
  }

  return sanitized;
}

// ---------------------------------------------------------------------------
// AI Generation Functions
// ---------------------------------------------------------------------------

/**
 * Generate a mission narrative for a round.
 * Falls back to MESSAGES.MISSION_POST on any failure.
 */
export async function generateMissionNarrative(
  roundNumber: number,
  gameContext: GuzmanContext,
  playerNames: string[],
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
          content: buildMissionPrompt(roundNumber, gameContext, playerNames),
        },
      ],
      max_tokens: 800,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(
        "[ai-guzman] Empty response for mission narrative, using template",
      );
      return MESSAGES.MISSION_POST(roundNumber);
    }

    return sanitizeForTelegram(content);
  } catch (error) {
    console.warn(
      "[ai-guzman] Mission narrative generation failed, using template:",
      error instanceof Error ? error.message : error,
    );
    return MESSAGES.MISSION_POST(roundNumber);
  }
}

/**
 * Generate a result reveal message.
 * Falls back to MESSAGES.MISSION_SUCCESS or MESSAGES.MISSION_FAIL on any failure.
 */
export async function generateResultReveal(
  roundNumber: number,
  gameContext: GuzmanContext,
  missionResult: "success" | "fail" | "kaos_fail",
  golaCount: number,
  playerNames: string[],
  teamNames: string[],
): Promise<string> {
  try {
    const client = getAIClient();
    if (!client) {
      return missionResult === "success"
        ? MESSAGES.MISSION_SUCCESS
        : MESSAGES.MISSION_FAIL(golaCount);
    }

    const response = await client.chat.completions.create({
      model: MODEL_MAP.narrative,
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        {
          role: "user",
          content: buildResultPrompt(
            roundNumber,
            gameContext,
            missionResult,
            golaCount,
            playerNames,
            teamNames,
          ),
        },
      ],
      max_tokens: 800,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(
        "[ai-guzman] Empty response for result reveal, using template",
      );
      return missionResult === "success"
        ? MESSAGES.MISSION_SUCCESS
        : MESSAGES.MISSION_FAIL(golaCount);
    }

    return sanitizeForTelegram(content);
  } catch (error) {
    console.warn(
      "[ai-guzman] Result reveal generation failed, using template:",
      error instanceof Error ? error.message : error,
    );
    return missionResult === "success"
      ? MESSAGES.MISSION_SUCCESS
      : MESSAGES.MISSION_FAIL(golaCount);
  }
}

/** Zod schema for structured whisper response */
const WhisperResponseSchema = z.object({
  truth_level: z.enum(["truth", "half_truth", "lie", "reassurance"]),
  message: z.string(),
});

/**
 * Check if any target quote (8+ chars) appears verbatim in the generated message.
 * Returns true if a verbatim match is found.
 */
function containsVerbatimQuote(
  message: string,
  targetQuotes: string[],
): boolean {
  const lowerMessage = message.toLowerCase();
  for (const quote of targetQuotes) {
    if (quote.length < 8) continue;
    if (lowerMessage.includes(quote.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a whisper (manipulative DM) message for a player.
 * Returns null on any failure -- whispers are optional.
 *
 * Includes verbatim safety check: if any target quote (8+ chars) appears
 * in the generated message, retries once. If retry also matches, returns
 * it anyway (CONST-04: never block whispers).
 */
export async function generateWhisperMessage(
  gameContext: GuzmanContext,
  targetPlayerName: string,
  targetRole: PlayerRole,
  otherPlayerNames: string[],
  roundEvents: string,
  targetQuotes: string[],
  allPlayerOverview: string,
  roundNumber: number,
): Promise<{ message: string; truthLevel: TruthLevel } | null> {
  try {
    const client = getAIClient();
    if (!client) {
      return null;
    }

    const makeRequest = () =>
      client.chat.completions.parse({
        model: MODEL_MAP.whisper,
        messages: [
          { role: "system", content: buildGuzmanSystemPrompt() },
          {
            role: "user",
            content: buildWhisperPrompt(
              gameContext,
              targetPlayerName,
              targetRole,
              otherPlayerNames,
              roundEvents,
              targetQuotes,
              allPlayerOverview,
              roundNumber,
            ),
          },
        ],
        max_tokens: 500,
        temperature: 1.0,
        response_format: zodResponseFormat(WhisperResponseSchema, "whisper"),
      });

    let response = await makeRequest();

    let parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      console.warn(
        "[ai-guzman] Empty response for whisper, skipping",
      );
      return null;
    }

    // Verbatim safety check: retry once if a quote appears in the message
    if (containsVerbatimQuote(parsed.message, targetQuotes)) {
      console.warn(
        "[ai-guzman] Verbatim quote detected in whisper, regenerating once",
      );
      response = await makeRequest();
      parsed = response.choices[0]?.message?.parsed;
      if (!parsed) {
        console.warn(
          "[ai-guzman] Empty response on whisper retry, skipping",
        );
        return null;
      }
      if (containsVerbatimQuote(parsed.message, targetQuotes)) {
        console.warn(
          "[ai-guzman] Verbatim quote still present after retry, returning anyway",
        );
      }
    }

    // Map "reassurance" to "truth" (closest in intent) -- TruthLevel type unchanged
    const truthLevel: TruthLevel =
      parsed.truth_level === "reassurance" ? "truth" : parsed.truth_level;

    return {
      message: sanitizeForTelegram(parsed.message),
      truthLevel,
    };
  } catch (error) {
    console.warn(
      "[ai-guzman] Whisper generation failed, skipping:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Generate a gap-fill comment during quiet periods.
 * Returns null on any failure -- gap-fills are optional.
 */
export async function generateGapFillComment(
  gameContext: GuzmanContext,
  recentActivity: string,
  playerNames: string[],
): Promise<string | null> {
  try {
    const client = getAIClient();
    if (!client) {
      return null;
    }

    const response = await client.chat.completions.create({
      model: MODEL_MAP.commentary,
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        {
          role: "user",
          content: buildGapFillPrompt(gameContext, recentActivity, playerNames),
        },
      ],
      max_tokens: 200,
      temperature: 1.0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(
        "[ai-guzman] Empty response for gap-fill, skipping",
      );
      return null;
    }

    return sanitizeForTelegram(content);
  } catch (error) {
    console.warn(
      "[ai-guzman] Gap-fill generation failed, skipping:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Engagement AI Generation (Phase 5)
// ---------------------------------------------------------------------------

/**
 * Generate a whisper relay message -- Guzman presents an anonymous player
 * message to the group with a cryptic hint about the sender's role.
 * Falls back to MESSAGES.WHISPER_RELAY_TEMPLATE on any failure.
 */
export async function generateWhisperRelay(
  senderRole: PlayerRole,
  whisperText: string,
  gameContext: GuzmanContext,
): Promise<string> {
  try {
    const client = getAIClient();
    if (!client) {
      return MESSAGES.WHISPER_RELAY_TEMPLATE(whisperText);
    }

    const response = await client.chat.completions.create({
      model: MODEL_MAP.narrative,
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        {
          role: "user",
          content: buildWhisperRelayPrompt(senderRole, whisperText, gameContext),
        },
      ],
      max_tokens: 600,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(
        "[ai-guzman] Empty response for whisper relay, using template",
      );
      return MESSAGES.WHISPER_RELAY_TEMPLATE(whisperText);
    }

    return sanitizeForTelegram(content);
  } catch (error) {
    console.warn(
      "[ai-guzman] Whisper relay generation failed, using template:",
      error instanceof Error ? error.message : error,
    );
    return MESSAGES.WHISPER_RELAY_TEMPLATE(whisperText);
  }
}

/**
 * Generate a surveillance clue about a target player.
 * Falls back to MESSAGES.SURVEILLANCE_CLUE_TEMPLATE on any failure.
 */
export async function generateSurveillanceClue(
  targetName: string,
  targetRole: PlayerRole,
  roundEvents: string,
  gameContext: GuzmanContext,
): Promise<string> {
  try {
    const client = getAIClient();
    if (!client) {
      return MESSAGES.SURVEILLANCE_CLUE_TEMPLATE(targetName);
    }

    const response = await client.chat.completions.create({
      model: MODEL_MAP.commentary,
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        {
          role: "user",
          content: buildSurveillanceCluePrompt(
            targetName,
            targetRole,
            roundEvents,
            gameContext,
          ),
        },
      ],
      max_tokens: 300,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(
        "[ai-guzman] Empty response for surveillance clue, using template",
      );
      return MESSAGES.SURVEILLANCE_CLUE_TEMPLATE(targetName);
    }

    return sanitizeForTelegram(content);
  } catch (error) {
    console.warn(
      "[ai-guzman] Surveillance clue generation failed, using template:",
      error instanceof Error ? error.message : error,
    );
    return MESSAGES.SURVEILLANCE_CLUE_TEMPLATE(targetName);
  }
}

/**
 * Generate a Spaning investigation answer for a player.
 * - Akta: uses MODEL_MAP.whisper (gpt-4o-mini) for nuanced, cryptic answers
 * - Hogra Hand: uses MODEL_MAP.commentary (gpt-4.1-nano) for direct, simple answers
 * Falls back to template messages on any failure.
 */
export async function generateSpaningAnswer(
  targetName: string,
  targetRole: PlayerRole,
  isTruthful: boolean,
  investigatorRole: "akta" | "hogra_hand",
  gameContext: GuzmanContext,
): Promise<string> {
  try {
    const client = getAIClient();
    if (!client) {
      return investigatorRole === "hogra_hand"
        ? MESSAGES.SPANING_HOGRA_HAND_TEMPLATE(targetName, targetRole)
        : MESSAGES.SPANING_AKTA_TEMPLATE(targetName, isTruthful, targetRole);
    }

    const model = investigatorRole === "hogra_hand"
      ? MODEL_MAP.commentary
      : MODEL_MAP.whisper;

    const maxTokens = investigatorRole === "hogra_hand" ? 200 : 400;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        {
          role: "user",
          content: buildSpaningPrompt(
            targetName,
            targetRole,
            isTruthful,
            investigatorRole,
            gameContext,
          ),
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(
        "[ai-guzman] Empty response for spaning answer, using template",
      );
      return investigatorRole === "hogra_hand"
        ? MESSAGES.SPANING_HOGRA_HAND_TEMPLATE(targetName, targetRole)
        : MESSAGES.SPANING_AKTA_TEMPLATE(targetName, isTruthful, targetRole);
    }

    return sanitizeForTelegram(content);
  } catch (error) {
    console.warn(
      "[ai-guzman] Spaning answer generation failed, using template:",
      error instanceof Error ? error.message : error,
    );
    return investigatorRole === "hogra_hand"
      ? MESSAGES.SPANING_HOGRA_HAND_TEMPLATE(targetName, targetRole)
      : MESSAGES.SPANING_AKTA_TEMPLATE(targetName, isTruthful, targetRole);
  }
}

/**
 * Generate a dramatic individual role reveal message for a player.
 * Uses MODEL_MAP.commentary (gpt-4.1-nano) for cost efficiency -- these are short.
 * Falls back to MESSAGES.ROLE_REVEAL_INDIVIDUAL on any failure.
 */
export async function generateIndividualReveal(
  playerName: string,
  role: PlayerRole,
  isLast: boolean,
  gameContext: GuzmanContext,
): Promise<string> {
  try {
    const client = getAIClient();
    if (!client) {
      return MESSAGES.ROLE_REVEAL_INDIVIDUAL(playerName, role);
    }

    const response = await client.chat.completions.create({
      model: MODEL_MAP.commentary,
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        {
          role: "user",
          content: buildIndividualRevealPrompt(playerName, role, isLast, gameContext),
        },
      ],
      max_tokens: 300,
      temperature: 0.9,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(
        "[ai-guzman] Empty response for individual reveal, using template",
      );
      return MESSAGES.ROLE_REVEAL_INDIVIDUAL(playerName, role);
    }

    const sanitized = sanitizeForTelegram(content);
    // Ensure player name is always visible (nano model sometimes omits it)
    if (!sanitized.includes(playerName)) {
      const emoji = role === "golare" ? "🐀" : role === "hogra_hand" ? "🔍" : "👤";
      return `${emoji} <b>${playerName}</b> — ${sanitized}`;
    }
    return sanitized;
  } catch (error) {
    console.warn(
      "[ai-guzman] Individual reveal generation failed, using template:",
      error instanceof Error ? error.message : error,
    );
    return MESSAGES.ROLE_REVEAL_INDIVIDUAL(playerName, role);
  }
}

// ---------------------------------------------------------------------------
// Narrative Context Management
// ---------------------------------------------------------------------------

/**
 * Get the Guzman narrative context for a game.
 * Thin wrapper around DB client.
 */
export async function getGuzmanContext(
  gameId: string,
): Promise<GuzmanContext> {
  return dbGetGuzmanContext(gameId);
}

/**
 * Update the narrative context after a round completes.
 * Appends round summary, updates mood, and compresses older summaries
 * to keep token usage manageable.
 */
export async function updateNarrativeContext(
  gameId: string,
  roundNumber: number,
  missionTheme: string,
  outcome: "success" | "fail" | "kaos_fail",
  narrativeBeats: string,
): Promise<void> {
  const context = await dbGetGuzmanContext(gameId);

  // Append new round summary
  context.roundSummaries.push({
    round: roundNumber,
    missionTheme,
    outcome,
    narrativeBeats,
  });

  // Update mood based on latest outcome
  if (outcome === "success") {
    context.mood = context.mood === "paranoid" ? "cautiously_optimistic" : "confident";
  } else if (outcome === "kaos_fail") {
    context.mood = "furious";
  } else {
    context.mood = context.mood === "furious" ? "vengeful" : "paranoid";
  }

  // Update story arc if not set
  if (!context.storyArc) {
    context.storyArc = "Ligan kör sin första stöt -- allt hänger på förtroende";
  }

  // Compress older summaries to save tokens (keep last 3 detailed, summarize older)
  if (context.roundSummaries.length > 3) {
    const older = context.roundSummaries.slice(0, -3);
    const recent = context.roundSummaries.slice(-3);

    // Compress older rounds to just outcome
    const compressed = older.map((r) => ({
      round: r.round,
      missionTheme: r.missionTheme,
      outcome: r.outcome,
      narrativeBeats: "", // Drop detailed beats for older rounds
    }));

    context.roundSummaries = [...compressed, ...recent];
  }

  // Populate playerNotes with behavioral analysis (non-critical)
  try {
    const { playerNotes, historyUpdate } = await analyzeBehavior(gameId);
    context.playerNotes = playerNotes;
    context.behavioralHistory = historyUpdate;
  } catch (err) {
    console.warn(
      "[ai-guzman] Behavioral analysis failed, playerNotes unchanged:",
      err instanceof Error ? err.message : err,
    );
    // Non-critical: if analysis fails, playerNotes stays as-is (empty or stale)
    // Game continues normally -- CONST-04 pattern
  }

  await dbUpdateGuzmanContext(gameId, context);
}
