-- Allow users to insert their own profile row (needed for upsert from Settings)
create policy "users insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);
