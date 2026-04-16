-- ============================================================
-- Migration 012: Notificação "Treinamento liberado"
--
-- Dispara notificação para o aluno quando um treinamento é
-- liberado para ele, seja via:
--   a) training_groups INSERT  (turma recebe acesso ao treinamento)
--   b) user_trainings INSERT   (acesso direto ao aluno)
--   c) user_groups INSERT      (aluno entra em turma que já tem treinamentos)
-- ============================================================

-- ────────────────────────────────────────────────
-- 1) Treinamento liberado para uma turma
--    → notifica cada aluno da turma
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_training_released_to_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, training_id, type, read)
  SELECT ug.user_id, NEW.training_id, 'training_released', false
    FROM public.user_groups ug
   WHERE ug.group_id = NEW.group_id
     -- evita duplicar se o aluno já tem acesso direto
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n
        WHERE n.user_id = ug.user_id
          AND n.training_id = NEW.training_id
          AND n.type = 'training_released'
          AND n.created_at > now() - interval '1 minute'
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_training_group_granted ON public.training_groups;
CREATE TRIGGER on_training_group_granted
  AFTER INSERT ON public.training_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_training_released_to_group();

-- ────────────────────────────────────────────────
-- 2) Acesso direto ao aluno (user_trainings)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_training_released_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Evita duplicar se já notificou recentemente (ex: turma + direto ao mesmo tempo)
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications n
     WHERE n.user_id = NEW.user_id
       AND n.training_id = NEW.training_id
       AND n.type = 'training_released'
       AND n.created_at > now() - interval '1 minute'
  ) THEN
    INSERT INTO public.notifications (user_id, training_id, type, read)
    VALUES (NEW.user_id, NEW.training_id, 'training_released', false);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_training_granted ON public.user_trainings;
CREATE TRIGGER on_user_training_granted
  AFTER INSERT ON public.user_trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_training_released_to_user();

-- ────────────────────────────────────────────────
-- 3) Aluno entra numa turma que já tem treinamentos
--    → notifica sobre cada treinamento da turma
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_trainings_on_group_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, training_id, type, read)
  SELECT NEW.user_id, tg.training_id, 'training_released', false
    FROM public.training_groups tg
   WHERE tg.group_id = NEW.group_id
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n
        WHERE n.user_id = NEW.user_id
          AND n.training_id = tg.training_id
          AND n.type = 'training_released'
          AND n.created_at > now() - interval '1 minute'
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_group_joined_notify_trainings ON public.user_groups;
CREATE TRIGGER on_user_group_joined_notify_trainings
  AFTER INSERT ON public.user_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_trainings_on_group_join();
