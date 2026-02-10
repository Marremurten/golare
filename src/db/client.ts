import { createClient } from "@supabase/supabase-js";
import type {
  Database,
  PlayerRow,
  PlayerInsert,
  Game,
  GamePlayer,
  Player,
  PlayerRole,
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
          joined_at: row.joined_at,
        },
      };
    }
  }

  return null;
}
