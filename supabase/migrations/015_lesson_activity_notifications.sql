-- ============================================================
-- Migration 015: Notificações de curtidas e comentários em aulas
--
-- Quando um aluno curte ou comenta uma aula, todos os gestores
-- recebem notificação com link direto para a aula.
-- ============================================================

-- 1) Notifica gestores quando aluno comenta em aula
CREATE OR REPLACE FUNCTION public.notify_gestors_lesson_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson_id uuid;
  v_training_id uuid;
BEGIN
  -- Se é resposta (parent_id), busca lesson_id do comentário pai
  IF NEW.parent_id IS NOT NULL THEN
    SELECT lc.lesson_id INTO v_lesson_id
      FROM public.lesson_comments lc
     WHERE lc.id = NEW.parent_id;
  ELSE
    v_lesson_id := NEW.lesson_id;
  END IF;

  -- Busca training_id via lesson → module
  SELECT m.training_id INTO v_training_id
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
   WHERE l.id = v_lesson_id;

  -- Notifica cada gestor (exceto o próprio autor)
  INSERT INTO public.notifications (user_id, actor_id, type, lesson_id, training_id, read)
  SELECT p.id, NEW.user_id, 'lesson_comment', v_lesson_id, v_training_id, false
    FROM public.profiles p
   WHERE p.role = 'gestor'
     AND p.id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lesson_comment_notify_gestors ON public.lesson_comments;
CREATE TRIGGER on_lesson_comment_notify_gestors
  AFTER INSERT ON public.lesson_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_gestors_lesson_comment();

-- 2) Notifica gestores quando aluno curte uma aula
CREATE OR REPLACE FUNCTION public.notify_gestors_lesson_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_training_id uuid;
BEGIN
  -- Busca training_id via lesson → module
  SELECT m.training_id INTO v_training_id
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
   WHERE l.id = NEW.lesson_id;

  -- Notifica cada gestor (exceto o próprio autor)
  INSERT INTO public.notifications (user_id, actor_id, type, lesson_id, training_id, read)
  SELECT p.id, NEW.user_id, 'lesson_like', NEW.lesson_id, v_training_id, false
    FROM public.profiles p
   WHERE p.role = 'gestor'
     AND p.id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lesson_like_notify_gestors ON public.lesson_likes;
CREATE TRIGGER on_lesson_like_notify_gestors
  AFTER INSERT ON public.lesson_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_gestors_lesson_like();
