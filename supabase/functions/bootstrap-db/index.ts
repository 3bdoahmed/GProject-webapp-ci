import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQL = `
do $$ begin create type public.app_role as enum ('owner','admin','engineer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.account_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, avatar_url text, bio text, email text, phone text,
  position text, department text, country text,
  status account_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
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
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$fn$;

create or replace function public.get_user_role(_user_id uuid)
returns app_role language sql stable security definer set search_path = public as $fn$
  select role from public.user_roles where user_id = _user_id
  order by case role when 'owner' then 1 when 'admin' then 2 else 3 end limit 1
$fn$;

create or replace function public.is_approved(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists(select 1 from public.profiles where id = _user_id and status = 'approved')
$fn$;

drop policy if exists "view profiles" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "admins update profiles" on public.profiles;
drop policy if exists "owners delete profiles" on public.profiles;
create policy "view profiles" on public.profiles for select to authenticated using (
  auth.uid() = id or public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'admin')
);
create policy "update own profile" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "admins update profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'admin'));
create policy "owners delete profiles" on public.profiles for delete to authenticated using (
  public.has_role(auth.uid(),'owner') or (public.has_role(auth.uid(),'admin') and not public.has_role(id,'owner'))
);

drop policy if exists "view roles" on public.user_roles;
drop policy if exists "owners insert role" on public.user_roles;
drop policy if exists "admins insert role" on public.user_roles;
drop policy if exists "owners delete role" on public.user_roles;
drop policy if exists "admins delete role" on public.user_roles;
create policy "view roles" on public.user_roles for select to authenticated using (true);
create policy "owners insert role" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'owner'));
create policy "admins insert role" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin') and role <> 'owner');
create policy "owners delete role" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'owner'));
create policy "admins delete role" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin') and role <> 'owner');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare user_count int; is_first boolean; new_status account_status;
begin
  select count(*) into user_count from public.user_roles;
  is_first := user_count = 0 or new.email = 'eslamshaban060@gmail.com';
  new_status := case when is_first then 'approved'::account_status else 'pending'::account_status end;
  insert into public.profiles (id, full_name, email, phone, position, department, country, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email,
    new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'position',
    new.raw_user_meta_data->>'department', new.raw_user_meta_data->>'country', new_status)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, case when is_first then 'owner'::app_role else 'engineer'::app_role end)
  on conflict do nothing;
  return new;
end; $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $fn$ begin new.updated_at = now(); return new; end; $fn$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public) values ('avatars','avatars',true) on conflict (id) do nothing;
drop policy if exists "Avatars publicly viewable" on storage.objects;
drop policy if exists "Users upload own avatar" on storage.objects;
drop policy if exists "Users update own avatar" on storage.objects;
drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Avatars publicly viewable" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatar" on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own avatar" on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own avatar" on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public._exec(sql text) returns void language plpgsql security definer as $fn$ begin execute sql; end; $fn$;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check if schema is initialized AND owner already exists/approved
    const { error: checkErr } = await supabase.from("profiles").select("id").limit(1);
    const schemaReady = !checkErr;
    if (schemaReady) {
      const { data: ownerRow } = await supabase
        .from("profiles")
        .select("id,status")
        .eq("email", "eslamshaban060@gmail.com")
        .maybeSingle();
      if (ownerRow && ownerRow.status === "approved") {
        return new Response(JSON.stringify({ ok: true, alreadyInitialized: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Use admin REST endpoint to run SQL via pg-meta is unavailable; fall back to creating via raw fetch to /pg endpoint isn't possible.
    // Instead: create a tiny RPC by calling the Supabase Database REST 'rpc' once we have _exec — but we don't have it yet.
    // Workaround: use the Supabase SQL endpoint via the management API requires PAT. Not available here.
    // So we use the postgres-meta? Not exposed. Use direct PG via service role: not possible from edge.
    // The reliable path: create the function once via supabase.rpc requires it to exist.
    // SOLUTION: use the pg connection through `Deno.connect` to PG - too heavy.
    // Easiest: use postgres deno driver.
    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");
    const client = new Client(dbUrl);
    await client.connect();
    if (!schemaReady) {
    // Split on semicolons that end a statement (naive but works since our SQL uses $fn$ delimited bodies)
    const stmts: string[] = [];
    let buf = ""; let inDollar = false;
    for (const line of SQL.split("\n")) {
      if (line.includes("$fn$")) {
        const occurrences = (line.match(/\$fn\$/g) || []).length;
        if (occurrences % 2 === 1) inDollar = !inDollar;
      }
      buf += line + "\n";
      if (!inDollar && line.trim().endsWith(";")) {
        stmts.push(buf); buf = "";
      }
    }
    if (buf.trim()) stmts.push(buf);
    for (const s of stmts) {
      if (s.trim()) await client.queryArray(s);
    }
    }

    // Ensure owner account exists
    const ownerEmail = "eslamshaban060@gmail.com";
    const { data: existing } = await supabase.auth.admin.listUsers();
    const owner = existing?.users?.find((u: any) => u.email === ownerEmail);
    let ownerId = owner?.id;
    if (!ownerId) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: ownerEmail,
        password: "123123123",
        email_confirm: true,
        user_metadata: { full_name: "Eslam Shaban" },
      });
      if (createErr) throw createErr;
      ownerId = created.user!.id;
    } else {
      await supabase.auth.admin.updateUserById(ownerId, {
        password: "123123123",
        email_confirm: true,
      });
    }

    await client.queryArray(
      `insert into public.profiles (id, full_name, email, status) values ($1, 'Eslam Shaban', $2, 'approved') on conflict (id) do update set status='approved'`,
      [ownerId, ownerEmail],
    );
    await client.queryArray(`delete from public.user_roles where user_id=$1`, [ownerId]);
    await client.queryArray(`insert into public.user_roles (user_id, role) values ($1, 'owner')`, [ownerId]);

    await client.end();

    return new Response(JSON.stringify({ ok: true, initialized: true, ownerId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});