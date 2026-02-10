import { createClient } from "@supabase/supabase-js";
import type { Database, PlayerRow, PlayerInsert } from "./types.js";
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
