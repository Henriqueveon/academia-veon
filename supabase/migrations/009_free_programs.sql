-- ============================================
-- Programas Educacionais Gratuitos
-- ============================================

CREATE TABLE IF NOT EXISTS public.free_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  subtitle text,
  episodes_badge text DEFAULT '3 episódios',
  objective_title text,
  objective_card1_text text,
  objective_card2_text text,
  objective_card3_text text,
  partner1_name text,
  partner1_role text,
  partner1_bio text,
  partner1_photo_url text,
  partner2_name text,
  partner2_role text,
  partner2_bio text,
  partner2_photo_url text,
  cta_button_text text DEFAULT 'Quero saber mais',
  cta_button_url text,
  webhook_url text,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.free_program_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES public.free_programs(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  subtitle text,
  bunny_video_id text,
  bunny_library_id text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS free_program_lessons_program_idx
  ON public.free_program_lessons(program_id, sort_order);

-- RLS
ALTER TABLE public.free_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_program_lessons ENABLE ROW LEVEL SECURITY;

-- PUBLIC read (qualquer pessoa pode ver LPs publicadas, mesmo sem login)
CREATE POLICY "Anyone can read published programs"
  ON public.free_programs FOR SELECT
  USING (published = true);

CREATE POLICY "Anyone can read lessons of published programs"
  ON public.free_program_lessons FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.free_programs
    WHERE id = free_program_lessons.program_id AND published = true
  ));

-- Gestor: tudo
CREATE POLICY "Gestors can read all programs"
  ON public.free_programs FOR SELECT
  USING (public.is_gestor());

CREATE POLICY "Gestors can insert programs"
  ON public.free_programs FOR INSERT
  WITH CHECK (public.is_gestor());

CREATE POLICY "Gestors can update programs"
  ON public.free_programs FOR UPDATE
  USING (public.is_gestor());

CREATE POLICY "Gestors can delete programs"
  ON public.free_programs FOR DELETE
  USING (public.is_gestor());

CREATE POLICY "Gestors can manage lessons"
  ON public.free_program_lessons FOR ALL
  USING (public.is_gestor());
