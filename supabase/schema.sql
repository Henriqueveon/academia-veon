-- ============================================
-- Academia Veon - Database Schema
-- ============================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null default 'tripulante' check (role in ('tripulante', 'gestor')),
  created_at timestamptz default now()
);

-- Groups / Turmas
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- User-Group membership
create table public.user_groups (
  user_id uuid references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  primary key (user_id, group_id)
);

-- Modules
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Module-Group access (which groups can see which modules)
create table public.module_groups (
  module_id uuid references public.modules(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  primary key (module_id, group_id)
);

-- Lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete cascade not null,
  title text not null,
  description text,
  youtube_url text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Lesson Progress
create table public.lesson_progress (
  user_id uuid references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  watched boolean default false,
  watched_at timestamptz,
  primary key (user_id, lesson_id)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.user_groups enable row level security;
alter table public.modules enable row level security;
alter table public.module_groups enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;

-- Helper: check if user is gestor
create or replace function public.is_gestor()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'gestor'
  );
$$ language sql security definer;

-- PROFILES policies
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Gestors can read all profiles"
  on public.profiles for select
  using (public.is_gestor());

create policy "Gestors can insert profiles"
  on public.profiles for insert
  with check (public.is_gestor());

create policy "Gestors can update profiles"
  on public.profiles for update
  using (public.is_gestor());

create policy "Gestors can delete profiles"
  on public.profiles for delete
  using (public.is_gestor());

-- GROUPS policies
create policy "Anyone authenticated can read groups"
  on public.groups for select
  using (auth.uid() is not null);

create policy "Gestors can manage groups"
  on public.groups for all
  using (public.is_gestor());

-- USER_GROUPS policies
create policy "Users can read own memberships"
  on public.user_groups for select
  using (user_id = auth.uid());

create policy "Gestors can read all memberships"
  on public.user_groups for select
  using (public.is_gestor());

create policy "Gestors can manage memberships"
  on public.user_groups for all
  using (public.is_gestor());

-- MODULES policies
create policy "Users can read accessible modules"
  on public.modules for select
  using (
    public.is_gestor()
    or exists (
      select 1 from public.module_groups mg
      join public.user_groups ug on ug.group_id = mg.group_id
      where mg.module_id = modules.id and ug.user_id = auth.uid()
    )
  );

create policy "Gestors can manage modules"
  on public.modules for all
  using (public.is_gestor());

-- MODULE_GROUPS policies
create policy "Anyone authenticated can read module_groups"
  on public.module_groups for select
  using (auth.uid() is not null);

create policy "Gestors can manage module_groups"
  on public.module_groups for all
  using (public.is_gestor());

-- LESSONS policies
create policy "Users can read accessible lessons"
  on public.lessons for select
  using (
    public.is_gestor()
    or exists (
      select 1 from public.module_groups mg
      join public.user_groups ug on ug.group_id = mg.group_id
      where mg.module_id = lessons.module_id and ug.user_id = auth.uid()
    )
  );

create policy "Gestors can manage lessons"
  on public.lessons for all
  using (public.is_gestor());

-- LESSON_PROGRESS policies
create policy "Users can read own progress"
  on public.lesson_progress for select
  using (user_id = auth.uid());

create policy "Users can insert own progress"
  on public.lesson_progress for insert
  with check (user_id = auth.uid());

create policy "Users can update own progress"
  on public.lesson_progress for update
  using (user_id = auth.uid());

create policy "Gestors can read all progress"
  on public.lesson_progress for select
  using (public.is_gestor());

-- ============================================
-- Auto-create profile on signup (trigger)
-- ============================================
-- Note: Profile is created from the frontend during signup by the gestor.
-- This trigger is a fallback for safety.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Novo Usuário'), 'tripulante')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
