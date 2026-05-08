const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQL = `
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
drop policy if exists "insert own notes" on public.notes;
drop policy if exists "update own notes" on public.notes;
drop policy if exists "delete own notes" on public.notes;
drop policy if exists "public select notes" on public.notes;
drop policy if exists "public insert notes" on public.notes;
drop policy if exists "public update notes" on public.notes;
drop policy if exists "public delete notes" on public.notes;
create policy "public select notes" on public.notes for select to public using (true);
create policy "public insert notes" on public.notes for insert to public with check (true);
create policy "public update notes" on public.notes for update to public using (true) with check (true);
create policy "public delete notes" on public.notes for delete to public using (true);
drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();
create or replace function public.fanout_note_notification()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare author text;
begin
  author := coalesce(new.author_name, 'Team member');
  insert into public.notifications (user_id, kind, title, body, related_id, link)
  select p.id, 'note', 'ملاحظة جديدة من ' || author, coalesce(new.title, '') || E'\n' || left(new.content, 240), new.id, '/dashboard/notes'
  from public.profiles p
  where p.status = 'approved' and p.id <> new.user_id;
  return new;
end; $fn$;
drop trigger if exists notes_fanout on public.notes;
create trigger notes_fanout after insert on public.notes for each row execute function public.fanout_note_notification();
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");
    const client = new Client(dbUrl);
    await client.connect();
    await client.queryArray(SQL);
    try { await client.queryArray(`alter publication supabase_realtime add table public.notes`); } catch (_) {}
    await client.end();
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});