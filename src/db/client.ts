import { createClient } from "@supabase/supabase-js";
import type {
  Database,
  PlayerRow,
  PlayerInsert,
  Game,
  GamePlayer,
  Player,
  PlayerRole,
  Round,
  Vote,
  VoteChoice,
  MissionActionRow,
  MissionAction,
  SistaChansen,
  GuessingSide,
  GuzmanContext,
  Whisper,
  WhisperInsert,
  AnonymousWhisper,
  AnonymousWhisperInsert,
  Surveillance,
  SurveillanceInsert,
} from "./types.js";
import { config } from "../config.js";

export const supabase = createClient<Database>(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Register or update a player via upsert (on conflict: telegram_user_id).
 * Returns the full player row.
 */
export async function registerPlayer(
  telegram_user_id: number,
  dm_chat_id: number,
  username?: string,
  first_name?: string
): Promise<PlayerRow> {
  const row: PlayerInsert = {
    telegram_user_id,
    dm_chat_id,
    username: username ?? null,
    first_name: first_name ?? null,
  };

  const { data, error } = await supabase
    .from("players")
    .upsert(row, { onConflict: "telegram_user_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`registerPlayer failed: ${error.message}`);
  }

  return data as PlayerRow;
}

/**
 * Look up a player by their Telegram user ID.
 * Returns null if not found.
 */
export async function getPlayerByTelegramId(
  telegram_user_id: number
): Promise<PlayerRow | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("telegram_user_id", telegram_user_id)
    .maybeSingle();

  if (error) {
    throw new Error(`getPlayerByTelegramId failed: ${error.message}`);
  }

  return data as PlayerRow | null;
}

// ---------------------------------------------------------------------------
// Game CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new game in the lobby state for a group chat.
 */
export async function createGame(
  group_chat_id: number,
  admin_user_id: number,
): Promise<Game> {
  const { data, error } = await supabase
    .from("games")
    .insert({ group_chat_id, admin_user_id })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createGame failed: ${error.message}`);
  }

  return data as Game;
}

/**
 * Get the active (non-finished, non-cancelled) game for a group chat.
 * Returns null if no active game exists.
 */
export async function getActiveGame(
  group_chat_id: number,
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("group_chat_id", group_chat_id)
    .not("state", "in", '("finished","cancelled")')
    .maybeSingle();

  if (error) {
    throw new Error(`getActiveGame failed: ${error.message}`);
  }

  return data as Game | null;
}

/**
 * Get a game by its ID. Returns null if not found.
 */
export async function getGameById(
  game_id: string,
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", game_id)
    .maybeSingle();

  if (error) {
    throw new Error(`getGameById failed: ${error.message}`);
  }

  return data as Game | null;
}

/**
 * Update a game row with partial fields.
 */
export async function updateGame(
  game_id: string,
  updates: Partial<Game>,
): Promise<Game> {
  const { data, error } = await supabase
    .from("games")
    .update(updates)
    .eq("id", game_id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`updateGame failed: ${error.message}`);
  }

  return data as Game;
}

/**
 * Add a player to a game. Uses upsert to handle double-clicks gracefully.
 */
export async function addPlayerToGame(
  game_id: string,
  player_id: string,
): Promise<GamePlayer> {
  const { data, error } = await supabase
    .from("game_players")
    .upsert(
      { game_id, player_id },
      { onConflict: "game_id,player_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`addPlayerToGame failed: ${error.message}`);
  }

  return data as GamePlayer;
}

/**
 * Remove a player from a game.
 */
export async function removePlayerFromGame(
  game_id: string,
  player_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .delete()
    .eq("game_id", game_id)
    .eq("player_id", player_id);

  if (error) {
    throw new Error(`removePlayerFromGame failed: ${error.message}`);
  }
}

/**
 * Get all players in a game (game_players rows only).
 */
export async function getGamePlayers(
  game_id: string,
): Promise<GamePlayer[]> {
  const { data, error } = await supabase
    .from("game_players")
    .select("*")
    .eq("game_id", game_id);

  if (error) {
    throw new Error(`getGamePlayers failed: ${error.message}`);
  }

  return (data ?? []) as GamePlayer[];
}

/**
 * Get all players in a game with their player info (username, first_name, etc.).
 * Uses a joined select to avoid N+1 queries.
 */
export async function getGamePlayersWithInfo(
  game_id: string,
): Promise<Array<GamePlayer & { players: Player }>> {
  const { data, error } = await supabase
    .from("game_players")
    .select("*, players(*)")
    .eq("game_id", game_id);

  if (error) {
    throw new Error(`getGamePlayersWithInfo failed: ${error.message}`);
  }

  return (data ?? []) as Array<GamePlayer & { players: Player }>;
}

/**
 * Set the role for a player in a game.
 */
export async function setPlayerRole(
  game_id: string,
  player_id: string,
  role: PlayerRole,
): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .update({ role })
    .eq("game_id", game_id)
    .eq("player_id", player_id);

  if (error) {
    throw new Error(`setPlayerRole failed: ${error.message}`);
  }
}

/**
 * Find the active game a player is currently in.
 * Returns the Game if found, null otherwise.
 * Assumes one active game per player (Phase 2 constraint).
 */
export async function getPlayerActiveGame(
  player_id: string,
): Promise<{ game: Game; gamePlayer: GamePlayer } | null> {
  // Get all game_player entries for this player with joined game data
  const { data, error } = await supabase
    .from("game_players")
    .select("*, games(*)")
    .eq("player_id", player_id);

  if (error) {
    throw new Error(`getPlayerActiveGame failed: ${error.message}`);
  }

  if (!data || data.length === 0) return null;

  // Type assertion needed: Supabase v2.95 resolves joined select as {}
  const rows = data as unknown as Array<GamePlayer & { games: Game | null }>;

  // Find the entry with an active (lobby or active) game
  for (const row of rows) {
    const game = row.games;
    if (game && game.state !== "finished" && game.state !== "cancelled") {
      return {
        game,
        gamePlayer: {
          id: row.id,
          game_id: row.game_id,
          player_id: row.player_id,
          role: row.role,
          join_order: row.join_order,
          joined_at: row.joined_at,
        },
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Game Loop CRUD (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Get all games currently in the 'active' state.
 * Used by the scheduler to process all running games.
 */
export async function getAllActiveGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("state", "active");

  if (error) {
    throw new Error(`getAllActiveGames failed: ${error.message}`);
  }

  return (data ?? []) as Game[];
}

/**
 * Create a new round for a game.
 */
export async function createRound(
  game_id: string,
  round_number: number,
  capo_player_id: string,
): Promise<Round> {
  const { data, error } = await supabase
    .from("rounds")
    .insert({ game_id, round_number, phase: "mission_posted", capo_player_id })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createRound failed: ${error.message}`);
  }

  return data as Round;
}

/**
 * Get the current (latest) round for a game.
 * Returns null if no rounds exist.
 */
export async function getCurrentRound(
  game_id: string,
): Promise<Round | null> {
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("game_id", game_id)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getCurrentRound failed: ${error.message}`);
  }

  return data as Round | null;
}

/**
 * Update a round row with partial fields.
 */
export async function updateRound(
  round_id: string,
  updates: Partial<Round>,
): Promise<Round> {
  const { data, error } = await supabase
    .from("rounds")
    .update(updates)
    .eq("id", round_id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`updateRound failed: ${error.message}`);
  }

  return data as Round;
}

/**
 * Cast a vote for a round. Uses upsert to handle double-clicks gracefully.
 */
export async function castVote(
  round_id: string,
  game_player_id: string,
  vote: VoteChoice,
): Promise<Vote> {
  const { data, error } = await supabase
    .from("votes")
    .upsert(
      { round_id, game_player_id, vote },
      { onConflict: "round_id,game_player_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`castVote failed: ${error.message}`);
  }

  return data as Vote;
}

/**
 * Get all votes for a round.
 */
export async function getVotesForRound(
  round_id: string,
): Promise<Vote[]> {
  const { data, error } = await supabase
    .from("votes")
    .select("*")
    .eq("round_id", round_id);

  if (error) {
    throw new Error(`getVotesForRound failed: ${error.message}`);
  }

  return (data ?? []) as Vote[];
}

/**
 * Cast a mission action for a round. Uses upsert for double-click safety.
 */
export async function castMissionAction(
  round_id: string,
  game_player_id: string,
  action: MissionAction,
): Promise<MissionActionRow> {
  const { data, error } = await supabase
    .from("mission_actions")
    .upsert(
      { round_id, game_player_id, action },
      { onConflict: "round_id,game_player_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`castMissionAction failed: ${error.message}`);
  }

  return data as MissionActionRow;
}

/**
 * Get all mission actions for a round.
 */
export async function getMissionActionsForRound(
  round_id: string,
): Promise<MissionActionRow[]> {
  const { data, error } = await supabase
    .from("mission_actions")
    .select("*")
    .eq("round_id", round_id);

  if (error) {
    throw new Error(`getMissionActionsForRound failed: ${error.message}`);
  }

  return (data ?? []) as MissionActionRow[];
}

/**
 * Set the join_order for a player in a game.
 */
export async function setJoinOrder(
  game_id: string,
  player_id: string,
  join_order: number,
): Promise<void> {
  const { error } = await supabase
    .from("game_players")
    .update({ join_order })
    .eq("game_id", game_id)
    .eq("player_id", player_id);

  if (error) {
    throw new Error(`setJoinOrder failed: ${error.message}`);
  }
}

/**
 * Get all players in a game ordered by join_order ASC.
 * Used for Capo rotation.
 */
export async function getGamePlayersOrdered(
  game_id: string,
): Promise<GamePlayer[]> {
  const { data, error } = await supabase
    .from("game_players")
    .select("*")
    .eq("game_id", game_id)
    .order("join_order", { ascending: true });

  if (error) {
    throw new Error(`getGamePlayersOrdered failed: ${error.message}`);
  }

  return (data ?? []) as GamePlayer[];
}

/**
 * Get all players in a game ordered by join_order ASC, with player info.
 * Used by game-loop handlers that need names, dm_chat_id, etc.
 */
export async function getGamePlayersOrderedWithInfo(
  game_id: string,
): Promise<Array<GamePlayer & { players: Player }>> {
  const { data, error } = await supabase
    .from("game_players")
    .select("*, players(*)")
    .eq("game_id", game_id)
    .order("join_order", { ascending: true });

  if (error) {
    throw new Error(`getGamePlayersOrderedWithInfo failed: ${error.message}`);
  }

  return (data ?? []) as Array<GamePlayer & { players: Player }>;
}

/**
 * Get a round by its UUID. Used by callback handlers that receive
 * the round ID in callback data.
 */
export async function getRoundById(
  round_id: string,
): Promise<Round | null> {
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", round_id)
    .maybeSingle();

  if (error) {
    throw new Error(`getRoundById failed: ${error.message}`);
  }

  return data as Round | null;
}

/**
 * Delete all votes for a round. Used when Capo rotates and a new
 * vote cycle starts within the same round.
 */
export async function deleteVotesForRound(
  round_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("votes")
    .delete()
    .eq("round_id", round_id);

  if (error) {
    throw new Error(`deleteVotesForRound failed: ${error.message}`);
  }
}

/**
 * Find a game_player by telegram_user_id within a specific game.
 * Joins game_players with players to match on telegram_user_id.
 */
export async function getGamePlayerByTelegramId(
  game_id: string,
  telegram_user_id: number,
): Promise<GamePlayer | null> {
  const { data, error } = await supabase
    .from("game_players")
    .select("*, players!inner(telegram_user_id)")
    .eq("game_id", game_id)
    .eq("players.telegram_user_id", telegram_user_id)
    .maybeSingle();

  if (error) {
    throw new Error(`getGamePlayerByTelegramId failed: ${error.message}`);
  }

  if (!data) return null;

  // Strip the joined players field and return clean GamePlayer
  const row = data as unknown as GamePlayer & { players: unknown };
  return {
    id: row.id,
    game_id: row.game_id,
    player_id: row.player_id,
    role: row.role,
    join_order: row.join_order,
    joined_at: row.joined_at,
  };
}

/**
 * Create a Sista Chansen guess. UNIQUE constraint on game_id enforces
 * first-guess-wins: a second INSERT for the same game_id will throw.
 * Callers must catch the error to handle the race condition gracefully.
 */
export async function createSistaChansen(
  game_id: string,
  guessing_side: GuessingSide,
  target_player_id: string,
  guessed_by_id: string,
): Promise<SistaChansen> {
  const { data, error } = await supabase
    .from("sista_chansen")
    .insert({ game_id, guessing_side, target_player_id, guessed_by_id })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createSistaChansen failed: ${error.message}`);
  }

  return data as SistaChansen;
}

/**
 * Get the Sista Chansen guess for a game. Returns null if none yet.
 */
export async function getSistaChansen(
  game_id: string,
): Promise<SistaChansen | null> {
  const { data, error } = await supabase
    .from("sista_chansen")
    .select("*")
    .eq("game_id", game_id)
    .maybeSingle();

  if (error) {
    throw new Error(`getSistaChansen failed: ${error.message}`);
  }

  return data as SistaChansen | null;
}

/**
 * Update a Sista Chansen record (e.g. set correct=true/false).
 */
export async function updateSistaChansen(
  id: string,
  updates: Partial<SistaChansen>,
): Promise<SistaChansen> {
  const { data, error } = await supabase
    .from("sista_chansen")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`updateSistaChansen failed: ${error.message}`);
  }

  return data as SistaChansen;
}

// ---------------------------------------------------------------------------
// Guzman Context & Whispers CRUD (Phase 4)
// ---------------------------------------------------------------------------

const DEFAULT_GUZMAN_CONTEXT: GuzmanContext = {
  storyArc: "",
  roundSummaries: [],
  playerNotes: {},
  mood: "paranoid",
};

/**
 * Get the Guzman narrative context for a game.
 * Returns a default empty context if none exists.
 */
export async function getGuzmanContext(
  gameId: string,
): Promise<GuzmanContext> {
  const { data, error } = await supabase
    .from("games")
    .select("guzman_context")
    .eq("id", gameId)
    .single();

  if (error) {
    throw new Error(`getGuzmanContext failed: ${error.message}`);
  }

  const raw = (data as { guzman_context: Record<string, unknown> | null })
    .guzman_context;

  if (!raw || Object.keys(raw).length === 0) {
    return { ...DEFAULT_GUZMAN_CONTEXT };
  }

  return raw as unknown as GuzmanContext;
}

/**
 * Update the Guzman narrative context for a game.
 */
export async function updateGuzmanContext(
  gameId: string,
  context: GuzmanContext,
): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update({ guzman_context: context as unknown as Record<string, unknown> })
    .eq("id", gameId);

  if (error) {
    throw new Error(`updateGuzmanContext failed: ${error.message}`);
  }
}

/**
 * Create a whisper record (Guzman DM to a player).
 */
export async function createWhisper(
  whisper: WhisperInsert,
): Promise<Whisper> {
  const { data, error } = await supabase
    .from("whispers")
    .insert(whisper)
    .select("*")
    .single();

  if (error) {
    throw new Error(`createWhisper failed: ${error.message}`);
  }

  return data as Whisper;
}

/**
 * Get all whispers for a game, ordered by sent_at ascending.
 */
export async function getWhispersForGame(
  gameId: string,
): Promise<Whisper[]> {
  const { data, error } = await supabase
    .from("whispers")
    .select("*")
    .eq("game_id", gameId)
    .order("sent_at", { ascending: true });

  if (error) {
    throw new Error(`getWhispersForGame failed: ${error.message}`);
  }

  return (data ?? []) as Whisper[];
}

/**
 * Get whispers sent to a specific player in a specific round.
 * Used to prevent duplicate whispers to the same player in the same round.
 */
export async function getWhispersForPlayerInRound(
  gameId: string,
  targetPlayerId: string,
  roundNumber: number,
): Promise<Whisper[]> {
  const { data, error } = await supabase
    .from("whispers")
    .select("*")
    .eq("game_id", gameId)
    .eq("target_player_id", targetPlayerId)
    .eq("round_number", roundNumber);

  if (error) {
    throw new Error(`getWhispersForPlayerInRound failed: ${error.message}`);
  }

  return (data ?? []) as Whisper[];
}

// ---------------------------------------------------------------------------
// Engagement CRUD (Phase 5)
// ---------------------------------------------------------------------------

/**
 * Create an anonymous whisper (player -> Guzman relay -> group/player).
 */
export async function createAnonymousWhisper(
  whisper: AnonymousWhisperInsert,
): Promise<AnonymousWhisper> {
  const { data, error } = await supabase
    .from("anonymous_whispers")
    .insert(whisper)
    .select("*")
    .single();

  if (error) {
    throw new Error(`createAnonymousWhisper failed: ${error.message}`);
  }

  return data as AnonymousWhisper;
}

/**
 * Create a surveillance record. Callers should catch unique constraint
 * violations for "already used this round" feedback.
 */
export async function createSurveillance(
  surveillance: SurveillanceInsert,
): Promise<Surveillance> {
  const { data, error } = await supabase
    .from("surveillance")
    .insert(surveillance)
    .select("*")
    .single();

  if (error) {
    throw new Error(`createSurveillance failed: ${error.message}`);
  }

  return data as Surveillance;
}

/**
 * Check if a player has already used surveillance this round.
 * Returns the existing record or null.
 */
export async function getSurveillanceForPlayerInRound(
  gameId: string,
  surveillerPlayerId: string,
  roundNumber: number,
): Promise<Surveillance | null> {
  const { data, error } = await supabase
    .from("surveillance")
    .select("*")
    .eq("game_id", gameId)
    .eq("surveiller_player_id", surveillerPlayerId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (error) {
    throw new Error(`getSurveillanceForPlayerInRound failed: ${error.message}`);
  }

  return data as Surveillance | null;
}
