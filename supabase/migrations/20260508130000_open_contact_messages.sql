-- Open contact_messages reads/updates/deletes to all authenticated dashboard users
drop policy if exists "admins read messages" on public.contact_messages;
drop policy if exists "admins update messages" on public.contact_messages;
drop policy if exists "admins delete messages" on public.contact_messages;
drop policy if exists "auth read messages" on public.contact_messages;
drop policy if exists "auth update messages" on public.contact_messages;
drop policy if exists "auth delete messages" on public.contact_messages;

create policy "auth read messages" on public.contact_messages
  for select to authenticated using (true);
create policy "auth update messages" on public.contact_messages
  for update to authenticated using (true) with check (true);
create policy "auth delete messages" on public.contact_messages
  for delete to authenticated using (true);
