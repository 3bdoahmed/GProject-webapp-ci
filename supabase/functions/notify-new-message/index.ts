const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const SENDER_NAME = "Smart Solar Power Management";
const SENDER_EMAIL = "eslamshaban060@gmail.com";

function b64url(str: string): string {
  // UTF-8 safe base64url
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRawEmail(to: string, subject: string, html: string): string {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const lines = [
    `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
  ];
  return b64url(lines.join("\r\n"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) throw new Error("Gmail connector not configured");

    const { name, email, message, kind } = await req.json();

    // Fetch all approved dashboard members' emails
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email&status=eq.approved`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const profiles: { email: string | null }[] = pr.ok ? await pr.json() : [];
    const recipients = Array.from(
      new Set(profiles.map((p) => p.email?.trim()).filter((e): e is string => !!e && /\S+@\S+\.\S+/.test(e)))
    );
    if (!recipients.includes(SENDER_EMAIL)) recipients.push(SENDER_EMAIL);

    const safe = (s: string) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
    const kindMeta: Record<string, { emoji: string; label: string; color: string }> = {
      signup:       { emoji: "👤", label: "New Signup",       color: "#0d9488" },
      message:      { emoji: "📩", label: "New Message",      color: "#0ea5e9" },
      note:         { emoji: "📝", label: "New Note",         color: "#8b5cf6" },
      battery:      { emoji: "🔋", label: "Battery Update",   color: "#22c55e" },
      inverter:     { emoji: "⚡", label: "Inverter Update",  color: "#f59e0b" },
      system:       { emoji: "🖥️", label: "System Update",    color: "#0d9488" },
      weather:      { emoji: "☀️", label: "Weather Update",   color: "#06b6d4" },
      realtime:     { emoji: "📡", label: "Realtime Alert",   color: "#ef4444" },
      report:       { emoji: "📊", label: "New Report",       color: "#6366f1" },
      notification: { emoji: "🔔", label: "Notification",     color: "#0d9488" },
    };
    const meta = kindMeta[kind as string] || kindMeta.notification;
    const subject = `${meta.emoji} ${meta.label} — ${name}`;

    const html = `
<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px -15px rgba(13,148,136,0.25);border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg, ${meta.color} 0%, #0f766e 100%);padding:28px 32px;color:#fff;">
        <div style="font-size:32px;line-height:1;margin-bottom:8px;">${meta.emoji}</div>
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;font-weight:600;">${meta.label}</div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;">Smart Solar Power Management</h1>
      </div>
      <div style="padding:32px;">
        <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:20px;border-left:4px solid ${meta.color};">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:4px;">From</div>
          <div style="font-size:15px;font-weight:700;color:#0f172a;">${safe(name)}</div>
          <div style="font-size:13px;color:#475569;margin-top:2px;">${safe(email)}</div>
        </div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Message</div>
        <div style="font-size:15px;line-height:1.7;color:#1e293b;white-space:pre-wrap;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">${safe(message)}</div>
      </div>
      <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
        Sent automatically by <strong style="color:${meta.color};">Smart Solar</strong> Dashboard · Minia University
      </div>
    </div>
  </div>
</body></html>`;

    const results = await Promise.all(
      recipients.map(async (to) => {
        const raw = buildRawEmail(to, subject, html);
        const r = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
          },
          body: JSON.stringify({ raw }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) console.error(`Gmail failed for ${to}: ${r.status}`, data);
        return { to, ok: r.ok, id: data?.id, error: r.ok ? undefined : data };
      })
    );

    return new Response(JSON.stringify({ ok: true, sent: results.filter((x) => x.ok).length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-new-message error", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});