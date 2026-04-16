-- ============================================================
-- Migration 014: Curtidas e Comentários em Aulas
-- ============================================================

-- 1) Curtidas em aulas (1 por aluno por aula)
CREATE TABLE IF NOT EXISTS public.lesson_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);

ALTER TABLE public.lesson_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all lesson likes"
  ON public.lesson_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can like lessons"
  ON public.lesson_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own"
  ON public.lesson_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 2) Comentários em aulas
CREATE TABLE IF NOT EXISTS public.lesson_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.lesson_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lesson_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all lesson comments"
  ON public.lesson_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create comments"
  ON public.lesson_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.lesson_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Gestors can delete any comment"
  ON public.lesson_comments FOR DELETE
  USING (public.is_gestor());

CREATE INDEX IF NOT EXISTS lesson_comments_lesson_idx
  ON public.lesson_comments(lesson_id, created_at);

CREATE INDEX IF NOT EXISTS lesson_likes_lesson_idx
  ON public.lesson_likes(lesson_id);
