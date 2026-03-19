-- ============================================
-- Admin functions for user management
-- Only gestors can execute these
-- ============================================

-- Get all users with email (from auth.users + profiles)
create or replace function public.admin_get_users()
returns table(id uuid, email text, name text, role text, created_at timestamptz) as $$
begin
  if not public.is_gestor() then
    raise exception 'Não autorizado';
  end if;
  return query
    select au.id, au.email::text, p.name, p.role, p.created_at
    from auth.users au
    join public.profiles p on p.id = au.id
    order by p.created_at desc;
end;
$$ language plpgsql security definer;

-- Confirm user email (skip email verification)
create or replace function public.admin_confirm_user_email(target_user_id uuid)
returns void as $$
begin
  if not public.is_gestor() then
    raise exception 'Não autorizado';
  end if;
  update auth.users
  set email_confirmed_at = now(),
      raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb
  where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Update user email
create or replace function public.admin_update_user_email(target_user_id uuid, new_email text)
returns void as $$
begin
  if not public.is_gestor() then
    raise exception 'Não autorizado';
  end if;
  update auth.users
  set email = new_email, email_confirmed_at = now()
  where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Update user password
create or replace function public.admin_update_user_password(target_user_id uuid, new_password text)
returns void as $$
begin
  if not public.is_gestor() then
    raise exception 'Não autorizado';
  end if;
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf'))
  where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Delete user completely (removes from auth.users, profiles cascade)
create or replace function public.admin_delete_user(target_user_id uuid)
returns void as $$
begin
  if not public.is_gestor() then
    raise exception 'Não autorizado';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$ language plpgsql security definer;
