import OpenAI from "openai";
import { config } from "../config.js";

/** Message generation tier -- determines which model to use */
export type MessageTier = "narrative" | "commentary" | "whisper";

/** Model mapping per tier: balance quality vs cost */
export const MODEL_MAP: Record<MessageTier, string> = {
  narrative: "gpt-4o-mini",   // missions, reveals -- need quality
  commentary: "gpt-4.1-nano", // gap-fill, reactions -- speed + cheapness
  whisper: "gpt-4o-mini",     // manipulation needs subtlety
} as const;

let client: OpenAI | null = null;
let initialized = false;

/**
 * Get the OpenAI client singleton.
 * Returns null if OPENAI_API_KEY is not configured -- the game will
 * fall back to template messages in that case.
 */
export function getAIClient(): OpenAI | null {
  if (initialized) return client;
  initialized = true;

  if (!config.OPENAI_API_KEY) {
    console.log(
      "[ai-client] No OPENAI_API_KEY -- AI features disabled, using templates"
    );
    return null;
  }

  client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    timeout: 10_000,
    maxRetries: 1,
  });

  console.log("[ai-client] OpenAI client initialized");
  return client;
}
