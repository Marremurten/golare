/**
 * Game loop handler: mission posting, Capo nomination, and team voting.
 *
 * Scheduler handler functions (wired into bot.ts):
 *   - handleMissionPost (09:00)
 *   - handleNominationReminder (11:00)
 *   - handleNominationDeadline (12:00)
 *   - handleVotingReminder (14:00)
 *   - handleVotingDeadline (15:00)
 *
 * Callback handlers (on the Composer):
 *   - nt:{roundId}:{playerIndex} -- nomination toggle
 *   - nc:{roundId} -- nomination confirm
 *   - vj:{roundId} -- vote JA
 *   - vn:{roundId} -- vote NEJ
 */

import { Composer, InlineKeyboard } from "grammy";
import type { Bot, Context } from "grammy";
import {
  getAllActiveGames,
  getCurrentRound,
  createRound,
  updateRound,
  updateGame,
  getGameById as getGameByIdDb,
  getGamePlayersOrdered,
  getGamePlayersOrderedWithInfo,
  getGamePlayerByTelegramId,
  castVote,
  getVotesForRound,
  getRoundById,
  deleteVotesForRound,
} from "../db/client.js";
import type { Game, GamePlayer, Player, Round } from "../db/types.js";
import {
  nextRoundPhase,
  getCapoIndex,
  computeVoteResult,
  getTeamSize,
} from "../lib/game-state.js";
import { MESSAGES } from "../lib/messages.js";
import { getMessageQueue } from "../queue/message-queue.js";
import type { ScheduleHandlers } from "../lib/scheduler.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Player with joined player info (name, dm_chat_id) */
type OrderedPlayerWithInfo = GamePlayer & { players: Player };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a display name for a player (prefer username, fallback to first_name).
 */
function displayName(player: Player): string {
  if (player.username) return `@${player.username}`;
  if (player.first_name) return player.first_name;
  return "Okänd";
}

/**
 * Check if an error is the benign "message is not modified" Telegram error.
 */
function isMessageNotModifiedError(err: unknown): boolean {
  if (err && typeof err === "object" && "description" in err) {
    return String((err as { description: string }).description).includes(
      "message is not modified",
    );
  }
  return false;
}

/**
 * Build the toggleable nomination keyboard.
 * Each player shown as "[ ] Name" or "[x] Name". Confirm button shown
 * only when the correct team size is selected.
 */
function buildNominationKeyboard(
  roundId: string,
  players: OrderedPlayerWithInfo[],
  selectedIndices: Set<number>,
  teamSize: number,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < players.length; i++) {
    const name = displayName(players[i].players);
    const isSelected = selectedIndices.has(i);
    const label = isSelected ? `[x] ${name}` : `[ ] ${name}`;
    kb.text(label, `nt:${roundId}:${i}`).row();
  }
  if (selectedIndices.size === teamSize) {
    kb.text("Bekräfta team! ✅", `nc:${roundId}`);
  }
  return kb;
}

/**
 * Build the voting keyboard with JA and NEJ buttons.
 */
function buildVoteKeyboard(roundId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("JA 👍", `vj:${roundId}`)
    .text("NEJ 👎", `vn:${roundId}`);
}

/**
 * Resolve the list of selected team player indices into player IDs.
 */
function resolveTeamPlayerIds(
  players: OrderedPlayerWithInfo[],
  selectedIndices: Set<number>,
): string[] {
  return Array.from(selectedIndices).map((i) => players[i].id);
}

/**
 * Parse team_player_ids from a round back into player indices for the keyboard.
 */
function getSelectedIndices(
  players: OrderedPlayerWithInfo[],
  teamPlayerIds: string[],
): Set<number> {
  const idSet = new Set(teamPlayerIds);
  const indices = new Set<number>();
  for (let i = 0; i < players.length; i++) {
    if (idSet.has(players[i].id)) {
      indices.add(i);
    }
  }
  return indices;
}

/**
 * Safely edit a message, ignoring "message is not modified" errors.
 */
async function safeEditMessage(
  bot: Bot,
  chatId: number,
  messageId: number,
  text: string,
  options?: { reply_markup?: InlineKeyboard; parse_mode?: "HTML" | "MarkdownV2" | "Markdown" },
): Promise<void> {
  try {
    await bot.api.editMessageText(chatId, messageId, text, options);
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.error("[game-loop] editMessageText failed:", err);
    }
  }
}

/**
 * Handle Kaos-mataren auto-fail: mission auto-fails, Golare get a point.
 * Does not require a Bot instance -- uses MessageQueue for all sends.
 */
async function handleKaosFail(
  game: Game,
  round: Round,
): Promise<void> {
  const queue = getMessageQueue();

  // Send KAOS_TRIGGERED message
  await queue.send(game.group_chat_id, MESSAGES.KAOS_TRIGGERED, {
    parse_mode: "HTML",
  });

  // Update round: mission auto-fails, aina scores
  const newPhase = nextRoundPhase(round.phase, "kaos_triggered");
  await updateRound(round.id, {
    phase: newPhase,
    mission_result: "kaos_fail",
    ligan_point: false,
  });

  // Update game score
  const newAinaScore = game.aina_score + 1;
  await updateGame(game.id, { aina_score: newAinaScore });

  // Send score update
  await queue.send(
    game.group_chat_id,
    MESSAGES.SCORE_UPDATE(game.ligan_score, newAinaScore, round.round_number),
    { parse_mode: "HTML" },
  );
}

/**
 * Rotate the Capo to the next player after a failed vote.
 * Returns the new Capo's display name.
 */
async function rotateCapo(
  round: Round,
  players: OrderedPlayerWithInfo[],
  newFailedVotes: number,
): Promise<{ newCapoName: string; newCapoPlayerId: string }> {
  const newCapoIndex = getCapoIndex(
    players.length,
    round.round_number,
    newFailedVotes,
  );
  const newCapo = players[newCapoIndex];
  const newCapoName = displayName(newCapo.players);

  await updateRound(round.id, {
    capo_player_id: newCapo.id,
    consecutive_failed_votes: newFailedVotes,
    phase: "nomination",
    team_player_ids: [], // Clear previous nomination
  });

  return { newCapoName, newCapoPlayerId: newCapo.id };
}

/**
 * Resolve the vote for a round. Reveals all votes, determines result,
 * and handles Capo rotation or phase transition.
 * Used by the scheduler (bot.api) for deadline-based resolution.
 */
async function resolveVote(
  bot: Bot,
  game: Game,
  round: Round,
  players: OrderedPlayerWithInfo[],
): Promise<void> {
  const queue = getMessageQueue();
  const votes = await getVotesForRound(round.id);
  const result = computeVoteResult(votes, players.length);

  // Build vote reveal with player names
  const voteRevealData = votes.map((v) => {
    const gp = players.find((p) => p.id === v.game_player_id);
    const name = gp ? displayName(gp.players) : "Okänd";
    return { name, vote: v.vote };
  });

  // Send reveal as new message (deadline path -- safer than editing old messages)
  const revealText = MESSAGES.VOTE_REVEAL(voteRevealData);
  if (round.vote_message_id) {
    await safeEditMessage(bot, game.group_chat_id, round.vote_message_id, revealText, {
      parse_mode: "HTML",
    });
  } else {
    await queue.send(game.group_chat_id, revealText, { parse_mode: "HTML" });
  }

  await handleVoteResult(result, game, round, players);
}

/**
 * Common vote result handling for both scheduler and callback contexts.
 */
async function handleVoteResult(
  result: { approved: boolean; jaCount: number; nejCount: number; abstainCount: number },
  game: Game,
  round: Round,
  players: OrderedPlayerWithInfo[],
): Promise<void> {
  const queue = getMessageQueue();

  if (result.approved) {
    // Vote approved -- transition to execution phase
    const newPhase = nextRoundPhase("voting", "vote_approved");
    await updateRound(round.id, { phase: newPhase });

    const teamNames = round.team_player_ids.map((id) => {
      const gp = players.find((p) => p.id === id);
      return gp ? displayName(gp.players) : "Okänd";
    });

    await queue.send(
      game.group_chat_id,
      MESSAGES.VOTE_APPROVED(teamNames),
      { parse_mode: "HTML" },
    );
  } else {
    // Vote rejected
    const newFailedVotes = round.consecutive_failed_votes + 1;

    // Send Kaos warnings based on escalation
    if (newFailedVotes === 1) {
      await queue.send(game.group_chat_id, MESSAGES.KAOS_WARNING_1, {
        parse_mode: "HTML",
      });
    } else if (newFailedVotes === 2) {
      await queue.send(game.group_chat_id, MESSAGES.KAOS_WARNING_2, {
        parse_mode: "HTML",
      });
    }

    if (newFailedVotes >= 3) {
      // Kaos-mataren: auto-fail
      await updateRound(round.id, { consecutive_failed_votes: newFailedVotes });
      await handleKaosFail(game, {
        ...round,
        consecutive_failed_votes: newFailedVotes,
      });
    } else {
      // Rotate Capo and go back to nomination
      const { newCapoName } = await rotateCapo(round, players, newFailedVotes);

      await queue.send(
        game.group_chat_id,
        MESSAGES.VOTE_REJECTED(result.nejCount, newCapoName, newFailedVotes),
        { parse_mode: "HTML" },
      );

      // Delete old votes so the new vote cycle starts fresh
      await deleteVotesForRound(round.id);

      // Send new nomination prompt to the new Capo
      const teamSize = game.team_size ?? getTeamSize(players.length);
      const nominationText = MESSAGES.NOMINATION_PROMPT(newCapoName, teamSize);
      const nominationKb = buildNominationKeyboard(
        round.id,
        players,
        new Set(),
        teamSize,
      );

      const nomMsg = await queue.send(
        game.group_chat_id,
        nominationText,
        { parse_mode: "HTML", reply_markup: nominationKb },
      );

      await updateRound(round.id, { nomination_message_id: nomMsg.message_id });
    }
  }
}

// ---------------------------------------------------------------------------
// Composer (callback handlers)
// ---------------------------------------------------------------------------

export const gameLoopHandler = new Composer();

// ---------------------------------------------------------------------------
// Nomination toggle: nt:{roundId}:{playerIndex}
// ---------------------------------------------------------------------------

gameLoopHandler.callbackQuery(/^nt:(.+):(\d+)$/, async (ctx) => {
  if (!ctx.from) return;

  try {
    const roundId = ctx.match[1];
    const playerIndex = parseInt(ctx.match[2], 10);

    // Get round
    const round = await getCurrentRoundById(roundId);
    if (!round || round.phase !== "nomination") {
      await ctx.answerCallbackQuery({ text: "Nomineringen är inte aktiv." });
      return;
    }

    // Get game and ordered players
    const players = await getGamePlayersOrderedWithInfo(round.game_id);

    // Verify the person clicking is the Capo
    const capoPlayer = players.find((p) => p.id === round.capo_player_id);
    if (!capoPlayer || capoPlayer.players.telegram_user_id !== ctx.from.id) {
      await ctx.answerCallbackQuery({
        text: "Bara Capo kan välja team, bre.",
        show_alert: true,
      });
      return;
    }

    // Validate player index
    if (playerIndex < 0 || playerIndex >= players.length) {
      await ctx.answerCallbackQuery({ text: "Ogiltig spelare." });
      return;
    }

    // Toggle player in/out of team
    const currentSelected = getSelectedIndices(players, round.team_player_ids);
    const teamSize = (await getGameById(round.game_id))?.team_size ?? getTeamSize(players.length);

    if (currentSelected.has(playerIndex)) {
      currentSelected.delete(playerIndex);
    } else {
      // Don't allow selecting more than team size
      if (currentSelected.size >= teamSize) {
        await ctx.answerCallbackQuery({
          text: `Max ${teamSize} spelare, bre. Ta bort någon först.`,
        });
        return;
      }
      currentSelected.add(playerIndex);
    }

    // Update team_player_ids in DB
    const newTeamIds = resolveTeamPlayerIds(players, currentSelected);
    await updateRound(round.id, { team_player_ids: newTeamIds });

    // Rebuild keyboard and edit message
    const kb = buildNominationKeyboard(round.id, players, currentSelected, teamSize);

    try {
      await ctx.editMessageReplyMarkup({ reply_markup: kb });
    } catch (editErr) {
      if (!isMessageNotModifiedError(editErr)) throw editErr;
    }

    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error("[game-loop] nomination toggle failed:", error);
    await ctx.answerCallbackQuery({ text: "Något gick fel, bre." });
  }
});

// ---------------------------------------------------------------------------
// Nomination confirm: nc:{roundId}
// ---------------------------------------------------------------------------

gameLoopHandler.callbackQuery(/^nc:(.+)$/, async (ctx) => {
  if (!ctx.from) return;

  try {
    const roundId = ctx.match[1];

    // Get round
    const round = await getCurrentRoundById(roundId);
    if (!round || round.phase !== "nomination") {
      await ctx.answerCallbackQuery({ text: "Nomineringen är inte aktiv." });
      return;
    }

    // Get game and ordered players
    const players = await getGamePlayersOrderedWithInfo(round.game_id);

    // Verify the person clicking is the Capo
    const capoPlayer = players.find((p) => p.id === round.capo_player_id);
    if (!capoPlayer || capoPlayer.players.telegram_user_id !== ctx.from.id) {
      await ctx.answerCallbackQuery({
        text: "Bara Capo kan välja team, bre.",
        show_alert: true,
      });
      return;
    }

    // Verify team size
    const game = await getGameById(round.game_id);
    if (!game) return;
    const teamSize = game.team_size ?? getTeamSize(players.length);

    if (round.team_player_ids.length !== teamSize) {
      await ctx.answerCallbackQuery({
        text: `Du måste välja exakt ${teamSize} spelare, bre.`,
        show_alert: true,
      });
      return;
    }

    // Transition to voting phase
    const newPhase = nextRoundPhase("nomination", "nomination_submitted");
    await updateRound(round.id, { phase: newPhase });

    // Build team names
    const teamNames = round.team_player_ids.map((id) => {
      const gp = players.find((p) => p.id === id);
      return gp ? displayName(gp.players) : "Okänd";
    });

    const capoName = displayName(capoPlayer.players);
    const queue = getMessageQueue();

    // Send TEAM_PROPOSED to group
    await queue.send(
      game.group_chat_id,
      MESSAGES.TEAM_PROPOSED(capoName, teamNames),
      { parse_mode: "HTML" },
    );

    // Send VOTE_PROMPT with keyboard to group
    const voteKb = buildVoteKeyboard(round.id);
    const voteMsg = await queue.send(
      game.group_chat_id,
      MESSAGES.VOTE_PROMPT(teamNames),
      { parse_mode: "HTML", reply_markup: voteKb },
    );

    // Store vote_message_id
    await updateRound(round.id, { vote_message_id: voteMsg.message_id });

    // Edit nomination message to remove buttons
    try {
      await ctx.editMessageText(
        MESSAGES.NOMINATION_PROMPT(capoName, teamSize) +
          "\n\nTeam valt: " + teamNames.join(", ") + " ✅",
        { parse_mode: "HTML" },
      );
    } catch (editErr) {
      if (!isMessageNotModifiedError(editErr)) throw editErr;
    }

    await ctx.answerCallbackQuery({ text: "Team bekräftat!" });

    console.log(
      `[game-loop] Capo ${capoName} confirmed team for round ${round.round_number} in game ${game.id}`,
    );
  } catch (error) {
    console.error("[game-loop] nomination confirm failed:", error);
    await ctx.answerCallbackQuery({ text: "Något gick fel, bre." });
  }
});

// ---------------------------------------------------------------------------
// Vote JA: vj:{roundId}
// ---------------------------------------------------------------------------

gameLoopHandler.callbackQuery(/^vj:(.+)$/, async (ctx) => {
  await handleVoteCallback(ctx, "ja");
});

// ---------------------------------------------------------------------------
// Vote NEJ: vn:{roundId}
// ---------------------------------------------------------------------------

gameLoopHandler.callbackQuery(/^vn:(.+)$/, async (ctx) => {
  await handleVoteCallback(ctx, "nej");
});

/**
 * Shared vote callback handler for JA and NEJ.
 */
async function handleVoteCallback(
  ctx: Context,
  vote: "ja" | "nej",
): Promise<void> {
  if (!ctx.from || !ctx.match) return;

  try {
    const roundId = (ctx.match as RegExpMatchArray)[1];

    // Get round
    const round = await getCurrentRoundById(roundId);
    if (!round || round.phase !== "voting") {
      await ctx.answerCallbackQuery({ text: "Röstningen är inte aktiv." });
      return;
    }

    // Get the player in this game
    const gamePlayer = await getGamePlayerByTelegramId(
      round.game_id,
      ctx.from.id,
    );
    if (!gamePlayer) {
      await ctx.answerCallbackQuery({
        text: "Du är inte med i det här spelet, bre.",
        show_alert: true,
      });
      return;
    }

    // Cast vote (upsert handles double-click)
    await castVote(round.id, gamePlayer.id, vote);

    // Get all players and current votes for tally update
    const players = await getGamePlayersOrderedWithInfo(round.game_id);
    const allVotes = await getVotesForRound(round.id);

    // Build tally: show who has voted (not how)
    const votedNames = allVotes.map((v) => {
      const gp = players.find((p) => p.id === v.game_player_id);
      return gp ? displayName(gp.players) : "Okänd";
    });

    const tallyText = MESSAGES.VOTE_TALLY(votedNames, players.length);

    // Update vote message tally
    if (round.vote_message_id && ctx.callbackQuery?.message) {
      try {
        const voteKb = buildVoteKeyboard(round.id);
        await ctx.editMessageText(tallyText, {
          parse_mode: "HTML",
          reply_markup: voteKb,
        });
      } catch (editErr) {
        if (!isMessageNotModifiedError(editErr)) {
          console.error("[game-loop] vote tally edit failed:", editErr);
        }
      }
    }

    await ctx.answerCallbackQuery({ text: "Röstat!" });

    // Check if all players have voted -- resolve immediately
    if (allVotes.length >= players.length) {
      // Need the bot instance for resolveVote -- get game first
      const game = await getGameById(round.game_id);
      if (game) {
        // We need the bot instance here. Since we're in a Composer callback,
        // we can use ctx.api for edits. We'll wrap it.
        await resolveVoteFromCtx(ctx, game, round, players);
      }
    }
  } catch (error) {
    console.error("[game-loop] vote callback failed:", error);
    await ctx.answerCallbackQuery({ text: "Något gick fel, bre." });
  }
}

/**
 * Resolve vote from a callback context (when all players voted inline).
 * Uses ctx.api for the vote reveal edit, then delegates to shared handler.
 */
async function resolveVoteFromCtx(
  ctx: Context,
  game: Game,
  round: Round,
  players: OrderedPlayerWithInfo[],
): Promise<void> {
  const votes = await getVotesForRound(round.id);
  const result = computeVoteResult(votes, players.length);

  // Build vote reveal with player names
  const voteRevealData = votes.map((v) => {
    const gp = players.find((p) => p.id === v.game_player_id);
    const name = gp ? displayName(gp.players) : "Okänd";
    return { name, vote: v.vote };
  });

  const revealText = MESSAGES.VOTE_REVEAL(voteRevealData);

  // Edit the vote message to show results (remove buttons)
  if (round.vote_message_id) {
    try {
      await ctx.api.editMessageText(
        game.group_chat_id,
        round.vote_message_id,
        revealText,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      if (!isMessageNotModifiedError(err)) {
        console.error("[game-loop] vote reveal edit failed:", err);
      }
    }
  }

  // Delegate to shared vote result handler
  await handleVoteResult(result, game, round, players);
}

// ---------------------------------------------------------------------------
// DB helpers (thin wrappers for readability)
// ---------------------------------------------------------------------------

/**
 * Get a round by its UUID. Delegates to client.ts getRoundById.
 */
async function getCurrentRoundById(roundId: string): Promise<Round | null> {
  return getRoundById(roundId);
}

/**
 * Get a game by its ID. Delegates to client.ts getGameById.
 */
async function getGameById(gameId: string): Promise<Game | null> {
  return getGameByIdDb(gameId);
}

// ---------------------------------------------------------------------------
// Scheduler handler factory
// ---------------------------------------------------------------------------

/**
 * Create all schedule handler functions with access to the bot instance.
 * These are wired into the scheduler via bot.ts.
 */
export function createScheduleHandlers(bot: Bot): ScheduleHandlers {
  const queue = getMessageQueue();

  // -------------------------------------------------------------------------
  // 09:00 -- Mission post
  // -------------------------------------------------------------------------
  const onMissionPost = async (): Promise<void> => {
    try {
      const games = await getAllActiveGames();
      for (const game of games) {
        try {
          const currentRound = await getCurrentRound(game.id);
          let round: Round;

          if (!currentRound) {
            // First round -- create round 1
            const players = await getGamePlayersOrdered(game.id);
            if (players.length === 0) continue;

            const capoIndex = getCapoIndex(players.length, 1, 0);
            const capoPlayer = players[capoIndex];
            round = await createRound(game.id, 1, capoPlayer.id);
            await updateGame(game.id, { round: 1 });
          } else if (currentRound.phase === "reveal") {
            // Previous round complete -- create next round
            const nextRoundNum = currentRound.round_number + 1;
            if (nextRoundNum > 5) {
              console.warn(
                `[game-loop] Game ${game.id} has ${currentRound.round_number} rounds, skipping`,
              );
              continue;
            }

            const players = await getGamePlayersOrdered(game.id);
            if (players.length === 0) continue;

            const capoIndex = getCapoIndex(players.length, nextRoundNum, 0);
            const capoPlayer = players[capoIndex];
            round = await createRound(game.id, nextRoundNum, capoPlayer.id);
            await updateGame(game.id, { round: nextRoundNum });
          } else {
            // Round already in progress -- skip
            console.log(
              `[game-loop] Game ${game.id} round ${currentRound.round_number} already in phase ${currentRound.phase}, skipping mission post`,
            );
            continue;
          }

          // Send mission post
          await queue.send(
            game.group_chat_id,
            MESSAGES.MISSION_POST(round.round_number),
            { parse_mode: "HTML" },
          );

          console.log(
            `[game-loop] Mission posted for game ${game.id}, round ${round.round_number}`,
          );
        } catch (gameErr) {
          console.error(
            `[game-loop] onMissionPost failed for game ${game.id}:`,
            gameErr,
          );
        }
      }
    } catch (err) {
      console.error("[game-loop] onMissionPost failed:", err);
    }
  };

  // -------------------------------------------------------------------------
  // 11:00 -- Nomination reminder
  // -------------------------------------------------------------------------
  const onNominationReminder = async (): Promise<void> => {
    try {
      const games = await getAllActiveGames();
      for (const game of games) {
        try {
          const round = await getCurrentRound(game.id);
          if (!round || round.phase !== "mission_posted") continue;

          // Get Capo player info for DM and group message
          const players = await getGamePlayersOrderedWithInfo(game.id);
          const capoPlayer = players.find((p) => p.id === round.capo_player_id);
          if (!capoPlayer) continue;

          const capoName = displayName(capoPlayer.players);

          // Group reminder
          await queue.send(
            game.group_chat_id,
            MESSAGES.NOMINATION_REMINDER(capoName),
            { parse_mode: "HTML" },
          );

          // DM reminder to Capo
          await queue.send(
            capoPlayer.players.dm_chat_id,
            MESSAGES.NOMINATION_REMINDER_DM(capoName),
            { parse_mode: "HTML" },
          ).catch((err) => {
            console.error(
              `[game-loop] Failed to send nomination reminder DM to ${capoName}:`,
              err,
            );
          });
        } catch (gameErr) {
          console.error(
            `[game-loop] onNominationReminder failed for game ${game.id}:`,
            gameErr,
          );
        }
      }
    } catch (err) {
      console.error("[game-loop] onNominationReminder failed:", err);
    }
  };

  // -------------------------------------------------------------------------
  // 12:00 -- Nomination deadline
  // -------------------------------------------------------------------------
  const onNominationDeadline = async (): Promise<void> => {
    try {
      const games = await getAllActiveGames();
      for (const game of games) {
        try {
          const round = await getCurrentRound(game.id);
          if (!round || round.phase !== "mission_posted") continue;

          // Transition to nomination phase
          const newPhase = nextRoundPhase("mission_posted", "schedule_nomination");
          await updateRound(round.id, { phase: newPhase });

          // Get players and Capo info
          const players = await getGamePlayersOrderedWithInfo(game.id);
          const capoPlayer = players.find((p) => p.id === round.capo_player_id);
          if (!capoPlayer) continue;

          const capoName = displayName(capoPlayer.players);
          const teamSize = game.team_size ?? getTeamSize(players.length);

          // Build and send nomination keyboard
          const kb = buildNominationKeyboard(
            round.id,
            players,
            new Set(),
            teamSize,
          );

          const nomMsg = await queue.send(
            game.group_chat_id,
            MESSAGES.NOMINATION_PROMPT(capoName, teamSize),
            { parse_mode: "HTML", reply_markup: kb },
          );

          // Store nomination_message_id
          await updateRound(round.id, {
            nomination_message_id: nomMsg.message_id,
          });

          console.log(
            `[game-loop] Nomination phase started for game ${game.id}, Capo: ${capoName}`,
          );
        } catch (gameErr) {
          console.error(
            `[game-loop] onNominationDeadline failed for game ${game.id}:`,
            gameErr,
          );
        }
      }
    } catch (err) {
      console.error("[game-loop] onNominationDeadline failed:", err);
    }
  };

  // -------------------------------------------------------------------------
  // 14:00 -- Voting reminder
  // -------------------------------------------------------------------------
  const onVotingReminder = async (): Promise<void> => {
    try {
      const games = await getAllActiveGames();
      for (const game of games) {
        try {
          const round = await getCurrentRound(game.id);
          if (!round) continue;

          if (round.phase === "nomination" && round.team_player_ids.length === 0) {
            // Capo hasn't nominated yet -- send reminder
            const players = await getGamePlayersOrderedWithInfo(game.id);
            const capoPlayer = players.find(
              (p) => p.id === round.capo_player_id,
            );
            if (!capoPlayer) continue;

            const capoName = displayName(capoPlayer.players);

            await queue.send(
              game.group_chat_id,
              MESSAGES.NOMINATION_REMINDER(capoName),
              { parse_mode: "HTML" },
            );

            await queue.send(
              capoPlayer.players.dm_chat_id,
              MESSAGES.NOMINATION_REMINDER_DM(capoName),
              { parse_mode: "HTML" },
            ).catch((err) => {
              console.error(
                `[game-loop] Failed to send nomination reminder DM:`,
                err,
              );
            });
          } else if (round.phase === "voting") {
            // Voting in progress -- remind those who haven't voted
            const players = await getGamePlayersOrderedWithInfo(game.id);
            const votes = await getVotesForRound(round.id);
            const votedPlayerIds = new Set(votes.map((v) => v.game_player_id));

            for (const player of players) {
              if (votedPlayerIds.has(player.id)) continue;

              const name = displayName(player.players);

              // Group reminder
              await queue.send(
                game.group_chat_id,
                MESSAGES.VOTE_REMINDER(name),
                { parse_mode: "HTML" },
              );

              // DM reminder
              await queue.send(
                player.players.dm_chat_id,
                MESSAGES.VOTE_REMINDER_DM(name),
                { parse_mode: "HTML" },
              ).catch((err) => {
                console.error(
                  `[game-loop] Failed to send vote reminder DM to ${name}:`,
                  err,
                );
              });
            }
          }
        } catch (gameErr) {
          console.error(
            `[game-loop] onVotingReminder failed for game ${game.id}:`,
            gameErr,
          );
        }
      }
    } catch (err) {
      console.error("[game-loop] onVotingReminder failed:", err);
    }
  };

  // -------------------------------------------------------------------------
  // 15:00 -- Voting deadline
  // -------------------------------------------------------------------------
  const onVotingDeadline = async (): Promise<void> => {
    try {
      const games = await getAllActiveGames();
      for (const game of games) {
        try {
          const round = await getCurrentRound(game.id);
          if (!round) continue;

          if (round.phase === "nomination") {
            // Capo never nominated -- nomination TIMEOUT
            const players = await getGamePlayersOrderedWithInfo(game.id);
            const oldCapo = players.find(
              (p) => p.id === round.capo_player_id,
            );
            const oldCapoName = oldCapo
              ? displayName(oldCapo.players)
              : "Okänd";

            const newFailedVotes = round.consecutive_failed_votes + 1;

            if (newFailedVotes >= 3) {
              // Kaos-mataren
              await updateRound(round.id, {
                consecutive_failed_votes: newFailedVotes,
              });
              await handleKaosFail(game, {
                ...round,
                consecutive_failed_votes: newFailedVotes,
              });
            } else {
              // Rotate Capo
              const { newCapoName } = await rotateCapo(
                round,
                players,
                newFailedVotes,
              );

              await queue.send(
                game.group_chat_id,
                MESSAGES.NOMINATION_TIMEOUT(oldCapoName, newCapoName),
                { parse_mode: "HTML" },
              );

              // Send Kaos warnings
              if (newFailedVotes === 1) {
                await queue.send(
                  game.group_chat_id,
                  MESSAGES.KAOS_WARNING_1,
                  { parse_mode: "HTML" },
                );
              } else if (newFailedVotes === 2) {
                await queue.send(
                  game.group_chat_id,
                  MESSAGES.KAOS_WARNING_2,
                  { parse_mode: "HTML" },
                );
              }

              // Send new nomination prompt to the rotated Capo
              const teamSize =
                game.team_size ?? getTeamSize(players.length);
              const nominationText = MESSAGES.NOMINATION_PROMPT(
                newCapoName,
                teamSize,
              );
              const nominationKb = buildNominationKeyboard(
                round.id,
                players,
                new Set(),
                teamSize,
              );

              const nomMsg = await queue.send(
                game.group_chat_id,
                nominationText,
                { parse_mode: "HTML", reply_markup: nominationKb },
              );

              await updateRound(round.id, {
                nomination_message_id: nomMsg.message_id,
              });
            }
          } else if (round.phase === "voting") {
            // Voting deadline -- resolve the vote with whatever votes are in
            const players = await getGamePlayersOrderedWithInfo(game.id);
            await resolveVote(bot, game, round, players);
          }
        } catch (gameErr) {
          console.error(
            `[game-loop] onVotingDeadline failed for game ${game.id}:`,
            gameErr,
          );
        }
      }
    } catch (err) {
      console.error("[game-loop] onVotingDeadline failed:", err);
    }
  };

  // -------------------------------------------------------------------------
  // Execution & reveal stubs (not implemented in this plan)
  // -------------------------------------------------------------------------
  const onExecutionReminder = async (): Promise<void> => {
    console.log("[scheduler] onExecutionReminder triggered");
  };

  const onExecutionDeadline = async (): Promise<void> => {
    console.log("[scheduler] onExecutionDeadline triggered");
  };

  const onResultReveal = async (): Promise<void> => {
    console.log("[scheduler] onResultReveal triggered");
  };

  return {
    onMissionPost,
    onNominationReminder,
    onNominationDeadline,
    onVotingReminder,
    onVotingDeadline,
    onExecutionReminder,
    onExecutionDeadline,
    onResultReveal,
  };
}
