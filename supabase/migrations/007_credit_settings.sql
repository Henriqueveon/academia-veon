-- ============================================================
-- Credit Settings — singleton que o gestor configura.
-- Hoje só tem referral_amount; pode crescer no futuro.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  referral_amount numeric(10,2) NOT NULL DEFAULT 2.00,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.credit_settings (id, referral_amount)
VALUES (1, 2.00)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.credit_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read credit_settings" ON public.credit_settings;
CREATE POLICY "read credit_settings"
  ON public.credit_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "gestor updates credit_settings" ON public.credit_settings;
CREATE POLICY "gestor updates credit_settings"
  ON public.credit_settings FOR UPDATE
  USING (public.is_gestor())
  WITH CHECK (public.is_gestor());

-- Atualiza o trigger do referral para usar o valor configurado
CREATE OR REPLACE FUNCTION public.handle_profile_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_meta jsonb;
  v_ref uuid;
  v_amount numeric(10,2);
BEGIN
  BEGIN
    IF NEW.referred_by IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT raw_user_meta_data INTO v_meta FROM auth.users WHERE id = NEW.id;
    IF v_meta IS NULL THEN RETURN NEW; END IF;

    BEGIN
      v_ref := (v_meta->>'referred_by')::uuid;
    EXCEPTION WHEN others THEN
      v_ref := NULL;
    END;

    IF v_ref IS NULL OR v_ref = NEW.id THEN RETURN NEW; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_ref) THEN RETURN NEW; END IF;

    SELECT COALESCE(referral_amount, 2.00) INTO v_amount FROM public.credit_settings WHERE id = 1;
    v_amount := COALESCE(v_amount, 2.00);

    UPDATE public.profiles SET referred_by = v_ref WHERE id = NEW.id;

    INSERT INTO public.credit_transactions (user_id, type, amount, description)
    VALUES (v_ref, 'referral', v_amount, 'Indicação de novo aluno');

    INSERT INTO public.credits (user_id, balance, updated_at)
    VALUES (v_ref, v_amount, now())
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.credits.balance + v_amount,
          updated_at = now();

    INSERT INTO public.notifications (user_id, actor_id, type, read)
    VALUES (v_ref, NEW.id, 'credit_received', false);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'handle_profile_referral falhou para user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
