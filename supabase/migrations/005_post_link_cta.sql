-- Optional custom CTA label for the post link (e.g., "Saiba mais").

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS link_cta text;
