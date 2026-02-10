import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { config } from "./config.js";
import { createMessageQueue } from "./queue/message-queue.js";
import { startHandler } from "./handlers/start.js";
import { lobbyHandler } from "./handlers/lobby.js";

// 1. Create bot instance
export const bot = new Bot(config.BOT_TOKEN);

// 2. Plugin registration: rate limiting and auto-retry
bot.api.config.use(apiThrottler());
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 60 }));

// 3. Initialize message queue (singleton -- available app-wide via getMessageQueue())
createMessageQueue(bot);

// 4. Register handlers
bot.use(startHandler);
bot.use(lobbyHandler);

// 5. Global error handler
bot.catch((err) => {
  console.error("Bot error:", err.message);
  console.error("Context:", err.ctx?.update?.update_id);
});

// 6. Graceful shutdown
const shutdown = () => {
  console.log("Shutting down...");
  bot.stop();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// 7. Start the bot with long polling
await bot.start({
  onStart: () => {
    console.log("Golare bot startad!");
    console.log(`Bot username: @${bot.botInfo.username}`);
  },
});
