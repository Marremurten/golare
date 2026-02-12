import type { Bot } from "grammy";
import type { Message } from "grammy/types";

const DELAY_WARNING_MS = 5000;

interface QueuedMessage {
  chatId: number;
  text: string;
  options?: Record<string, unknown>;
  resolve: (result: Message.TextMessage) => void;
  reject: (error: unknown) => void;
  enqueuedAt: number;
}

/**
 * Per-chat rate-limited message queue.
 *
 * Every outbound group message flows through this queue to respect
 * Telegram's 20 msg/min per-group rate limit (3-second spacing).
 * Each chat_id gets its own independent FIFO queue.
 */
export class MessageQueue {
  private readonly bot: Bot;
  private readonly minIntervalMs: number;
  private readonly queues = new Map<number, QueuedMessage[]>();
  private readonly processing = new Set<number>();

  constructor(bot: Bot, options?: { minIntervalMs?: number }) {
    this.bot = bot;
    this.minIntervalMs = options?.minIntervalMs ?? 3000;
  }

  /**
   * Enqueue a message and return a promise that resolves when the message
   * is actually sent via the Telegram API (not just enqueued).
   */
  async send(
    chatId: number,
    text: string,
    options?: Record<string, unknown>,
  ): Promise<Message.TextMessage> {
    return new Promise<Message.TextMessage>((resolve, reject) => {
      const msg: QueuedMessage = {
        chatId,
        text,
        options,
        resolve,
        reject,
        enqueuedAt: Date.now(),
      };

      if (!this.queues.has(chatId)) {
        this.queues.set(chatId, []);
      }
      this.queues.get(chatId)!.push(msg);

      // Kick off processing if not already running for this chat
      if (!this.processing.has(chatId)) {
        this.processQueue(chatId);
      }
    });
  }

  /**
   * Number of messages waiting in the queue for a specific chat.
   */
  getQueueLength(chatId: number): number {
    return this.queues.get(chatId)?.length ?? 0;
  }

  /**
   * Estimated wait time in ms for the next message in a chat's queue.
   * Based on queue length * minIntervalMs.
   */
  getDelay(chatId: number): number {
    const length = this.getQueueLength(chatId);
    return length * this.minIntervalMs;
  }

  /**
   * Returns true if the oldest queued message for a chat has been
   * waiting longer than the delay warning threshold (5 seconds).
   */
  isDelayed(chatId: number): boolean {
    const queue = this.queues.get(chatId);
    if (!queue || queue.length === 0) return false;
    return Date.now() - queue[0].enqueuedAt > DELAY_WARNING_MS;
  }

  /**
   * Pin a message in a chat. Silently fails if the bot lacks permissions.
   */
  async pinMessage(chatId: number, messageId: number): Promise<void> {
    try {
      await this.bot.api.pinChatMessage(chatId, messageId, {
        disable_notification: true,
      });
    } catch (err) {
      console.warn(
        `[MessageQueue] Failed to pin message ${messageId} in chat ${chatId}:`,
        err,
      );
    }
  }

  /**
   * Unpin a specific message in a chat. Silently fails if the bot lacks permissions.
   */
  async unpinMessage(chatId: number, messageId: number): Promise<void> {
    try {
      await this.bot.api.unpinChatMessage(chatId, messageId);
    } catch (err) {
      console.warn(
        `[MessageQueue] Failed to unpin message ${messageId} in chat ${chatId}:`,
        err,
      );
    }
  }

  /**
   * Process queued messages for a single chat, one at a time,
   * with minIntervalMs spacing between sends.
   */
  private async processQueue(chatId: number): Promise<void> {
    if (this.processing.has(chatId)) return;
    this.processing.add(chatId);

    const queue = this.queues.get(chatId);

    while (queue && queue.length > 0) {
      const msg = queue.shift()!;
      const waitedMs = Date.now() - msg.enqueuedAt;

      if (waitedMs > DELAY_WARNING_MS) {
        console.warn(
          `[MessageQueue] Message to chat ${chatId} waited ${waitedMs}ms in queue`,
        );
      }

      try {
        const result = await this.bot.api.sendMessage(
          chatId,
          msg.text,
          msg.options as any,
        );
        msg.resolve(result);
      } catch (error: unknown) {
        // 429 errors should be handled by auto-retry plugin,
        // but if one slips through, wait and retry once
        if (is429Error(error)) {
          const retryAfterMs = getRetryAfter(error) * 1000 || this.minIntervalMs;
          console.warn(
            `[MessageQueue] 429 for chat ${chatId}, retrying after ${retryAfterMs}ms`,
          );
          await sleep(retryAfterMs);

          try {
            const result = await this.bot.api.sendMessage(
              chatId,
              msg.text,
              msg.options as any,
            );
            msg.resolve(result);
          } catch (retryError: unknown) {
            msg.reject(retryError);
          }
        } else {
          // Non-429 error: reject this message but continue processing queue
          msg.reject(error);
        }
      }

      // Wait minimum interval before sending next message to this chat
      if (queue.length > 0) {
        await sleep(this.minIntervalMs);
      }
    }

    // Queue empty -- clean up
    this.processing.delete(chatId);
    this.queues.delete(chatId);
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let instance: MessageQueue | null = null;

/**
 * Create the global MessageQueue instance. Called once during bot startup.
 */
export function createMessageQueue(
  bot: Bot,
  options?: { minIntervalMs?: number },
): MessageQueue {
  instance = new MessageQueue(bot, options);
  return instance;
}

/**
 * Get the global MessageQueue instance. Throws if not yet initialized.
 */
export function getMessageQueue(): MessageQueue {
  if (!instance) {
    throw new Error(
      "MessageQueue not initialized -- call createMessageQueue first",
    );
  }
  return instance;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function is429Error(error: unknown): boolean {
  if (error && typeof error === "object" && "error_code" in error) {
    return (error as { error_code: number }).error_code === 429;
  }
  return false;
}

function getRetryAfter(error: unknown): number {
  if (
    error &&
    typeof error === "object" &&
    "parameters" in error &&
    typeof (error as any).parameters === "object" &&
    (error as any).parameters !== null &&
    "retry_after" in (error as any).parameters
  ) {
    return Number((error as any).parameters.retry_after) || 0;
  }
  return 0;
}
