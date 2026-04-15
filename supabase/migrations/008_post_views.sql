-- ============================================================
-- Post views — contabiliza 1 visualização por (post, usuário).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.post_views (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_views_post ON public.post_views (post_id);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- INSERT: qualquer usuário autenticado pode registrar a própria view.
DROP POLICY IF EXISTS "insert own view" ON public.post_views;
CREATE POLICY "insert own view"
  ON public.post_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- SELECT: dono do post OU gestor (mesmo princípio do recurso).
-- Alunos não veem views de posts alheios.
DROP POLICY IF EXISTS "read views (owner or gestor)" ON public.post_views;
CREATE POLICY "read views (owner or gestor)"
  ON public.post_views FOR SELECT
  USING (
    public.is_gestor()
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_views.post_id AND p.user_id = auth.uid()
    )
  );

-- RPC para registrar view de forma segura (evita duplicatas, não conta autor).
CREATE OR REPLACE FUNCTION public.register_post_view(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  SELECT user_id INTO v_author FROM public.posts WHERE id = p_post_id;
  IF v_author IS NULL OR v_author = auth.uid() THEN RETURN; END IF;

  INSERT INTO public.post_views (post_id, user_id)
  VALUES (p_post_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_post_view(uuid) TO authenticated;
