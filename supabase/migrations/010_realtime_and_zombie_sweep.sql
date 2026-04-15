-- Migration 010: Realtime + zombie sweep for posts
--
-- Goal:
--  1) Ensure the `posts` table is published to Supabase Realtime so the feed
--     can subscribe to INSERT/UPDATE events (live feed).
--  2) Provide a server-side sweep function that marks abandoned uploads as
--     'failed' after 10 minutes, so posts never get stuck invisible to the
--     rest of the community when the author's tab closes mid-upload.
--  3) If pg_cron is available, schedule the sweep every 2 minutes.

-- 1) Publish `posts` to the Realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.posts';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Publication may not exist on self-hosted setups; don't fail the migration.
  NULL;
END $$;

-- Make sure UPDATE payloads include the full row (so Realtime clients can read
-- the new `status` value).
ALTER TABLE public.posts REPLICA IDENTITY FULL;

-- 2) Zombie sweep function
CREATE OR REPLACE FUNCTION public.sweep_zombie_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.posts
    SET status = 'failed',
        failed_reason = COALESCE(failed_reason, 'Upload interrompido')
  WHERE status = 'uploading'
    AND upload_started_at IS NOT NULL
    AND upload_started_at < now() - interval '10 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.sweep_zombie_posts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_zombie_posts() TO service_role;

-- 3) Schedule the sweep via pg_cron (optional — no-op if the extension is
-- not installed on the project)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove any previously scheduled job with the same name
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'sweep_zombie_posts';

    PERFORM cron.schedule(
      'sweep_zombie_posts',
      '*/2 * * * *',
      $cron$ SELECT public.sweep_zombie_posts(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
