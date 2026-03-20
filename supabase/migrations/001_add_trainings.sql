-- 1. Criar tabela trainings
CREATE TABLE public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  thumbnail_url text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Criar tabela training_groups (substitui module_groups)
CREATE TABLE public.training_groups (
  training_id uuid REFERENCES public.trainings(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  PRIMARY KEY (training_id, group_id)
);

-- 3. Adicionar training_id em modules
ALTER TABLE public.modules
  ADD COLUMN training_id uuid REFERENCES public.trainings(id) ON DELETE CASCADE;

-- 4. Migrar dados existentes
DO $$
DECLARE
  test_training_id uuid;
BEGIN
  INSERT INTO public.trainings (title, description, sort_order)
  VALUES ('Treinamento Geral', 'Treinamento inicial com todos os módulos existentes', 0)
  RETURNING id INTO test_training_id;

  UPDATE public.modules SET training_id = test_training_id;

  INSERT INTO public.training_groups (training_id, group_id)
  SELECT DISTINCT test_training_id, mg.group_id
  FROM public.module_groups mg;
END $$;

-- 5. Tornar training_id NOT NULL
ALTER TABLE public.modules
  ALTER COLUMN training_id SET NOT NULL;

-- 6. RLS para trainings
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read accessible trainings"
  ON public.trainings FOR SELECT
  USING (
    public.is_gestor()
    OR EXISTS (
      SELECT 1 FROM public.training_groups tg
      JOIN public.user_groups ug ON ug.group_id = tg.group_id
      WHERE tg.training_id = trainings.id AND ug.user_id = auth.uid()
    )
  );

CREATE POLICY "Gestors can manage trainings"
  ON public.trainings FOR ALL
  USING (public.is_gestor());

CREATE POLICY "Anyone authenticated can read training_groups"
  ON public.training_groups FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Gestors can manage training_groups"
  ON public.training_groups FOR ALL
  USING (public.is_gestor());

-- 7. Atualizar RLS de modules
DROP POLICY "Users can read accessible modules" ON public.modules;
CREATE POLICY "Users can read accessible modules"
  ON public.modules FOR SELECT
  USING (
    public.is_gestor()
    OR EXISTS (
      SELECT 1 FROM public.training_groups tg
      JOIN public.user_groups ug ON ug.group_id = tg.group_id
      WHERE tg.training_id = modules.training_id AND ug.user_id = auth.uid()
    )
  );

-- 8. Atualizar RLS de lessons
DROP POLICY "Users can read accessible lessons" ON public.lessons;
CREATE POLICY "Users can read accessible lessons"
  ON public.lessons FOR SELECT
  USING (
    public.is_gestor()
    OR EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.training_groups tg ON tg.training_id = m.training_id
      JOIN public.user_groups ug ON ug.group_id = tg.group_id
      WHERE m.id = lessons.module_id AND ug.user_id = auth.uid()
    )
  );
