import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { config } from "./config.js";

export const bot = new Bot(config.BOT_TOKEN);

// Rate limiting: throttle outgoing API calls to stay within Telegram limits
bot.api.config.use(apiThrottler());

// Auto-retry: retry failed API calls with exponential backoff
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 60 }));

// Global error handler
bot.catch((err) => {
  console.error("Bot error:", err.message);
  console.error("Context:", err.ctx?.update?.update_id);
});

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down...");
  bot.stop();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// Start the bot with long polling
await bot.start({ onStart: () => console.log("Golare bot startad!") });
