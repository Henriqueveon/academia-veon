-- Migration 011: Corrige notificações de ciclo de vida de posts
--
-- 1) `notify_followers_new_post()` passa a disparar apenas quando o post
--    fica `ready`. Antes disparava no INSERT (status ainda 'uploading'),
--    gerando notificações fantasmas quando o upload era interrompido.
--
-- 2) Nova função + trigger: quando um post `ready` é APAGADO, todos os
--    gestores recebem uma notificação "X apagou um post na Comunidade".

-- ============================================================
-- 1) Corrige notificação de post novo
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_followers_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Só notifica quando o post está visível para a comunidade
  IF NEW.status IS DISTINCT FROM 'ready' THEN
    RETURN NEW;
  END IF;

  -- Em UPDATEs, só notifica na TRANSIÇÃO para 'ready' (evita duplicar)
  IF TG_OP = 'UPDATE' AND OLD.status = 'ready' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, post_id)
  SELECT f.follower_id, NEW.user_id, 'followed_user_post', NEW.id
    FROM public.follows f
   WHERE f.following_id = NEW.user_id;

  RETURN NEW;
END;
$function$;

-- Substitui o trigger antigo (que disparava só no INSERT) por um que
-- também observa UPDATE de status.
DROP TRIGGER IF EXISTS on_new_post ON public.posts;
CREATE TRIGGER on_new_post
  AFTER INSERT OR UPDATE OF status ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_new_post();

-- ============================================================
-- 2) Notifica gestores quando um post `ready` é apagado
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_gestors_post_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Só notifica se o post era visível (ignora limpeza de rascunhos
  -- abortados e sweeps de uploads interrompidos, que já são 'failed').
  IF OLD.status IS DISTINCT FROM 'ready' THEN
    RETURN OLD;
  END IF;

  -- Insere uma notificação para CADA gestor (exceto o próprio autor,
  -- caso um gestor apague o próprio post).
  INSERT INTO public.notifications (user_id, actor_id, type)
  SELECT p.id, OLD.user_id, 'post_deleted_by_user'
    FROM public.profiles p
   WHERE p.role = 'gestor'
     AND p.id <> OLD.user_id;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS on_post_deleted_notify_gestors ON public.posts;
CREATE TRIGGER on_post_deleted_notify_gestors
  AFTER DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_gestors_post_deleted();
