import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const FROM_NAME = "Solarix";
const FROM_EMAIL = "eslamshaban060@gmail.com";

const roleLabel = (r: string) => r === "admin" ? { en: "Admin", ar: "مشرف" } : r === "owner" ? { en: "Owner", ar: "مالك" } : { en: "Engineer", ar: "مهندس" };

function buildRawEmail(to: string, subject: string, html: string) {
  const msg = [
    `To: ${to}`,
    `From: ${FROM_NAME} <${FROM_EMAIL}>`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: text/html; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(html))),
  ].join("\r\n");
  return btoa(msg).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function notifyHtml(opts: { adderName: string; newName: string; newEmail: string; roleEn: string; roleAr: string; position?: string; department?: string; country?: string; whenStr: string; }) {
  const detail = (label: string, value?: string) => value ? `
    <tr><td style="padding:6px 0;color:#7a8c87;font-size:12px;font-weight:600;width:38%">${label}</td>
    <td style="padding:6px 0;color:#073426;font-size:13px;font-weight:600">${value}</td></tr>` : "";
  return `
<!doctype html><html dir="ltr" lang="en"><body style="margin:0;padding:0;background:#f5f1e8;font-family:'Space Grotesk','Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px -20px rgba(7,52,38,0.18)">
        <tr><td style="background:linear-gradient(135deg,#076647 0%,#13a073 100%);padding:36px 32px;text-align:center">
          <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:18px;line-height:56px;font-size:28px;color:#f5d27a;font-weight:900">⚡</div>
          <h1 style="margin:18px 0 4px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.02em">Solarix</h1>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:13px;font-weight:500">Smart Solar Power Management</p>
        </td></tr>
        <tr><td style="padding:36px 32px 12px">
          <div style="display:inline-block;background:linear-gradient(135deg,#fdf8ec 0%,#f9f5ea 100%);color:#8b6f1f;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;padding:6px 14px;border-radius:999px;border:1px solid #e6d29a">New team member</div>
          <h2 style="margin:14px 0 8px;color:#073426;font-size:22px;font-weight:800;line-height:1.3">${opts.adderName} added a new ${opts.roleEn.toLowerCase()} to the team</h2>
          <p style="margin:0 0 24px;color:#4a6760;font-size:14px;line-height:1.7">
            ${opts.adderName} أضاف عضو جديد للفريق برتبة <b>${opts.roleAr}</b>.<br/>
            A new member has just joined the Solarix workspace.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7faf8;border:1px solid #e3ece8;border-radius:18px;padding:20px">
            <tr><td>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;width:60px">
                    <div style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#076647,#13a073);color:#fff;font-size:22px;font-weight:900;line-height:52px;text-align:center">${(opts.newName || opts.newEmail || "?")[0].toUpperCase()}</div>
                  </td>
                  <td style="padding-left:14px;vertical-align:top">
                    <div style="color:#073426;font-size:16px;font-weight:800">${opts.newName || "—"}</div>
                    <div style="color:#4a6760;font-size:12px;margin-top:2px">${opts.newEmail}</div>
                    <div style="display:inline-block;margin-top:8px;background:#076647;color:#fff;font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;padding:4px 10px;border-radius:999px">${opts.roleEn}</div>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px dashed #cfdcd6;padding-top:10px">
                ${detail("Position", opts.position)}
                ${detail("Department", opts.department)}
                ${detail("Country", opts.country)}
                ${detail("Added by", opts.adderName)}
                ${detail("Time", opts.whenStr)}
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 36px">
          <p style="margin:0;color:#7a8c87;font-size:12px;line-height:1.6;text-align:center">
            هذا إشعار تلقائي من نظام Solarix · This is an automated notification from the Solarix system.
          </p>
        </td></tr>
        <tr><td style="background:#073426;padding:18px 32px;text-align:center">
          <p style="margin:0;color:rgba(255,255,255,0.7);font-size:11px">© ${new Date().getFullYear()} Solarix · Minia University</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendGmailTo(to: string, subject: string, html: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) return { ok: false, error: "missing_keys" };
  const raw = buildRawEmail(to, subject, html);
  const res = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[notify] gmail send failed", to, res.status, body);
    return { ok: false, error: `${res.status}: ${body}` };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "owner" || r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { email, password, full_name, phone, position, department, country, role } = body || {};
    if (!email || !password || password.length < 6) {
      return new Response(JSON.stringify({ error: "email and password (min 6) required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, phone, position, department, country },
    });
    if (cErr) {
      return new Response(JSON.stringify({ error: cErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newId = created.user!.id;
    // Approve immediately and ensure profile fields are set
    await admin.from("profiles").update({
      status: "approved", full_name, phone, position, department, country, email,
    }).eq("id", newId);

    // Set role if provided (owner role only by owners)
    const desiredRole = role === "admin" ? "admin" : "engineer";
    await admin.from("user_roles").delete().eq("user_id", newId);
    await admin.from("user_roles").insert({ user_id: newId, role: desiredRole });

    // === In-app dashboard notification ===
    try {
      const newName = full_name || email || "عضو جديد";
      const lbl = roleLabel(desiredRole);
      const { data: approvedMembers } = await admin
        .from("profiles")
        .select("id")
        .eq("status", "approved")
        .neq("id", newId);

      await admin.from("notifications").delete().eq("kind", "team").eq("related_id", newId);
      const rows = (approvedMembers || []).map((p: any) => ({
        user_id: p.id,
        kind: "team",
        title: desiredRole === "admin" ? `تم إضافة أدمن جديد: ${newName}` : `تم إضافة عضو جديد: ${newName}`,
        body: `تم إضافة ${newName} بدور ${lbl.ar} إلى الفريق.`,
        related_id: newId,
        link: "/dashboard/team",
      }));
      if (rows.length) await admin.from("notifications").insert(rows);
    } catch (notifyErr) {
      console.error("[notify] in-app notification failed", notifyErr);
    }

    // === Notify all team members via Gmail ===
    try {
      const { data: adderProfile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      const adderName = adderProfile?.full_name || adderProfile?.email || user.email || "A team admin";
      const { data: recipients } = await admin
        .from("profiles")
        .select("email")
        .neq("id", newId)
        .not("email", "is", null);
      const lbl = roleLabel(desiredRole);
      const whenStr = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }) + " (Cairo)";
      const html = notifyHtml({
        adderName, newName: full_name || "", newEmail: email,
        roleEn: lbl.en, roleAr: lbl.ar,
        position, department, country, whenStr,
      });
      const subject = `Solarix · ${adderName} added ${full_name || email} as ${lbl.en}`;
      const unique = Array.from(new Set((recipients || []).map((r: any) => r.email).filter(Boolean)));
      console.log("[notify] sending to", unique.length, "members");
      await Promise.all(unique.map((to) => sendGmailTo(to, subject, html)));
    } catch (notifyErr) {
      console.error("[notify] failed", notifyErr);
    }

    return new Response(JSON.stringify({ ok: true, id: newId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});