import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { config } from "./config.js";
import { createMessageQueue } from "./queue/message-queue.js";
import { startHandler } from "./handlers/start.js";
import { lobbyHandler } from "./handlers/lobby.js";
import { gameCommandsHandler } from "./handlers/game-commands.js";
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

// 4. Register handlers
bot.use(startHandler);
bot.use(lobbyHandler);
bot.use(gameCommandsHandler);

// 5. Scheduler -- placeholder handlers that log events (real logic in later plans)
const scheduleHandlers: ScheduleHandlers = {
  onMissionPost: async () => {
    console.log("[scheduler] onMissionPost triggered");
  },
  onNominationReminder: async () => {
    console.log("[scheduler] onNominationReminder triggered");
  },
  onNominationDeadline: async () => {
    console.log("[scheduler] onNominationDeadline triggered");
  },
  onVotingReminder: async () => {
    console.log("[scheduler] onVotingReminder triggered");
  },
  onVotingDeadline: async () => {
    console.log("[scheduler] onVotingDeadline triggered");
  },
  onExecutionReminder: async () => {
    console.log("[scheduler] onExecutionReminder triggered");
  },
  onExecutionDeadline: async () => {
    console.log("[scheduler] onExecutionDeadline triggered");
  },
  onResultReveal: async () => {
    console.log("[scheduler] onResultReveal triggered");
  },
};

startScheduler(scheduleHandlers);

// 6. Global error handler
bot.catch((err) => {
  console.error("Bot error:", err.message);
  console.error("Context:", err.ctx?.update?.update_id);
});

// 7. Graceful shutdown
const shutdown = () => {
  console.log("Shutting down...");
  stopScheduler();
  bot.stop();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// 8. Start the bot with long polling
await bot.start({
  onStart: async () => {
    console.log("Golare bot startad!");
    console.log(`Bot username: @${bot.botInfo.username}`);
    // Recover any missed scheduler events after restart
    await recoverMissedEvents(scheduleHandlers);
  },
});
