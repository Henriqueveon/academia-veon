-- Adds an optional redirect link to posts. Only gestores may set link_url.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS link_url text;

-- Reject link_url on insert/update when the author is not a gestor.
CREATE OR REPLACE FUNCTION public.enforce_post_link_url_gestor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.link_url IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.user_id AND role = 'gestor'
    ) THEN
      RAISE EXCEPTION 'Apenas gestores podem adicionar link ao post';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_post_link_url_gestor ON posts;
CREATE TRIGGER trg_enforce_post_link_url_gestor
  BEFORE INSERT OR UPDATE OF link_url ON posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_post_link_url_gestor();
