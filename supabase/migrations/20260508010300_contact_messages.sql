create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists "anyone insert message" on public.contact_messages;
create policy "anyone insert message" on public.contact_messages
  for insert to anon, authenticated with check (true);
drop policy if exists "admins read messages" on public.contact_messages;
create policy "admins read messages" on public.contact_messages
  for select to authenticated
  using (has_role(auth.uid(),'owner'::app_role) or has_role(auth.uid(),'admin'::app_role));
drop policy if exists "admins update messages" on public.contact_messages;
create policy "admins update messages" on public.contact_messages
  for update to authenticated
  using (has_role(auth.uid(),'owner'::app_role) or has_role(auth.uid(),'admin'::app_role));
drop policy if exists "admins delete messages" on public.contact_messages;
create policy "admins delete messages" on public.contact_messages
  for delete to authenticated
  using (has_role(auth.uid(),'owner'::app_role) or has_role(auth.uid(),'admin'::app_role));
alter table public.contact_messages replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='contact_messages') then
    execute 'alter publication supabase_realtime add table public.contact_messages';
  end if;
end $$;
