-- Recreate notifications system
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null default 'message',
  title text not null,
  body text,
  link text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "view own notifications" on public.notifications;
create policy "view own notifications" on public.notifications
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "system insert notifications" on public.notifications;
create policy "system insert notifications" on public.notifications
  for insert to authenticated with check (true);

-- Fanout: new contact message -> notify all approved users
create or replace function public.fanout_message_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, related_id, link)
  select p.id, 'message',
    'رسالة جديدة من ' || new.name,
    left(new.message, 200),
    new.id,
    '/dashboard/messages'
  from public.profiles p
  where p.status = 'approved';
  return new;
end; $$;

drop trigger if exists on_contact_message_insert on public.contact_messages;
create trigger on_contact_message_insert
  after insert on public.contact_messages
  for each row execute function public.fanout_message_notification();

-- Fanout: new approved member -> notify everyone else
create or replace function public.fanout_new_member_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_name text; new_role text;
begin
  new_name := coalesce(new.full_name, new.email, 'عضو جديد');
  select role::text into new_role from public.user_roles where user_id = new.id limit 1;
  insert into public.notifications (user_id, kind, title, body, related_id, link)
  select p.id, 'team',
    'تم إضافة عضو جديد: ' || new_name,
    'تم إضافة ' || new_name || coalesce(' بدور ' || new_role, '') || ' إلى الفريق.',
    new.id,
    '/dashboard/team'
  from public.profiles p
  where p.status = 'approved' and p.id <> new.id;
  return new;
end; $$;

drop trigger if exists on_new_member_added on public.profiles;
create trigger on_new_member_added
  after insert on public.profiles
  for each row when (new.status = 'approved')
  execute function public.fanout_new_member_notification();

-- Also fire when a pending profile gets approved
create or replace function public.fanout_member_approved()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_name text; new_role text;
begin
  if old.status is distinct from 'approved' and new.status = 'approved' then
    new_name := coalesce(new.full_name, new.email, 'عضو جديد');
    select role::text into new_role from public.user_roles where user_id = new.id limit 1;
    insert into public.notifications (user_id, kind, title, body, related_id, link)
    select p.id, 'team',
      'تم إضافة عضو جديد: ' || new_name,
      'تم إضافة ' || new_name || coalesce(' بدور ' || new_role, '') || ' إلى الفريق.',
      new.id,
      '/dashboard/team'
    from public.profiles p
    where p.status = 'approved' and p.id <> new.id;
  end if;
  return new;
end; $$;

drop trigger if exists on_member_approved on public.profiles;
create trigger on_member_approved
  after update on public.profiles
  for each row execute function public.fanout_member_approved();

-- Realtime
do $$ begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when others then null;
  end;
end $$;
