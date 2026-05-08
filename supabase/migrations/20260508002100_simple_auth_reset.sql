-- Wipe and rebuild a simple auth/profiles system

-- 1) Drop trigger + helper functions tied to old system
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.get_user_role(uuid) cascade;
drop function if exists public.is_approved(uuid) cascade;

-- 2) Drop tables
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;

-- 3) Drop enums
drop type if exists public.app_role cascade;
drop type if exists public.account_status cascade;

-- 4) Delete all users
delete from auth.users;

-- 5) Recreate simple profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  position text,
  department text,
  country text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone signed in can view all profiles
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

-- Users can update only their own profile
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Users can insert their own profile (fallback to trigger)
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- Users can delete only their own profile
create policy "profiles_delete_own"
  on public.profiles for delete to authenticated
  using (auth.uid() = id);

-- 6) Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, position, department, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'position',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'country'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7) updated_at trigger
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
