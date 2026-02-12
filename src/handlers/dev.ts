/**
 * /dev command handler -- triggers the next game-loop event on demand.
 * Only active when config.DEV_MODE is true.
 */

import { Composer, type Context } from "grammy";
import { config } from "../config.js";
import { getActiveGame, getCurrentRound } from "../db/client.js";
import type { ScheduleHandlers } from "../lib/scheduler.js";

export function createDevHandler(scheduleHandlers: ScheduleHandlers): Composer<Context> {
  const dev = new Composer();

  if (!config.DEV_MODE) return dev;

  dev.command("dev", async (ctx) => {
    const chatId = ctx.chat.id;

    const game = await getActiveGame(chatId);
    if (!game) {
      await ctx.reply("⚡ Dev: inget aktivt spel i denna chatt.");
      return;
    }

    const round = await getCurrentRound(game.id);

    if (!round || round.phase === "reveal") {
      // No round or previous round finished -- start a new round
      await scheduleHandlers.onMissionPost();
      await ctx.reply("⚡ Dev: triggered onMissionPost");
      return;
    }

    switch (round.phase) {
      case "mission_posted":
        await scheduleHandlers.onNominationDeadline();
        await ctx.reply("⚡ Dev: triggered onNominationDeadline");
        break;

      case "nomination":
      case "voting":
        await scheduleHandlers.onVotingDeadline();
        await ctx.reply("⚡ Dev: triggered onVotingDeadline");
        break;

      case "execution":
        await scheduleHandlers.onResultReveal();
        await ctx.reply("⚡ Dev: triggered onResultReveal");
        break;

      default:
        await ctx.reply(`⚡ Dev: okänd fas "${round.phase}", vet inte vad som ska triggas.`);
    }
  });

  return dev;
}
