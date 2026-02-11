/**
 * Engagement handler: /viska (anonymous whisper) and /spana (surveillance)
 * commands for non-team players during active game rounds.
 *
 * These are the core engagement mechanics that give non-team players
 * meaningful actions between events in the async format.
 *
 * Handler registration order in this Composer:
 *   1. /viska command (DM only)
 *   2. Whisper target callback (wt:...)
 *   3. /spana command (DM only)
 *   4. Surveillance target callback (sp:...)
 *   5. Freeform text handler (MUST be LAST -- captures whisper content)
 */

import { Composer, InlineKeyboard } from "grammy";
import {
  getPlayerByTelegramId,
  getPlayerActiveGame,
  getCurrentRound,
  getGameById,
  getGamePlayersOrderedWithInfo,
  createAnonymousWhisper,
  createSurveillance,
  getSurveillanceForPlayerInRound,
} from "../db/client.js";
import {
  generateWhisperRelay,
  generateSurveillanceClue,
  getGuzmanContext,
} from "../lib/ai-guzman.js";
import { MESSAGES } from "../lib/messages.js";
import { getMessageQueue } from "../queue/message-queue.js";
import type {
  Game,
  GamePlayer,
  Player,
  Round,
  PlayerRole,
  WhisperTargetType,
} from "../db/types.js";
import { randomInt } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Player with joined player info */
type PlayerWithInfo = GamePlayer & { players: Player };

/** Pending whisper awaiting freeform text input */
type PendingWhisper = {
  gameId: string;
  gamePlayerId: string;
  groupChatId: number;
  senderRole: PlayerRole;
  target: "group" | { playerId: string; playerName: string };
  createdAt: number;
};

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

/** Pending whispers keyed by telegram_user_id */
const pendingWhispers = new Map<number, PendingWhisper>();

/** TTL for pending whisper state (5 minutes) */
const WHISPER_PENDING_TTL_MS = 5 * 60 * 1000;

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
 * Active game context lookup for engagement commands.
 * Returns the game, game player, current round, and all players -- or null.
 */
async function getActiveGameContext(
  telegramUserId: number,
): Promise<{
  game: Game;
  gamePlayer: GamePlayer;
  round: Round;
  players: PlayerWithInfo[];
} | null> {
  const player = await getPlayerByTelegramId(telegramUserId);
  if (!player) return null;

  const result = await getPlayerActiveGame(player.id);
  if (!result) return null;

  const { game, gamePlayer } = result;
  if (game.state !== "active") return null;

  const round = await getCurrentRound(game.id);
  if (!round) return null;

  const players = await getGamePlayersOrderedWithInfo(game.id);

  return { game, gamePlayer, round, players };
}

/**
 * Check if a player is NOT on the current team and the game is in
 * a valid active round phase.
 */
function isNonTeamPlayer(gamePlayerId: string, round: Round): boolean {
  const activePhases = [
    "mission_posted",
    "nomination",
    "voting",
    "execution",
    "reveal",
  ];
  if (!activePhases.includes(round.phase)) return false;
  return !round.team_player_ids.includes(gamePlayerId);
}

/**
 * Gather observable round events for AI context.
 * NEVER includes role information -- only observable behavior.
 */
function gatherRoundEvents(
  game: Game,
  round: Round,
  players: PlayerWithInfo[],
): string {
  const events: string[] = [];

  events.push(`Ställning: Ligan ${game.ligan_score} - Aina ${game.aina_score}`);
  events.push(`Runda ${round.round_number}, fas: ${round.phase}`);

  if (round.team_player_ids.length > 0) {
    const teamNames = round.team_player_ids.map((id) => {
      const p = players.find((pl) => pl.id === id);
      return p ? displayName(p.players) : "Okänd";
    });
    events.push(`Valt team: ${teamNames.join(", ")}`);
  }

  if (round.consecutive_failed_votes > 0) {
    events.push(
      `Misslyckade röstningar i rad: ${round.consecutive_failed_votes}`,
    );
  }

  if (round.mission_result) {
    const resultText =
      round.mission_result === "success"
        ? "lyckades"
        : round.mission_result === "kaos_fail"
          ? "KAOS-fail"
          : "saboterad";
    events.push(`Senaste stöt: ${resultText}`);
  }

  return events.join(". ");
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export const engagementHandler = new Composer();

// ---------------------------------------------------------------------------
// 1. /viska command (DM only)
// ---------------------------------------------------------------------------

engagementHandler.chatType("private").command("viska", async (ctx) => {
  const context = await getActiveGameContext(ctx.from.id);
  if (!context) {
    await ctx.reply(MESSAGES.ENGAGEMENT_NO_GAME);
    return;
  }

  const { game, gamePlayer, round, players } = context;

  if (!round || round.phase === "reveal") {
    await ctx.reply(MESSAGES.ENGAGEMENT_WRONG_PHASE);
    return;
  }

  if (!isNonTeamPlayer(gamePlayer.id, round)) {
    await ctx.reply(MESSAGES.ENGAGEMENT_ON_TEAM);
    return;
  }

  // Build target selection keyboard
  const kb = new InlineKeyboard();
  kb.text("Till gruppen", `wt:${game.id}:group`).row();

  // Exclude sender from player list
  const otherPlayers = players.filter((p) => p.id !== gamePlayer.id);
  for (let i = 0; i < otherPlayers.length; i++) {
    kb.text(displayName(otherPlayers[i].players), `wt:${game.id}:p${i}`).row();
  }

  await ctx.reply(MESSAGES.WHISPER_TARGET_PROMPT, { reply_markup: kb });
});

// ---------------------------------------------------------------------------
// 2. Whisper target callback (wt:{gameId}:{target})
// ---------------------------------------------------------------------------

engagementHandler.callbackQuery(/^wt:(.+):(group|p\d+)$/, async (ctx) => {
  const match = ctx.match!;
  const gameId = match[1];
  const targetRaw = match[2];

  // Re-fetch context to verify game state
  const context = await getActiveGameContext(ctx.from.id);
  if (!context || context.game.id !== gameId) {
    await ctx.answerCallbackQuery(MESSAGES.ENGAGEMENT_NO_GAME);
    return;
  }

  const { game, gamePlayer, round, players } = context;

  if (!isNonTeamPlayer(gamePlayer.id, round)) {
    await ctx.answerCallbackQuery(MESSAGES.ENGAGEMENT_ON_TEAM);
    return;
  }

  const otherPlayers = players.filter((p) => p.id !== gamePlayer.id);

  let target: PendingWhisper["target"];
  if (targetRaw === "group") {
    target = "group";
  } else {
    const index = parseInt(targetRaw.slice(1), 10);
    const targetPlayer = otherPlayers[index];
    if (!targetPlayer) {
      await ctx.answerCallbackQuery("Ogiltig spelare, bre. 🤷");
      return;
    }
    target = {
      playerId: targetPlayer.id,
      playerName: displayName(targetPlayer.players),
    };
  }

  // Store pending whisper
  pendingWhispers.set(ctx.from.id, {
    gameId: game.id,
    gamePlayerId: gamePlayer.id,
    groupChatId: game.group_chat_id,
    senderRole: gamePlayer.role!,
    target,
    createdAt: Date.now(),
  });

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(MESSAGES.WHISPER_MESSAGE_PROMPT);
});

// ---------------------------------------------------------------------------
// 3. /spana command (DM only)
// ---------------------------------------------------------------------------

engagementHandler.chatType("private").command("spana", async (ctx) => {
  const context = await getActiveGameContext(ctx.from.id);
  if (!context) {
    await ctx.reply(MESSAGES.ENGAGEMENT_NO_GAME);
    return;
  }

  const { game, gamePlayer, round, players } = context;

  if (!round || round.team_player_ids.length === 0) {
    await ctx.reply(MESSAGES.ENGAGEMENT_WRONG_PHASE);
    return;
  }

  if (!isNonTeamPlayer(gamePlayer.id, round)) {
    await ctx.reply(MESSAGES.ENGAGEMENT_ON_TEAM);
    return;
  }

  // Check if already used this round
  const existing = await getSurveillanceForPlayerInRound(
    game.id,
    gamePlayer.id,
    round.round_number,
  );
  if (existing) {
    await ctx.reply(MESSAGES.SURVEILLANCE_ALREADY_USED);
    return;
  }

  // Build team member selection keyboard
  const kb = new InlineKeyboard();
  const teamMembers = players.filter((p) =>
    round.team_player_ids.includes(p.id),
  );
  for (let i = 0; i < teamMembers.length; i++) {
    kb.text(
      displayName(teamMembers[i].players),
      `sp:${game.id}:${round.round_number}:${i}`,
    ).row();
  }

  await ctx.reply(MESSAGES.SURVEILLANCE_TARGET_PROMPT, { reply_markup: kb });
});

// ---------------------------------------------------------------------------
// 4. Surveillance target callback (sp:{gameId}:{roundNumber}:{index})
// ---------------------------------------------------------------------------

engagementHandler.callbackQuery(
  /^sp:(.+):(\d+):(\d+)$/,
  async (ctx) => {
    const match = ctx.match!;
    const gameId = match[1];
    const roundNumber = parseInt(match[2], 10);
    const targetIndex = parseInt(match[3], 10);

    // Re-verify context (race condition check)
    const context = await getActiveGameContext(ctx.from.id);
    if (!context || context.game.id !== gameId) {
      await ctx.answerCallbackQuery(MESSAGES.ENGAGEMENT_NO_GAME);
      return;
    }

    const { game, gamePlayer, round, players } = context;

    if (!isNonTeamPlayer(gamePlayer.id, round)) {
      await ctx.answerCallbackQuery(MESSAGES.ENGAGEMENT_ON_TEAM);
      return;
    }

    // Race condition: check again if already used this round
    const existing = await getSurveillanceForPlayerInRound(
      game.id,
      gamePlayer.id,
      round.round_number,
    );
    if (existing) {
      await ctx.answerCallbackQuery(MESSAGES.SURVEILLANCE_ALREADY_USED);
      return;
    }

    // Resolve target from team members
    const teamMembers = players.filter((p) =>
      round.team_player_ids.includes(p.id),
    );
    const targetPlayer = teamMembers[targetIndex];
    if (!targetPlayer) {
      await ctx.answerCallbackQuery("Ogiltig spelare, bre. 🤷");
      return;
    }

    await ctx.answerCallbackQuery(MESSAGES.SURVEILLANCE_SENT_CONFIRM);

    // Generate AI clue
    const guzmanCtx = await getGuzmanContext(game.id);
    const roundEvents = gatherRoundEvents(game, round, players);
    const targetName = displayName(targetPlayer.players);
    const targetRole = targetPlayer.role as PlayerRole;

    const clue = await generateSurveillanceClue(
      targetName,
      targetRole,
      roundEvents,
      guzmanCtx,
    );

    // 40% chance of notifying the target
    const targetNotified = randomInt(0, 100) < 40;

    // Persist surveillance record
    await createSurveillance({
      game_id: game.id,
      round_number: roundNumber,
      surveiller_player_id: gamePlayer.id,
      target_player_id: targetPlayer.id,
      clue_message: clue,
      target_notified: targetNotified,
    });

    // Send clue to surveiller
    await ctx.editMessageText(clue, { parse_mode: "HTML" });

    // If target should be notified, send notification to their DM
    if (targetNotified) {
      try {
        const queue = getMessageQueue();
        await queue.send(
          targetPlayer.players.dm_chat_id,
          MESSAGES.SURVEILLANCE_TARGET_NOTIFIED,
          { parse_mode: "HTML" },
        );
      } catch (err) {
        console.warn(
          `[engagement] Failed to notify surveillance target ${targetName}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(
      `[engagement] Surveillance: ${displayName(
        (players.find((p) => p.id === gamePlayer.id) as PlayerWithInfo).players,
      )} -> ${targetName} (notified=${targetNotified}) in game ${game.id}`,
    );
  },
);

// ---------------------------------------------------------------------------
// 5. Freeform text handler (captures whisper content -- MUST BE LAST)
// ---------------------------------------------------------------------------

engagementHandler
  .chatType("private")
  .on("message:text", async (ctx, next) => {
    const pending = pendingWhispers.get(ctx.from.id);
    if (!pending) {
      // Not a pending whisper -- pass through to other handlers
      await next();
      return;
    }

    // Check TTL
    if (Date.now() - pending.createdAt > WHISPER_PENDING_TTL_MS) {
      pendingWhispers.delete(ctx.from.id);
      await ctx.reply(MESSAGES.WHISPER_EXPIRED);
      return;
    }

    // Delete pending immediately (before async work)
    pendingWhispers.delete(ctx.from.id);

    const whisperText = ctx.message.text;

    // Get fresh game/round context
    const game = await getGameById(pending.gameId);
    if (!game || game.state !== "active") {
      await ctx.reply(MESSAGES.ENGAGEMENT_NO_GAME);
      return;
    }

    const round = await getCurrentRound(game.id);
    if (!round) {
      await ctx.reply(MESSAGES.ENGAGEMENT_WRONG_PHASE);
      return;
    }

    // Generate AI relay
    const guzmanCtx = await getGuzmanContext(game.id);
    const relayedMessage = await generateWhisperRelay(
      pending.senderRole,
      whisperText,
      guzmanCtx,
    );

    // Determine target type for DB
    const targetType: WhisperTargetType =
      pending.target === "group" ? "group" : "player";
    const targetPlayerId =
      pending.target === "group" ? null : pending.target.playerId;

    // Persist anonymous whisper
    await createAnonymousWhisper({
      game_id: game.id,
      round_number: round.round_number,
      sender_player_id: pending.gamePlayerId,
      target_type: targetType,
      target_player_id: targetPlayerId,
      original_message: whisperText,
      relayed_message: relayedMessage,
    });

    // Send relayed message
    const queue = getMessageQueue();
    if (pending.target === "group") {
      // Send to group chat
      await queue.send(pending.groupChatId, relayedMessage, {
        parse_mode: "HTML",
      });
    } else {
      // Send targeted whisper to player's DM
      const { playerId, playerName } = pending.target;
      const players = await getGamePlayersOrderedWithInfo(game.id);
      const targetPlayerInfo = players.find((p) => p.id === playerId);

      if (targetPlayerInfo) {
        const targetedMessage = MESSAGES.WHISPER_RELAY_TARGETED_TEMPLATE(
          playerName,
          whisperText,
        );
        await queue.send(
          targetPlayerInfo.players.dm_chat_id,
          targetedMessage,
          { parse_mode: "HTML" },
        );
      }
    }

    // Confirm to sender
    await ctx.reply(MESSAGES.WHISPER_SENT_CONFIRM);

    console.log(
      `[engagement] Anonymous whisper sent (target=${targetType}) in game ${game.id}`,
    );
  });
