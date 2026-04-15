-- ============================================================
-- Referral credit flow
-- Quando um novo profile é criado com referred_by != null,
-- o indicador ganha R$ 2,00 + notificação.
-- ============================================================

-- 1) Garante coluna referred_by em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2) Atualiza handle_new_user para copiar referred_by do auth metadata para a coluna
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referred_by uuid;
BEGIN
  -- Só aceita se o UUID do metadata de fato existe em profiles (evita créditos fraudulentos).
  BEGIN
    v_referred_by := (NEW.raw_user_meta_data->>'referred_by')::uuid;
  EXCEPTION WHEN others THEN
    v_referred_by := NULL;
  END;

  IF v_referred_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_referred_by) THEN
    v_referred_by := NULL;
  END IF;

  INSERT INTO public.profiles (id, name, role, cpf, whatsapp, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Usuário'),
    'tripulante',
    NEW.raw_user_meta_data->>'cpf',
    NEW.raw_user_meta_data->>'whatsapp',
    v_referred_by
  )
  ON CONFLICT (id) DO UPDATE
    SET referred_by = COALESCE(public.profiles.referred_by, EXCLUDED.referred_by);

  RETURN NEW;
END;
$$;

-- 3) Trigger que credita R$ 2,00 + notificação ao indicador
CREATE OR REPLACE FUNCTION public.handle_referral_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.referred_by IS NULL OR NEW.referred_by = NEW.id THEN
    RETURN NEW;
  END IF;

  -- Credit transaction
  INSERT INTO public.credit_transactions (user_id, type, amount, description)
  VALUES (NEW.referred_by, 'referral', 2.00, 'Indicação de novo aluno');

  -- Atualiza saldo (upsert)
  INSERT INTO public.credits (user_id, balance, updated_at)
  VALUES (NEW.referred_by, 2.00, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.credits.balance + 2.00,
        updated_at = now();

  -- Notificação
  INSERT INTO public.notifications (user_id, actor_id, type, read)
  VALUES (NEW.referred_by, NEW.id, 'credit_received', false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_referral_credit ON public.profiles;
CREATE TRIGGER trg_handle_referral_credit
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referred_by IS NOT NULL)
  EXECUTE FUNCTION public.handle_referral_credit();

-- 4) (Opcional) Backfill: se já existem profiles com referred_by que nunca
-- geraram credit_transactions, cria agora. Idempotente por (user_id, created_at).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id, p.referred_by
    FROM public.profiles p
    WHERE p.referred_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.credit_transactions ct
        WHERE ct.user_id = p.referred_by
          AND ct.type = 'referral'
          AND ct.description = 'Indicação de novo aluno — ' || p.id::text
      )
  LOOP
    INSERT INTO public.credit_transactions (user_id, type, amount, description)
    VALUES (r.referred_by, 'referral', 2.00, 'Indicação de novo aluno — ' || r.id::text);

    INSERT INTO public.credits (user_id, balance, updated_at)
    VALUES (r.referred_by, 2.00, now())
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.credits.balance + 2.00, updated_at = now();

    INSERT INTO public.notifications (user_id, actor_id, type, read)
    VALUES (r.referred_by, r.id, 'credit_received', false);
  END LOOP;
END $$;
