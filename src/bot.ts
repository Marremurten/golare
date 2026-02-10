import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { config } from "./config.js";
import { createMessageQueue } from "./queue/message-queue.js";
import { startHandler } from "./handlers/start.js";
import { lobbyHandler } from "./handlers/lobby.js";
import { gameCommandsHandler } from "./handlers/game-commands.js";
import {
  gameLoopHandler,
  createScheduleHandlers,
} from "./handlers/game-loop.js";
import { createDevHandler } from "./handlers/dev.js";
import {
  createWhisperHandler,
  trackGroupMessage,
} from "./handlers/whisper-handler.js";
import {
  startScheduler,
  stopScheduler,
  recoverMissedEvents,
} from "./lib/scheduler.js";
import type { ScheduleHandlers } from "./lib/scheduler.js";

// 1. Create bot instance
export const bot = new Bot(config.BOT_TOKEN);

// 2. Plugin registration: rate limiting and auto-retry
bot.api.config.use(apiThrottler());
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 60 }));

// 3. Initialize message queue (singleton -- available app-wide via getMessageQueue())
createMessageQueue(bot);

// 4. Group activity tracking middleware (for gap-fill -- must be before other handlers)
bot.on("message:text", async (ctx, next) => {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    trackGroupMessage(ctx.chat.id);
  }
  await next();
});

// 5. Register handlers
bot.use(startHandler);
bot.use(lobbyHandler);
bot.use(gameCommandsHandler);
bot.use(gameLoopHandler);

// 6. Scheduler -- combine game-loop + whisper handlers
const gameLoopScheduleHandlers = createScheduleHandlers(bot);
const whisperHandlers = createWhisperHandler(bot);
export const scheduleHandlers: ScheduleHandlers = {
  ...gameLoopScheduleHandlers,
  onWhisperAfternoon: whisperHandlers.onWhisperAfternoon,
  onWhisperEvening: whisperHandlers.onWhisperEvening,
  onGapFill: whisperHandlers.onGapFill,
};
startScheduler(scheduleHandlers);

// 6b. Dev mode -- /dev command to trigger schedule events manually
bot.use(createDevHandler(scheduleHandlers));

// 7. Global error handler
bot.catch((err) => {
  console.error("Bot error:", err.message);
  console.error("Context:", err.ctx?.update?.update_id);
});

// 8. Graceful shutdown
const shutdown = () => {
  console.log("Shutting down...");
  stopScheduler();
  bot.stop();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// 9. Start the bot with long polling
await bot.start({
  onStart: async () => {
    console.log("Golare bot startad!");
    console.log(`Bot username: @${bot.botInfo.username}`);
    // Recover any missed scheduler events after restart
    await recoverMissedEvents(scheduleHandlers);
  },
});
