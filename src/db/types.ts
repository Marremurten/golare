/** Full player row as returned from the database */
export type Player = {
  id: string;
  telegram_user_id: number;
  dm_chat_id: number;
  username: string | null;
  first_name: string | null;
  registered_at: string;
  updated_at: string;
};

/** Fields required/optional when inserting a new player */
export type PlayerInsert = {
  telegram_user_id: number;
  dm_chat_id: number;
  username?: string | null;
  first_name?: string | null;
};

// ---------------------------------------------------------------------------
// Game types
// ---------------------------------------------------------------------------

/** Valid states for a game */
export type GameState = "lobby" | "active" | "finished" | "cancelled";

/** Player roles assigned at game start */
export type PlayerRole = "akta" | "golare" | "hogra_hand";

/** Full game row as returned from the database */
export type Game = {
  id: string;
  group_chat_id: number;
  admin_user_id: number;
  lobby_message_id: number | null;
  state: GameState;
  round: number;
  ligan_score: number;
  aina_score: number;
  team_size: number | null;
  created_at: string;
  updated_at: string;
};

/** Fields required/optional when inserting a new game */
export type GameInsert = {
  group_chat_id: number;
  admin_user_id: number;
  lobby_message_id?: number | null;
  state?: GameState;
};

/** Full game_player row as returned from the database */
export type GamePlayer = {
  id: string;
  game_id: string;
  player_id: string;
  role: PlayerRole | null;
  joined_at: string;
};

/** Fields required/optional when inserting a game_player */
export type GamePlayerInsert = {
  game_id: string;
  player_id: string;
  role?: PlayerRole | null;
};

// ---------------------------------------------------------------------------
// Supabase Database type definition
// ---------------------------------------------------------------------------

/** Supabase Database type definition */
export type Database = {
  public: {
    Tables: {
      players: {
        Row: Player;
        Insert: PlayerInsert;
        Update: Partial<PlayerInsert>;
        Relationships: [];
      };
      games: {
        Row: Game;
        Insert: GameInsert;
        Update: Partial<Game>;
        Relationships: [];
      };
      game_players: {
        Row: GamePlayer;
        Insert: GamePlayerInsert;
        Update: Partial<GamePlayerInsert>;
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_players_player_id_fkey";
            columns: ["player_id"];
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

/** Alias for the full row type */
export type PlayerRow = Player;
