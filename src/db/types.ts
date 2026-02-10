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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

/** Alias for the full row type */
export type PlayerRow = Player;
