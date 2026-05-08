import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function ensureOtpTable() {
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return;
  const client = new Client(dbUrl);
  await client.connect();
  try {
    await client.queryArray(`
      create table if not exists public.password_reset_otps (
        id uuid primary key default gen_random_uuid(),
        email text not null,
        code_hash text not null,
        expires_at timestamptz not null,
        used boolean not null default false,
        attempts int not null default 0,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_password_reset_otps_email on public.password_reset_otps (email, created_at desc);
      alter table public.password_reset_otps enable row level security;
    `);
  } finally {
    await client.end();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { email, code, newPassword, verifyOnly } = await req.json();
    if (!email || !code) {
      return new Response(JSON.stringify({ error: "email and code required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const codeStr = String(code).trim();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);
    await ensureOtpTable();

    const codeHash = await sha256(`${cleanEmail}:${codeStr}`);
    const { data: rows, error: lookupErr } = await admin
      .from("password_reset_otps")
      .select("id, expires_at, used, attempts")
      .eq("email", cleanEmail)
      .eq("code_hash", codeHash)
      .order("created_at", { ascending: false })
      .limit(1);
    if (lookupErr) {
      console.error("OTP lookup failed", lookupErr);
      return new Response(JSON.stringify({ error: "Could not verify code" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const row = rows?.[0];
    if (!row) {
      return new Response(JSON.stringify({ error: "Invalid code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (row.used) {
      return new Response(JSON.stringify({ error: "Code already used" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Code expired" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (verifyOnly) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!newPassword || String(newPassword).length < 6) {
      return new Response(JSON.stringify({ error: "Password too short" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile } = await admin.from("profiles").select("id").eq("email", cleanEmail).maybeSingle();
    if (!profile?.id) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(profile.id, { password: String(newPassword) });
    if (updErr) {
      console.error("updateUserById", updErr);
      const code = (updErr as any).code;
      const friendly = code === "weak_password"
        ? "كلمة السر ضعيفة أو مسربة من قبل. اختر كلمة أقوى وفريدة (8+ حروف وأرقام ورموز)."
        : updErr.message;
      return new Response(JSON.stringify({ error: friendly, code }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("password_reset_otps").update({ used: true }).eq("id", row.id);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("reset-password-otp", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});