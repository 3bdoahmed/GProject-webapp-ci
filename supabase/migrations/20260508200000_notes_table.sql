create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  author_name text,
  title text not null,
  content text not null,
  category text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "view notes" on public.notes;
create policy "view notes" on public.notes for select to authenticated using (true);

drop policy if exists "insert own notes" on public.notes;
create policy "insert own notes" on public.notes for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own notes" on public.notes;
create policy "update own notes" on public.notes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own notes" on public.notes;
create policy "delete own notes" on public.notes for delete to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin'));

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();

create or replace function public.fanout_note_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare author text;
begin
  author := coalesce(new.author_name, 'Team member');
  insert into public.notifications (user_id, kind, title, body, related_id, link)
  select p.id, 'note', 'ملاحظة جديدة من ' || author, coalesce(new.title, '') || E'\n' || left(new.content, 240), new.id, '/dashboard/notes'
  from public.profiles p
  where p.status = 'approved' and p.id <> new.user_id;
  return new;
end; $$;

drop trigger if exists notes_fanout on public.notes;
create trigger notes_fanout after insert on public.notes for each row execute function public.fanout_note_notification();

alter publication supabase_realtime add table public.notes;
