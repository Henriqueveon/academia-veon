-- Status enum for posts lifecycle
DO $$ BEGIN
  CREATE TYPE post_status AS ENUM ('uploading','processing','ready','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns. Default 'ready' for the ALTER so existing rows backfill correctly.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS status post_status NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS failed_reason text,
  ADD COLUMN IF NOT EXISTS upload_started_at timestamptz DEFAULT now();

-- From now on, new rows start as 'uploading'
ALTER TABLE posts ALTER COLUMN status SET DEFAULT 'uploading';

-- Feed index: only 'ready' posts, ordered by recency
CREATE INDEX IF NOT EXISTS posts_ready_feed_idx
  ON posts (created_at DESC) WHERE status = 'ready';

-- Author's in-flight posts
CREATE INDEX IF NOT EXISTS posts_author_inflight_idx
  ON posts (user_id, created_at DESC) WHERE status <> 'ready';
