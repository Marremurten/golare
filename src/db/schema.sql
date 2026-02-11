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

-- ---------------------------------------------------------------------------
-- Rounds table: one row per round in a game (5 rounds max)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rounds (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id                  UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number             INT NOT NULL,
  phase                    TEXT NOT NULL DEFAULT 'mission_posted',
  capo_player_id           UUID REFERENCES game_players(id),
  team_player_ids          UUID[] DEFAULT '{}',
  consecutive_failed_votes INT NOT NULL DEFAULT 0,
  mission_result           TEXT,
  ligan_point              BOOLEAN,
  nomination_message_id    BIGINT,
  vote_message_id          BIGINT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_round_per_game UNIQUE (game_id, round_number),
  CONSTRAINT valid_round_number CHECK (round_number BETWEEN 1 AND 5),
  CONSTRAINT valid_phase CHECK (phase IN (
    'mission_posted', 'nomination', 'voting', 'execution', 'reveal'
  )),
  CONSTRAINT valid_mission_result CHECK (
    mission_result IS NULL OR mission_result IN ('success', 'fail', 'kaos_fail')
  )
);

CREATE INDEX IF NOT EXISTS idx_rounds_game_id ON rounds (game_id);

CREATE OR REPLACE TRIGGER update_rounds_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Votes table: team approval votes (JA/NEJ) per round
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  game_player_id  UUID NOT NULL REFERENCES game_players(id),
  vote            TEXT NOT NULL,
  voted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_vote_per_round UNIQUE (round_id, game_player_id),
  CONSTRAINT valid_vote CHECK (vote IN ('ja', 'nej'))
);

CREATE INDEX IF NOT EXISTS idx_votes_round_id ON votes (round_id);

-- ---------------------------------------------------------------------------
-- Mission actions: secret Säkra or Gola choices by team members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  game_player_id  UUID NOT NULL REFERENCES game_players(id),
  action          TEXT NOT NULL,
  acted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_action_per_round UNIQUE (round_id, game_player_id),
  CONSTRAINT valid_action CHECK (action IN ('sakra', 'gola'))
);

CREATE INDEX IF NOT EXISTS idx_mission_actions_round_id ON mission_actions (round_id);

-- ---------------------------------------------------------------------------
-- Sista Chansen: endgame guess (one per game, first-guess-wins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sista_chansen (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  guessing_side    TEXT NOT NULL,
  target_player_id UUID NOT NULL REFERENCES game_players(id),
  guessed_by_id    UUID NOT NULL REFERENCES game_players(id),
  correct          BOOLEAN,
  guessed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_sista_chansen_per_game UNIQUE (game_id),
  CONSTRAINT valid_guessing_side CHECK (guessing_side IN ('golare', 'akta'))
);

-- ---------------------------------------------------------------------------
-- Add join_order to game_players for Capo rotation
-- ---------------------------------------------------------------------------
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS join_order INT;

-- ---------------------------------------------------------------------------
-- AI Guzman narrative context (Phase 4)
-- ---------------------------------------------------------------------------
ALTER TABLE games ADD COLUMN IF NOT EXISTS guzman_context JSONB DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- Whispers table: tracks all Guzman DM whispers to players
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whispers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number     INT NOT NULL,
  target_player_id UUID NOT NULL REFERENCES game_players(id),
  message          TEXT NOT NULL,
  truth_level      TEXT NOT NULL DEFAULT 'truth',
  trigger_type     TEXT NOT NULL DEFAULT 'scheduled',
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_truth_level CHECK (truth_level IN ('truth', 'half_truth', 'lie')),
  CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('scheduled', 'event'))
);

CREATE INDEX IF NOT EXISTS idx_whispers_game_id ON whispers (game_id);
CREATE INDEX IF NOT EXISTS idx_whispers_target_player ON whispers (target_player_id);

-- ---------------------------------------------------------------------------
-- Anonymous whispers from players relayed through Guzman (Phase 5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anonymous_whispers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number      INT NOT NULL,
  sender_player_id  UUID NOT NULL REFERENCES game_players(id),
  target_type       TEXT NOT NULL CHECK (target_type IN ('group', 'player')),
  target_player_id  UUID REFERENCES game_players(id),
  original_message  TEXT NOT NULL,
  relayed_message   TEXT NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anon_whispers_game_id ON anonymous_whispers (game_id);

-- ---------------------------------------------------------------------------
-- Surveillance actions by non-team players (Phase 5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surveillance (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id              UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number         INT NOT NULL,
  surveiller_player_id UUID NOT NULL REFERENCES game_players(id),
  target_player_id     UUID NOT NULL REFERENCES game_players(id),
  clue_message         TEXT NOT NULL,
  target_notified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_surveillance_per_round UNIQUE (game_id, surveiller_player_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_surveillance_game_id ON surveillance (game_id);
