import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

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

function buildRawEmail(to: string, subject: string, html: string) {
  const boundary = "b_" + Math.random().toString(36).slice(2);
  const msg = [
    `To: ${to}`,
    `From: Solarix <eslamshaban060@gmail.com>`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: text/html; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(html))),
  ].join("\r\n");
  return btoa(msg).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function emailHtml(code: string) {
  return `
<!doctype html>
<html dir="ltr" lang="en">
<body style="margin:0;padding:0;background:#f5f1e8;font-family:'Space Grotesk','Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px -20px rgba(7,52,38,0.18)">
        <tr><td style="background:linear-gradient(135deg,#076647 0%,#13a073 100%);padding:36px 32px;text-align:center">
          <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:18px;line-height:56px;font-size:28px;color:#f5d27a;font-weight:900">⚡</div>
          <h1 style="margin:18px 0 4px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.02em">Solarix</h1>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:13px;font-weight:500">Smart Solar Power Management</p>
        </td></tr>
        <tr><td style="padding:36px 32px 24px">
          <h2 style="margin:0 0 8px;color:#073426;font-size:22px;font-weight:800">Password reset code</h2>
          <p style="margin:0 0 28px;color:#4a6760;font-size:14px;line-height:1.6">
            استخدم الكود التالي لإعادة تعيين كلمة المرور. الكود صالح لمدة 10 دقائق.<br/>
            Use the code below to reset your password. It expires in 10 minutes.
          </p>
          <div style="background:linear-gradient(135deg,#f9f5ea 0%,#fdf8ec 100%);border:2px dashed #d4a93a;border-radius:18px;padding:22px;text-align:center">
            <p style="margin:0 0 10px;color:#8b6f1f;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase">Verification Code</p>
            <div style="font-family:'Courier New',monospace;font-size:38px;font-weight:900;letter-spacing:14px;color:#073426">${code}</div>
          </div>
          <p style="margin:24px 0 0;color:#7a8c87;font-size:12px;line-height:1.6">
            لو مش انت اللي طلبت ده، تجاهل الإيميل وكلمة سرك هتفضل زي ما هي.<br/>
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="background:#fafaf7;padding:20px 32px;text-align:center;border-top:1px solid #ece8dc">
          <p style="margin:0;color:#9aa9a4;font-size:11px">© Solarix · Minia University Graduation Project</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const cleanEmail = email.trim().toLowerCase();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);
    await ensureOtpTable();

    // Check that the user exists; respond OK regardless to avoid email enumeration
    const { data: profile } = await admin.from("profiles").select("id").eq("email", cleanEmail).maybeSingle();

    if (profile?.id) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256(`${cleanEmail}:${code}`);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertErr } = await admin.from("password_reset_otps").insert({ email: cleanEmail, code_hash: codeHash, expires_at: expiresAt });
      if (insertErr) {
        console.error("OTP insert failed", insertErr);
        return new Response(JSON.stringify({ error: "Failed to prepare reset code" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const GMAIL_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
      if (!LOVABLE_API_KEY || !GMAIL_KEY) throw new Error("Gmail not configured");

      const raw = buildRawEmail(cleanEmail, "Solarix · Password reset code", emailHtml(code));
      const r = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GMAIL_KEY,
        },
        body: JSON.stringify({ raw }),
      });
      if (!r.ok) {
        const txt = await r.text();
        console.error("Gmail send failed", r.status, txt);
        return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      console.log("No profile for", cleanEmail, "— silently OK");
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-reset-otp", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});