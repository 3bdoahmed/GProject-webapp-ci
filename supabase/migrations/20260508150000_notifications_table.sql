-- Notifications table separate from contact_messages
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

-- Trigger: when a new contact_message is inserted, fan-out a notification per approved user
create or replace function public.fanout_message_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, related_id, link)
  select p.id, 'message',
    'New message from ' || new.name,
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

alter publication supabase_realtime add table public.notifications;
