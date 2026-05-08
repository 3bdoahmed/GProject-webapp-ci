const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQL = `
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
create policy "view own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "system insert notifications" on public.notifications;
create policy "system insert notifications" on public.notifications for insert to authenticated with check (true);

create or replace function public.fanout_message_notification()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.notifications (user_id, kind, title, body, related_id, link)
  select p.id, 'message', 'رسالة جديدة من ' || new.name, left(new.message, 200), new.id, '/dashboard/messages'
  from public.profiles p where p.status = 'approved';
  return new;
end; $fn$;

drop trigger if exists on_contact_message_insert on public.contact_messages;
create trigger on_contact_message_insert after insert on public.contact_messages for each row execute function public.fanout_message_notification();

create or replace function public.fanout_new_member_notification()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare new_name text; new_role text;
begin
  new_name := coalesce(new.full_name, new.email, 'عضو جديد');
  select role::text into new_role from public.user_roles where user_id = new.id limit 1;
  insert into public.notifications (user_id, kind, title, body, related_id, link)
  select p.id, 'team', 'تم إضافة عضو جديد: ' || new_name,
    'تم إضافة ' || new_name || coalesce(' بدور ' || new_role, '') || ' إلى الفريق.', new.id, '/dashboard/team'
  from public.profiles p where p.status = 'approved' and p.id <> new.id;
  return new;
end; $fn$;

drop trigger if exists on_new_member_added on public.profiles;
create trigger on_new_member_added after insert on public.profiles for each row when (new.status = 'approved') execute function public.fanout_new_member_notification();

create or replace function public.fanout_member_approved()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare new_name text; new_role text;
begin
  if old.status is distinct from 'approved' and new.status = 'approved' then
    new_name := coalesce(new.full_name, new.email, 'عضو جديد');
    select role::text into new_role from public.user_roles where user_id = new.id limit 1;
    insert into public.notifications (user_id, kind, title, body, related_id, link)
    select p.id, 'team', 'تم إضافة عضو جديد: ' || new_name,
      'تم إضافة ' || new_name || coalesce(' بدور ' || new_role, '') || ' إلى الفريق.', new.id, '/dashboard/team'
    from public.profiles p where p.status = 'approved' and p.id <> new.id;
  end if;
  return new;
end; $fn$;

drop trigger if exists on_member_approved on public.profiles;
create trigger on_member_approved after update on public.profiles for each row execute function public.fanout_member_approved();

do $blk$ begin
  begin alter publication supabase_realtime add table public.notifications; exception when others then null; end;
end $blk$;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");
    const client = new Client(dbUrl);
    await client.connect();
    const stmts: string[] = [];
    let buf = ""; let inDollar = false;
    for (const line of SQL.split("\n")) {
      const occ = (line.match(/\$fn\$/g) || []).length + (line.match(/\$blk\$/g) || []).length;
      if (occ % 2 === 1) inDollar = !inDollar;
      buf += line + "\n";
      if (!inDollar && line.trim().endsWith(";")) { stmts.push(buf); buf = ""; }
    }
    if (buf.trim()) stmts.push(buf);
    for (const s of stmts) { if (s.trim()) await client.queryArray(s); }
    await client.end();
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
