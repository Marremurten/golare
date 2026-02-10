-- Players table: stores Telegram users who have /start'd the bot
CREATE TABLE IF NOT EXISTS players (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  dm_chat_id       BIGINT NOT NULL,
  username         TEXT,
  first_name       TEXT,
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_telegram_user_id ON players (telegram_user_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Games table: one row per game instance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id    BIGINT NOT NULL,
  admin_user_id    BIGINT NOT NULL,
  lobby_message_id BIGINT,
  state            TEXT NOT NULL DEFAULT 'lobby',
  round            INT NOT NULL DEFAULT 0,
  ligan_score      INT NOT NULL DEFAULT 0,
  aina_score       INT NOT NULL DEFAULT 0,
  team_size        INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one non-finished/non-cancelled game per group at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_game_per_group
  ON games (group_chat_id) WHERE state NOT IN ('finished', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_games_group_chat_id ON games (group_chat_id);

-- Reuse the update_updated_at_column() trigger from players for games
CREATE OR REPLACE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Game players: join table linking players to games with roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role        TEXT,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_player_per_game UNIQUE (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players (game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players (player_id);
