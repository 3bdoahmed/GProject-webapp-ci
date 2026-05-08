import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);

    const { target_id } = await req.json();
    if (!target_id) return json({ error: "target_id required" }, 400);
    if (target_id === user.id) return json({ error: "You can't delete yourself" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: myRoles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const myRoleSet = new Set((myRoles || []).map((r: any) => r.role));
    const isOwner = myRoleSet.has("owner");
    const isAdmin = myRoleSet.has("admin");
    if (!isOwner && !isAdmin) return json({ error: "Forbidden" }, 403);

    const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", target_id);
    const tSet = new Set((targetRoles || []).map((r: any) => r.role));
    if (tSet.has("owner")) return json({ error: "Owner cannot be deleted" }, 403);
    if (!isOwner && tSet.has("admin")) return json({ error: "Only owner can delete admins" }, 403);

    // Cleanup in public schema first
    await admin.from("user_roles").delete().eq("user_id", target_id);
    await admin.from("profiles").delete().eq("id", target_id);

    const { error: dErr } = await admin.auth.admin.deleteUser(target_id);
    if (dErr) return json({ error: dErr.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});