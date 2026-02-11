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
  guzman_context: Record<string, unknown>;
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
// AI Guzman types (Phase 4)
// ---------------------------------------------------------------------------

/** Structured narrative context for Guzman's story arc */
export type GuzmanContext = {
  storyArc: string;
  roundSummaries: Array<{
    round: number;
    missionTheme: string;
    outcome: "success" | "fail" | "kaos_fail";
    narrativeBeats: string;
  }>;
  playerNotes: Record<string, string>;
  mood: string;
  behavioralHistory?: Record<string, Array<{
    round: number;
    messageCount: number;
    avgLength: number;
    frequency: number;
    primaryTone: string;
  }>>;
};

/** Truth level for Guzman whisper messages */
export type TruthLevel = "truth" | "half_truth" | "lie";

/** Trigger type for Guzman whispers */
export type WhisperTrigger = "scheduled" | "event";

/** Full whisper row as returned from the database */
export type Whisper = {
  id: string;
  game_id: string;
  round_number: number;
  target_player_id: string;
  message: string;
  truth_level: TruthLevel;
  trigger_type: WhisperTrigger;
  sent_at: string;
};

/** Fields for inserting a new whisper (id and sent_at are auto-generated) */
export type WhisperInsert = Omit<Whisper, "id" | "sent_at">;

// ---------------------------------------------------------------------------
// Engagement types (Phase 5)
// ---------------------------------------------------------------------------

/** Target type for anonymous whispers */
export type WhisperTargetType = "group" | "player";

/** Full anonymous_whisper row as returned from the database */
export type AnonymousWhisper = {
  id: string;
  game_id: string;
  round_number: number;
  sender_player_id: string;
  target_type: WhisperTargetType;
  target_player_id: string | null;
  original_message: string;
  relayed_message: string;
  sent_at: string;
};

/** Fields for inserting a new anonymous whisper (id and sent_at are auto-generated) */
export type AnonymousWhisperInsert = Omit<AnonymousWhisper, "id" | "sent_at">;

/** Full surveillance row as returned from the database */
export type Surveillance = {
  id: string;
  game_id: string;
  round_number: number;
  surveiller_player_id: string;
  target_player_id: string;
  clue_message: string;
  target_notified: boolean;
  created_at: string;
};

/** Fields for inserting a new surveillance record (id and created_at are auto-generated) */
export type SurveillanceInsert = Omit<Surveillance, "id" | "created_at">;

/** Full player_spanings row as returned from the database */
export type PlayerSpaning = {
  id: string;
  game_id: string;
  player_id: string;
  target_player_id: string;
  answer_truthful: boolean;
  answer_message: string;
  used_at: string;
};

/** Fields for inserting a new player spaning (id and used_at are auto-generated) */
export type PlayerSpaningInsert = Omit<PlayerSpaning, "id" | "used_at">;

// ---------------------------------------------------------------------------
// Player messages types (v1.1)
// ---------------------------------------------------------------------------

/** Full player_messages row as returned from the database */
export type PlayerMessage = {
  id: string;
  game_id: string;
  game_player_id: string;
  message_text: string;
  sent_at: string;
};

/** Insert type for player_messages (id and sent_at auto-generated) */
export type PlayerMessageInsert = Omit<PlayerMessage, "id" | "sent_at">;

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
      whispers: {
        Row: Whisper;
        Insert: WhisperInsert;
        Update: Partial<Whisper>;
        Relationships: [
          {
            foreignKeyName: "whispers_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whispers_target_player_id_fkey";
            columns: ["target_player_id"];
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
        ];
      };
      anonymous_whispers: {
        Row: AnonymousWhisper;
        Insert: AnonymousWhisperInsert;
        Update: Partial<AnonymousWhisper>;
        Relationships: [
          {
            foreignKeyName: "anonymous_whispers_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anonymous_whispers_sender_player_id_fkey";
            columns: ["sender_player_id"];
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anonymous_whispers_target_player_id_fkey";
            columns: ["target_player_id"];
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
        ];
      };
      surveillance: {
        Row: Surveillance;
        Insert: SurveillanceInsert;
        Update: Partial<Surveillance>;
        Relationships: [
          {
            foreignKeyName: "surveillance_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "surveillance_surveiller_player_id_fkey";
            columns: ["surveiller_player_id"];
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "surveillance_target_player_id_fkey";
            columns: ["target_player_id"];
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
        ];
      };
      player_spanings: {
        Row: PlayerSpaning;
        Insert: PlayerSpaningInsert;
        Update: Partial<PlayerSpaning>;
        Relationships: [
          {
            foreignKeyName: "player_spanings_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_spanings_player_id_fkey";
            columns: ["player_id"];
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_spanings_target_player_id_fkey";
            columns: ["target_player_id"];
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
        ];
      };
      player_messages: {
        Row: PlayerMessage;
        Insert: PlayerMessageInsert;
        Update: Partial<PlayerMessageInsert>;
        Relationships: [
          {
            foreignKeyName: "player_messages_game_id_fkey";
            columns: ["game_id"];
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_messages_game_player_id_fkey";
            columns: ["game_player_id"];
            referencedRelation: "game_players";
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
