do $$ begin
  create type public.app_role as enum ('owner','admin','engineer');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, avatar_url text, bio text, email text, phone text,
  position text, department text, country text,
  is_approved boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.get_user_role(_user_id uuid)
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = _user_id
  order by case role when 'owner' then 1 when 'admin' then 2 else 3 end limit 1
$$;

create or replace function public.is_approved(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_approved from public.profiles where id = _user_id), false)
$$;

drop policy if exists "Users view own profile" on public.profiles;
drop policy if exists "Approved users view all profiles" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Owners and admins can approve users" on public.profiles;
drop policy if exists "Owners and admins can delete profiles" on public.profiles;
create policy "Users view own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Approved users view all profiles" on public.profiles for select to authenticated using (public.is_approved(auth.uid()));
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Owners and admins can approve users" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'admin'));
create policy "Owners and admins can delete profiles" on public.profiles for delete to authenticated using (public.has_role(auth.uid(),'owner') or (public.has_role(auth.uid(),'admin') and not public.has_role(id,'owner')));

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

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare user_count int; is_first boolean;
begin
  select count(*) into user_count from public.user_roles;
  is_first := user_count = 0;
  insert into public.profiles (id, full_name, email, avatar_url, phone, position, department, country, is_approved, approved_at)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'position',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'country',
    is_first,
    case when is_first then now() else null end
  ) on conflict (id) do nothing;
  if is_first then
    insert into public.user_roles (user_id, role) values (new.id, 'owner') on conflict do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.protect_approval_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = new.id and not (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'admin')) then
    new.is_approved := old.is_approved;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_protect_approval on public.profiles;
create trigger profiles_protect_approval before update on public.profiles for each row execute function public.protect_approval_fields();

create or replace function public.approve_user(_target uuid, _role app_role)
returns void language plpgsql security definer set search_path = public as $$
declare approver_role app_role;
begin
  if not (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'admin')) then
    raise exception 'Not authorized';
  end if;
  approver_role := public.get_user_role(auth.uid());
  if approver_role = 'admin' and _role = 'owner' then
    raise exception 'Admins cannot grant owner role';
  end if;
  update public.profiles set is_approved = true, approved_by = auth.uid(), approved_at = now() where id = _target;
  insert into public.user_roles (user_id, role) values (_target, _role) on conflict (user_id, role) do nothing;
end; $$;

insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict (id) do nothing;
drop policy if exists "Avatars publicly viewable" on storage.objects;
drop policy if exists "Users upload own avatar" on storage.objects;
drop policy if exists "Users update own avatar" on storage.objects;
drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Avatars publicly viewable" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatar" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own avatar" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own avatar" on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.profiles (id, full_name, email, is_approved, approved_at)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), u.email, true, now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where email = 'eslamshaban060@gmail.com'
on conflict do nothing;
update public.profiles set is_approved = true, approved_at = coalesce(approved_at, now())
where id in (select id from auth.users where email = 'eslamshaban060@gmail.com');

update auth.users
set encrypted_password = crypt('123123123', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where email = 'eslamshaban060@gmail.com';
