-- Roles enum
do $$ begin
  create type public.app_role as enum ('owner','admin','engineer');
exception when duplicate_object then null; end $$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, avatar_url text, bio text, email text, phone text,
  position text, department text, country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Roles table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Helper functions
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.get_user_role(_user_id uuid)
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = _user_id
  order by case role when 'owner' then 1 when 'admin' then 2 else 3 end limit 1
$$;

-- RLS for profiles
drop policy if exists "Users view own profile" on public.profiles;
drop policy if exists "Authenticated view all profiles" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Owners and admins can delete profiles" on public.profiles;
create policy "Authenticated view all profiles" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Owners and admins can delete profiles" on public.profiles for delete to authenticated using (public.has_role(auth.uid(),'owner') or (public.has_role(auth.uid(),'admin') and not public.has_role(id,'owner')));

-- RLS for user_roles
drop policy if exists "Authenticated view roles" on public.user_roles;
drop policy if exists "Owners insert any role" on public.user_roles;
drop policy if exists "Admins insert non-owner roles" on public.user_roles;
drop policy if exists "Owners delete any role" on public.user_roles;
drop policy if exists "Admins delete non-owner roles" on public.user_roles;
create policy "Authenticated view roles" on public.user_roles for select to authenticated using (true);
create policy "Owners insert any role" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'owner'));
create policy "Admins insert non-owner roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin') and role <> 'owner');
create policy "Owners delete any role" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'owner'));
create policy "Admins delete non-owner roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin') and role <> 'owner');

-- Auto-create profile + auto-assign role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare user_count int; is_first boolean;
begin
  select count(*) into user_count from public.user_roles;
  is_first := user_count = 0;
  insert into public.profiles (id, full_name, email, phone, position, department, country)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'position',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'country'
  ) on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, case when is_first then 'owner'::app_role else 'engineer'::app_role end)
  on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Storage bucket for avatars
insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict (id) do nothing;
drop policy if exists "Avatars publicly viewable" on storage.objects;
drop policy if exists "Users upload own avatar" on storage.objects;
drop policy if exists "Users update own avatar" on storage.objects;
drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Avatars publicly viewable" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatar" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own avatar" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own avatar" on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Backfill existing users (e.g. eslamshaban060@gmail.com)
insert into public.profiles (id, full_name, email)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), u.email
from auth.users u
left join public.profiles p on p.id = u.id where p.id is null;

-- Make eslamshaban060@gmail.com the owner
delete from public.user_roles where user_id in (select id from auth.users where email='eslamshaban060@gmail.com');
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where email = 'eslamshaban060@gmail.com';

-- Reset owner password and confirm
update auth.users
set encrypted_password = crypt('123123123', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where email = 'eslamshaban060@gmail.com';
