import { Composer, InlineKeyboard } from "grammy";
import { registerPlayer, getPlayerByTelegramId } from "../db/client.js";
import { MESSAGES } from "../lib/messages.js";
import { getRandomError } from "../lib/errors.js";
import {
  parseDeepLinkPayload,
  announceRegistration,
  cancelPlayerReminder,
} from "./dm-flow.js";

/**
 * /start command handler with deep link detection.
 *
 * Handles three flows:
 * 1. Direct /start in private chat -- registers player, sends welcome
 * 2. Deep link /start (payload "g_*") -- registers, sends group-aware welcome, announces in group
 * 3. Already-registered /start -- acknowledges without duplicating
 */
export const startHandler = new Composer();

const rulesKeyboard = new InlineKeyboard().text("Regler \u{1F4D6}", "show_rules");

startHandler.command("start", async (ctx) => {
  // Only handle /start in private chats
  if (ctx.chat.type !== "private") return;

  // Defensive guard: ctx.from should always exist in private chat, but be safe
  if (!ctx.from) return;

  const payload = ctx.match; // deep link payload (empty string if direct /start)

  // --- Deep link detection ---
  let groupChatId: number | null = null;
  if (payload && payload.startsWith("g_")) {
    groupChatId = parseDeepLinkPayload(payload);
  }

  // --- Check existing registration ---
  try {
    const existing = await getPlayerByTelegramId(ctx.from.id);
    if (existing) {
      await ctx.reply(MESSAGES.WELCOME_ALREADY_REGISTERED, {
        reply_markup: rulesKeyboard,
      });

      // If deep link AND already registered, still announce in group
      // (player may have /start'd directly before and is now clicking the deep link)
      if (groupChatId !== null) {
        const name = ctx.from.first_name || ctx.from.username || "Okänd";
        await announceRegistration(groupChatId, name);
        cancelPlayerReminder(groupChatId, ctx.from.id);
      }

      return;
    }
  } catch (lookupError) {
    console.error("[start] Failed to check existing player:", lookupError);
    // Fall through to attempt registration anyway
  }

  // --- Register new player ---
  try {
    await registerPlayer(
      ctx.from.id,
      ctx.chat.id,
      ctx.from.username,
      ctx.from.first_name,
    );

    if (groupChatId !== null) {
      // Deep link flow: group-aware welcome + announce in group
      await ctx.reply(MESSAGES.WELCOME_DEEP_LINK(), {
        reply_markup: rulesKeyboard,
      });

      const name = ctx.from.first_name || ctx.from.username || "Okänd";
      await announceRegistration(groupChatId, name);
      cancelPlayerReminder(groupChatId, ctx.from.id);
    } else {
      // Direct /start: standard welcome
      await ctx.reply(MESSAGES.WELCOME_DIRECT, {
        reply_markup: rulesKeyboard,
      });
    }
  } catch (registrationError) {
    console.error("[start] Registration failed:", registrationError);
    await ctx.reply(getRandomError("START_FAILED"));
  }
});

// --- Handle "Regler" inline button ---
startHandler.callbackQuery("show_rules", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Reglerna kommer snart, bre! \u{1F51C}");
});
