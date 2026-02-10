import { MESSAGES } from "../lib/messages.js";
import { getMessageQueue } from "../queue/message-queue.js";
import { getPlayerByTelegramId } from "../db/client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerInfo {
  telegramUserId: number;
  firstName?: string;
  username?: string;
}

// ---------------------------------------------------------------------------
// Pending reminder tracking
// ---------------------------------------------------------------------------

/**
 * In-memory map of active reminders, keyed by `${groupChatId}_${telegramUserId}`.
 * Cleaned up when a reminder fires or when a player completes /start.
 */
const pendingReminders = new Map<string, NodeJS.Timeout>();

function reminderKey(groupChatId: number, telegramUserId: number): string {
  return `${groupChatId}_${telegramUserId}`;
}

// ---------------------------------------------------------------------------
// 1. Deep link generation
// ---------------------------------------------------------------------------

/**
 * Generate a Telegram deep link URL that sends the user to the bot's /start
 * with a payload identifying which group chat they came from.
 *
 * Negative group chat IDs (standard for groups/supergroups) get the minus sign
 * replaced with an "n" prefix so the payload stays within Telegram's allowed
 * characters (A-Z, a-z, 0-9, _, -).
 *
 * Example: generateDeepLink("golare_bot", -1234567) => "https://t.me/golare_bot?start=g_n1234567"
 */
export function generateDeepLink(
  botUsername: string,
  groupChatId: number,
): string {
  const encodedId =
    groupChatId < 0 ? `n${Math.abs(groupChatId)}` : String(groupChatId);
  return `https://t.me/${botUsername}?start=g_${encodedId}`;
}

/**
 * Parse a deep link payload back into a group chat ID.
 * Returns null if the payload doesn't match the expected format.
 *
 * Example: parseDeepLinkPayload("g_n1234567") => -1234567
 */
export function parseDeepLinkPayload(payload: string): number | null {
  const match = payload.match(/^g_(n?)(\d+)$/);
  if (!match) return null;
  const [, negative, digits] = match;
  const chatId = Number(digits);
  return negative === "n" ? -chatId : chatId;
}

// ---------------------------------------------------------------------------
// 2. Player callout in group
// ---------------------------------------------------------------------------

/**
 * Send a personalized message in the group calling out an unregistered player
 * and providing them a deep link to /start the bot.
 *
 * Uses the player's firstName (preferred) or username for addressing.
 * Message goes through the MessageQueue for rate limiting.
 */
export async function callOutPlayer(
  groupChatId: number,
  player: PlayerInfo,
  botUsername: string,
): Promise<void> {
  const name = player.firstName || player.username || "kompansen";
  const link = generateDeepLink(botUsername, groupChatId);
  const text = MESSAGES.DM_CALLOUT(name, link);

  const queue = getMessageQueue();
  await queue.send(groupChatId, text);
}

// ---------------------------------------------------------------------------
// 3. Registration announcement
// ---------------------------------------------------------------------------

/**
 * Announce in the group that a player has successfully registered
 * (completed /start via deep link).
 *
 * Message goes through the MessageQueue for rate limiting.
 */
export async function announceRegistration(
  groupChatId: number,
  playerName: string,
): Promise<void> {
  const text = MESSAGES.REGISTRATION_CONFIRMED_GROUP(playerName);

  const queue = getMessageQueue();
  await queue.send(groupChatId, text);
}

// ---------------------------------------------------------------------------
// 4. Reminder timeout
// ---------------------------------------------------------------------------

const DEFAULT_REMINDER_DELAY_MS = 300_000; // 5 minutes

/**
 * Schedule a follow-up reminder in the group for a player who hasn't
 * completed /start yet. After the delay, checks the database -- if the
 * player is still unregistered, sends MESSAGES.DM_REMINDER; if they've
 * registered in the meantime, does nothing.
 *
 * Returns the timeout handle for external cancellation.
 * Also tracked in the internal pendingReminders map.
 */
export function scheduleReminder(
  groupChatId: number,
  player: PlayerInfo,
  botUsername: string,
  delayMs: number = DEFAULT_REMINDER_DELAY_MS,
): NodeJS.Timeout {
  const key = reminderKey(groupChatId, player.telegramUserId);

  // Cancel any existing reminder for this player in this group
  const existing = pendingReminders.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingReminders.delete(key);
  }

  const handle = setTimeout(async () => {
    pendingReminders.delete(key);

    try {
      // Check if the player has registered since the callout
      const registered = await getPlayerByTelegramId(player.telegramUserId);
      if (registered) {
        // They completed /start -- no reminder needed
        return;
      }

      // Still unregistered -- send reminder
      const name = player.firstName || player.username || "kompansen";
      const link = generateDeepLink(botUsername, groupChatId);
      const text = MESSAGES.DM_REMINDER(name, link);

      const queue = getMessageQueue();
      await queue.send(groupChatId, text);
    } catch (error) {
      console.error(
        `[dm-flow] Reminder failed for player ${player.telegramUserId} in chat ${groupChatId}:`,
        error,
      );
    }
  }, delayMs);

  pendingReminders.set(key, handle);
  return handle;
}

/**
 * Cancel a reminder by its timeout handle.
 */
export function cancelReminder(timeoutHandle: NodeJS.Timeout): void {
  clearTimeout(timeoutHandle);
}

// ---------------------------------------------------------------------------
// 5. Pending callout tracking
// ---------------------------------------------------------------------------

/**
 * Cancel the pending reminder for a specific player in a specific group.
 * Called when a player completes /start via deep link so we don't send
 * a stale reminder.
 */
export function cancelPlayerReminder(
  groupChatId: number,
  telegramUserId: number,
): void {
  const key = reminderKey(groupChatId, telegramUserId);
  const handle = pendingReminders.get(key);
  if (handle) {
    clearTimeout(handle);
    pendingReminders.delete(key);
  }
}
