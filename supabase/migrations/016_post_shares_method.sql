-- Add method column to post_shares and make recipient_id nullable
ALTER TABLE post_shares
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'friends'
    CHECK (method IN ('friends', 'whatsapp', 'instagram', 'facebook', 'copy_link'));

ALTER TABLE post_shares
  ALTER COLUMN recipient_id DROP NOT NULL;

-- Index for fast count by post_id
CREATE INDEX IF NOT EXISTS post_shares_post_id_idx ON post_shares(post_id);
