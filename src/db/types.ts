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
  join_order: number | null;
  joined_at: string;
};

/** Fields required/optional when inserting a game_player */
export type GamePlayerInsert = {
  game_id: string;
  player_id: string;
  role?: PlayerRole | null;
  join_order?: number | null;
};

// ---------------------------------------------------------------------------
// Round / Vote / Mission / Sista Chansen types (Phase 3)
// ---------------------------------------------------------------------------

/** Phases within a single round */
export type RoundPhase = "mission_posted" | "nomination" | "voting" | "execution" | "reveal";

/** Vote choices for team approval */
export type VoteChoice = "ja" | "nej";

/** Secret mission action choices */
export type MissionAction = "sakra" | "gola";

/** Possible mission outcomes */
export type MissionResult = "success" | "fail" | "kaos_fail";

/** Which side guesses during Sista Chansen */
export type GuessingSide = "golare" | "akta";

/** Full round row as returned from the database */
export type Round = {
  id: string;
  game_id: string;
  round_number: number;
  phase: RoundPhase;
  capo_player_id: string | null;
  team_player_ids: string[];
  consecutive_failed_votes: number;
  mission_result: MissionResult | null;
  ligan_point: boolean | null;
  nomination_message_id: number | null;
  vote_message_id: number | null;
  created_at: string;
  updated_at: string;
};

/** Full vote row as returned from the database */
export type Vote = {
  id: string;
  round_id: string;
  game_player_id: string;
  vote: VoteChoice;
  voted_at: string;
};

/** Full mission_action row as returned from the database */
export type MissionActionRow = {
  id: string;
  round_id: string;
  game_player_id: string;
  action: MissionAction;
  acted_at: string;
};

/** Full sista_chansen row as returned from the database */
export type SistaChansen = {
  id: string;
  game_id: string;
  guessing_side: GuessingSide;
  target_player_id: string;
  guessed_by_id: string;
  correct: boolean | null;
  guessed_at: string;
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
      rounds: {
        Row: Round;
        Insert: Partial<Round> & { game_id: string; round_number: number };
        Update: Partial<Round>;
        Relationships: [
          {
            foreignKeyName: "rounds_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      votes: {
        Row: Vote;
        Insert: Omit<Vote, "id" | "voted_at">;
        Update: Partial<Vote>;
        Relationships: [
          {
            foreignKeyName: "votes_round_id_fkey";
            columns: ["round_id"];
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_actions: {
        Row: MissionActionRow;
        Insert: Omit<MissionActionRow, "id" | "acted_at">;
        Update: Partial<MissionActionRow>;
        Relationships: [
          {
            foreignKeyName: "mission_actions_round_id_fkey";
            columns: ["round_id"];
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
      sista_chansen: {
        Row: SistaChansen;
        Insert: Omit<SistaChansen, "id" | "guessed_at" | "correct">;
        Update: Partial<SistaChansen>;
        Relationships: [
          {
            foreignKeyName: "sista_chansen_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
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
