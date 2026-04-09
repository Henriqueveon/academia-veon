-- ============================================
-- Migration: Registration Links (Auto-cadastro)
-- ============================================

-- Add cpf and whatsapp to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;

-- Update trigger to also read cpf/whatsapp from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, cpf, whatsapp)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Novo Usuário'),
    'tripulante',
    new.raw_user_meta_data->>'cpf',
    new.raw_user_meta_data->>'whatsapp'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Registration Links table
CREATE TABLE public.registration_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  description text,
  active boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.registration_links ENABLE ROW LEVEL SECURITY;

-- Gestors can do everything with registration_links
CREATE POLICY "Gestors can manage registration_links"
  ON public.registration_links FOR ALL
  USING (public.is_gestor());

-- Anyone (even anon) can read active links by slug (needed for registration page)
CREATE POLICY "Anyone can read active registration_links"
  ON public.registration_links FOR SELECT
  USING (active = true);

-- ============================================
-- Public self-register RPC
-- Callable by anon users (no auth required)
-- Security: validated by link slug
-- ============================================
CREATE OR REPLACE FUNCTION public.public_self_register(
  link_slug text,
  user_name text,
  user_email text,
  user_password text,
  user_cpf text DEFAULT NULL,
  user_whatsapp text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
  v_user_id uuid;
  v_existing uuid;
BEGIN
  -- Validate the registration link
  SELECT * INTO v_link
  FROM public.registration_links
  WHERE slug = link_slug AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link de cadastro inválido ou desativado';
  END IF;

  -- Check if email already exists
  SELECT id INTO v_existing FROM auth.users WHERE email = user_email;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Este email já está cadastrado';
  END IF;

  -- Validate password length
  IF length(user_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres';
  END IF;

  -- Create auth user
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    user_email,
    crypt(user_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', user_name, 'cpf', user_cpf, 'whatsapp', user_whatsapp),
    'authenticated',
    'authenticated'
  );

  -- Create identity record (required for Supabase auth to work)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    user_email,
    jsonb_build_object('sub', v_user_id::text, 'email', user_email),
    'email',
    now(), now(), now()
  );

  -- Create profile (trigger may also fire, ON CONFLICT handles it)
  INSERT INTO public.profiles (id, name, role, cpf, whatsapp)
  VALUES (v_user_id, user_name, 'tripulante', user_cpf, user_whatsapp)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    cpf = EXCLUDED.cpf,
    whatsapp = EXCLUDED.whatsapp;

  -- Assign to the group configured in the link
  INSERT INTO public.user_groups (user_id, group_id)
  VALUES (v_user_id, v_link.group_id);

  RETURN json_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- Grant anon access to call the function
GRANT EXECUTE ON FUNCTION public.public_self_register TO anon;
GRANT EXECUTE ON FUNCTION public.public_self_register TO authenticated;
