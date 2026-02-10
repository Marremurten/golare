import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getAIClient, MODEL_MAP } from "./ai-client.js";
import {
  buildGuzmanSystemPrompt,
  buildMissionPrompt,
  buildResultPrompt,
  buildWhisperPrompt,
  buildGapFillPrompt,
} from "./ai-prompts.js";
import { MESSAGES } from "./messages.js";
import {
  getGuzmanContext as dbGetGuzmanContext,
  updateGuzmanContext as dbUpdateGuzmanContext,
} from "../db/client.js";
import type { GuzmanContext, TruthLevel } from "../db/types.js";

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
  truth_level: z.enum(["truth", "half_truth", "lie"]),
  message: z.string(),
});

/**
 * Generate a whisper (manipulative DM) message for a player.
 * Returns null on any failure -- whispers are optional.
 */
export async function generateWhisperMessage(
  gameContext: GuzmanContext,
  targetPlayerName: string,
  otherPlayerNames: string[],
  roundEvents: string,
): Promise<{ message: string; truthLevel: TruthLevel } | null> {
  try {
    const client = getAIClient();
    if (!client) {
      return null;
    }

    const response = await client.chat.completions.parse({
      model: MODEL_MAP.whisper,
      messages: [
        { role: "system", content: buildGuzmanSystemPrompt() },
        {
          role: "user",
          content: buildWhisperPrompt(
            gameContext,
            targetPlayerName,
            otherPlayerNames,
            roundEvents,
          ),
        },
      ],
      max_tokens: 400,
      temperature: 1.0,
      response_format: zodResponseFormat(WhisperResponseSchema, "whisper"),
    });

    const parsed = response.choices[0]?.message?.parsed;
    if (!parsed) {
      console.warn(
        "[ai-guzman] Empty response for whisper, skipping",
      );
      return null;
    }

    return {
      message: sanitizeForTelegram(parsed.message),
      truthLevel: parsed.truth_level,
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

  await dbUpdateGuzmanContext(gameId, context);
}
