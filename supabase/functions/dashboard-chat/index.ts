import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages } = await req.json();
    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY missing");

    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }
    const token = auth.slice(7);
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Try to identify the caller (optional). If token is the anon publishable key, this returns no user — that's OK.
    let userId: string | null = null;
    let userEmail: string | undefined;
    try {
      const { data: userData } = await supa.auth.getUser(token);
      if (userData?.user) {
        userId = userData.user.id;
        userEmail = userData.user.email;
      }
    } catch (e) {
      console.log("getUser threw, continuing as anonymous:", (e as Error).message);
    }

    // Fetch dashboard context using service role (bypasses RLS for read-only context)
    const [msgsRes, profilesRes, rolesRes, meRes, notesRes] = await Promise.all([
      supa.from("contact_messages").select("name,email,message,is_read,created_at").order("created_at", { ascending: false }).limit(20),
      supa.from("profiles").select("id,full_name,email,position,department,country,status,created_at"),
      supa.from("user_roles").select("user_id,role"),
      userId ? supa.from("profiles").select("full_name,email,position,department,status").eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
      supa.from("notes").select("title,content,category,author_name,created_at").order("created_at", { ascending: false }).limit(40),
    ]);

    // Live weather snapshot for Minya (used by the assistant to discuss the Weather page)
    const OWM_KEY = "bdeb06fa12b44fa44b843321dc99e5b2";
    const MINYA_LAT = 28.0871, MINYA_LON = 30.7618;
    let weatherLine = "(weather unavailable)";
    let weatherAlerts: string[] = [];
    try {
      const wRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${MINYA_LAT}&lon=${MINYA_LON}&appid=${OWM_KEY}&units=metric`);
      if (wRes.ok) {
        const w: any = await wRes.json();
        const temp = w.main.temp, feels = w.main.feels_like, hum = w.main.humidity;
        const wind = w.wind.speed, windDeg = w.wind.deg, clouds = w.clouds.all;
        const cloudFactor = (100 - clouds) / 100;
        const hour = new Date().getUTCHours() + 2; // Cairo ~UTC+2
        const sunAngle = (hour >= 6 && hour <= 18) ? Math.sin(((hour - 6) / 12) * Math.PI) : 0;
        const irradiance = Math.round(1000 * cloudFactor * sunAngle);
        const efficiency = temp >= 10 && temp <= 25 ? 100 : temp > 25 ? Math.max(50, 100 - (temp - 25) * 0.5) : Math.max(50, 100 - (25 - temp) * 2);
        weatherLine = `Minya now: ${temp.toFixed(1)}°C (feels ${feels.toFixed(1)}°C), humidity ${hum}%, wind ${wind.toFixed(1)} m/s @ ${windDeg}°, clouds ${clouds}%, est. irradiance ${irradiance} W/m², est. panel efficiency ${efficiency.toFixed(0)}%.`;
        if (temp > 35) weatherAlerts.push(`HIGH TEMP ${temp.toFixed(1)}°C → panel efficiency drops`);
        if (wind > 15) weatherAlerts.push(`STRONG WIND ${wind.toFixed(1)} m/s → equipment risk`);
        if (clouds > 70) weatherAlerts.push(`HEAVY CLOUDS ${clouds}% → reduced solar output`);
        if (hum > 80) weatherAlerts.push(`HIGH HUMIDITY ${hum}% → schedule panel cleaning within 48h`);
      }
    } catch (e) { console.log("weather fetch failed", (e as Error).message); }

    // Live battery fleet snapshot
    let batteryLine = "(battery API unavailable)";
    let batteryAlerts: string[] = [];
    try {
      const bRes = await fetch("https://izn19wv78k.execute-api.eu-west-3.amazonaws.com/data");
      if (bRes.ok) {
        const arr: any[] = await bRes.json();
        const norm = arr.map(b => ({
          id: b.battery_id, inv: b.inverter_id,
          full: (b.IsFullCharge ?? b[" IsFullCharge"] ?? "no").toString().trim().toLowerCase() === "yes",
          charge: Number(b.AverageCharge ?? b[" AverageCharge"] ?? b["ِِAverageCharge"]) || 0,
          time: Number(b.TimeRemaining) || 0,
          health: Math.round((Number(b.BatteryHealth) || 0) * 10),
          cap: Number(b.Capacity_Ah) || 0,
          v: Number(b.voltage) || 0, a: Number(b.current) || 0,
          temp: Number(b.temperature) || 0,
          status: (b.status ?? "unknown").toString(),
        }));
        const fullN = norm.filter(b => b.full).length;
        const lowN = norm.filter(b => b.charge < 30).length;
        const faultN = norm.filter(b => b.status !== "ok").length;
        const avgC = norm.length ? Math.round(norm.reduce((s,b)=>s+b.charge,0)/norm.length) : 0;
        const avgH = norm.length ? Math.round(norm.reduce((s,b)=>s+b.health,0)/norm.length) : 0;
        batteryLine = `Fleet: ${norm.length} batteries — ${fullN} full, ${lowN} low (<30%), ${faultN} faults. Avg charge ${avgC}%, avg health ${avgH}%.\nPer battery: ` +
          norm.map(b => `${b.id}@${b.inv}: ${b.charge}% charge, health ${b.health}%, ${b.v}V/${b.a}A, ${b.temp}°C, ${b.time}h left, status=${b.status}${b.full ? ", FULL" : ""}`).join(" | ");
        for (const b of norm) {
          if (b.status !== "ok") batteryAlerts.push(`${b.id} FAULT (${b.status})`);
          if (b.charge < 10) batteryAlerts.push(`${b.id} CRITICAL charge ${b.charge}%`);
          else if (b.charge < 30) batteryAlerts.push(`${b.id} low ${b.charge}%`);
          if (b.health < 60) batteryAlerts.push(`${b.id} degraded health ${b.health}%`);
          if (b.temp > 45) batteryAlerts.push(`${b.id} overheating ${b.temp}°C`);
        }
      }
    } catch (e) { console.log("battery fetch failed", (e as Error).message); }

    // Live inverter fleet snapshot
    let inverterLine = "(inverter API unavailable)";
    let inverterAlerts: string[] = [];
    try {
      const iRes = await fetch("https://l43h5rftk2.execute-api.eu-west-3.amazonaws.com/data");
      if (iRes.ok) {
        const arr: any[] = await iRes.json();
        const norm = arr.map(i => {
          const ac = Number(i.AC_Power) || 0, dc = Number(i.DC_Power) || 0;
          const status = (i.status ?? "unknown").toString();
          return {
            id: i.inverter_id, panel: i.panel_id,
            acV: Number(i.AC_Voltage) || 0, acA: Number(i.AC_Current) || 0, acP: ac,
            dcV: Number(i.DC_Voltage) || 0, dcA: Number(i.DC_Current) || 0, dcP: dc,
            status, fault: !status.toLowerCase().startsWith("ok"),
            eff: dc > 0 ? Math.min(100, Number(((ac / dc) * 100).toFixed(1))) : 0,
          };
        });
        const totAC = norm.reduce((s,i)=>s+i.acP,0);
        const totDC = norm.reduce((s,i)=>s+i.dcP,0);
        const faultN = norm.filter(i => i.fault).length;
        const onlineN = norm.filter(i => !i.fault && i.acP > 0).length;
        const valid = norm.filter(i => !i.fault && i.dcP > 0);
        const avgE = valid.length ? Math.round(valid.reduce((s,i)=>s+i.eff,0)/valid.length) : 0;
        inverterLine = `Fleet: ${norm.length} inverters — ${onlineN} online, ${faultN} faults. Total AC ${totAC}W, Total DC ${totDC}W, avg eff ${avgE}%.\nPer inverter: ` +
          norm.map(i => `${i.id}/${i.panel}: DC ${i.dcV}V·${i.dcA}A·${i.dcP}W → AC ${i.acV}V·${i.acA}A·${i.acP}W, eff=${i.eff}%, status="${i.status}"`).join(" | ");
        for (const i of norm) {
          if (i.fault) inverterAlerts.push(`${i.id} FAULT (${i.status})`);
          else if (i.acP === 0) inverterAlerts.push(`${i.id} no AC output`);
          else if (i.dcP > 0 && i.eff < 80) inverterAlerts.push(`${i.id} low eff ${i.eff}%`);
        }
      }
    } catch (e) { console.log("inverter fetch failed", (e as Error).message); }

    // Live system snapshot (Real-Time Monitoring page)
    let realtimeLine = "(realtime API unavailable)";
    let realtimeAlerts: string[] = [];
    try {
      const sRes = await fetch("https://lkxns0ebgc.execute-api.eu-west-3.amazonaws.com/data");
      if (sRes.ok) {
        const arr: any[] = await sRes.json();
        const list = (Array.isArray(arr) ? arr : [arr])
          .filter((r: any) => r?.Timestamp)
          .sort((a: any, b: any) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
        if (list.length) {
          const s = list[list.length - 1];
          const acP = Number(s.Total_AC_PanelPower) || 0;
          const dcP = Number(s.Total_DC_PanelPower) || 0;
          const acV = Number(s.Total_AC_PanelVoltage) || 0;
          const dcV = Number(s.Total_DC_PanelVoltage) || 0;
          const acA = Number(s.Total_AC_PanelCurrent) || 0;
          const dcA = Number(s.Total_DC_PanelCurrent) || 0;
          const charge = Number(s.TotalBatteryCharge) || 0;
          const lowN = Number(s.Low_Battery_Count) || 0;
          const fullN = Number(s.Fully_Charged_Count) || 0;
          const health = (s.BATTERY_Health ?? "UNKNOWN").toString();
          const conv = dcP > 0 ? Math.min(100, Math.round((acP / dcP) * 100)) : 0;
          realtimeLine = `Latest snapshot @ ${s.Timestamp}: AC ${Math.round(acP)}W (${acV.toFixed(1)}V·${acA.toFixed(1)}A), DC ${Math.round(dcP)}W (${dcV.toFixed(1)}V·${dcA.toFixed(1)}A), conversion ${conv}%, battery charge ${charge.toFixed(1)}%, ${fullN} full, ${lowN} low, fleet health=${health}. (${list.length} historical points available)`;
          if (health.toUpperCase() === "CRITICAL") realtimeAlerts.push(`Battery fleet CRITICAL (charge ${charge}%)`);
          if (acP === 0 && dcP === 0) realtimeAlerts.push("No power output (AC=DC=0W)");
          if (lowN >= 5) realtimeAlerts.push(`${lowN} batteries low`);
          if (dcP > 0 && acP > 0 && (acP / dcP) < 0.5) realtimeAlerts.push(`Low conversion ${conv}%`);
        }
      }
    } catch (e) { console.log("realtime fetch failed", (e as Error).message); }

    const msgs = msgsRes.data || [];
    const unread = msgs.filter((m: any) => !m.is_read).length;
    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const roleMap: Record<string, string> = {};
    for (const r of roles) roleMap[r.user_id] = r.role;

    const teamLines = profiles.map((p: any) =>
      `- ${p.full_name || p.email} (${roleMap[p.id] || "engineer"}) — ${p.position || "—"} / ${p.department || "—"} — status: ${p.status}`
    ).join("\n");

    const msgLines = msgs.slice(0, 10).map((m: any) =>
      `- [${m.is_read ? "read" : "UNREAD"}] ${new Date(m.created_at).toISOString().slice(0,16)} from ${m.name} <${m.email}>: ${m.message.slice(0, 200)}`
    ).join("\n");

    const notes = (notesRes as any).data || [];
    const notesLines = notes.map((n: any) =>
      `- [${n.category}] ${new Date(n.created_at).toISOString().slice(0,16)} by ${n.author_name || "—"}: ${n.title} — ${String(n.content).slice(0, 240)}`
    ).join("\n");

    const me = meRes.data;
    const meLine = me ? `${me.full_name || me.email} — ${me.position || "—"} (${me.status})` : userEmail;

    const SYSTEM_PROMPT = `You are SolarBot Dashboard Assistant for the "Smart Solar Power Management System" (graduation project, Minia University).

You ONLY help the currently logged-in dashboard user with things INSIDE the dashboard:
- Messages page (/dashboard/messages): contact form submissions from visitors
- Notifications page (/dashboard/notifications): same data shown as notifications, with filters and mark-as-read
- Team page (/dashboard/team): registered team members and their roles/status (pending/approved)
- Settings page (/dashboard/settings): profile (name, phone, position, department, country), avatar, password change, language & theme
- Overview page (/dashboard): summary stats
- Weather page (/dashboard/weather): live weather for Minya (OpenWeather) with charts and solar-impact analysis
- Notes page (/dashboard/notes): team notes, maintenance logs and ideas. Anyone can post and a notification fans out to all approved members. Categories: general, maintenance, incident, task, idea.

You CAN answer questions about: counts of messages/unread, who sent what, team members and their roles/status, what each settings page does, how to mark messages read, etc.

LANGUAGE: Default English; if the user writes Arabic, reply in Arabic. Be concise (1-3 short paragraphs). Never invent data — only use the LIVE CONTEXT below.

=== LIVE CONTEXT (real-time snapshot) ===
CURRENT USER: ${meLine}

UNREAD MESSAGES: ${unread} of ${msgs.length} total

RECENT MESSAGES (latest 10):
${msgLines || "(none)"}

TEAM NOTES (${notes.length}, latest first — full content):
${notesLines || "(none)"}

TEAM MEMBERS (${profiles.length}):
${teamLines || "(none)"}

WEATHER (live, Minya):
${weatherLine}
ACTIVE WEATHER ALERTS: ${weatherAlerts.length ? weatherAlerts.join(" | ") : "(none)"}

BATTERIES (live, AWS API):
${batteryLine}
ACTIVE BATTERY ALERTS: ${batteryAlerts.length ? batteryAlerts.join(" | ") : "(none)"}

INVERTERS (live, AWS API):
${inverterLine}
ACTIVE INVERTER ALERTS: ${inverterAlerts.length ? inverterAlerts.join(" | ") : "(none)"}

REAL-TIME MONITORING (live system snapshot, AWS API):
${realtimeLine}
ACTIVE REAL-TIME ALERTS: ${realtimeAlerts.length ? realtimeAlerts.join(" | ") : "(none)"}

REAL-TIME PAGE — explain on demand:
- Source: AWS API streaming aggregated system snapshots (summaryID="Main_SYSTEM") with Timestamp, Total_AC/DC_Panel Voltage·Current·Power, TotalBatteryCharge, Low_Battery_Count, Fully_Charged_Count, BATTERY_Health.
- KPI cards: Total AC Power, Total DC Power, Conversion Efficiency (=AC/DC×100, capped 100%), Battery Charge %.
- Secondary cards: AC/DC voltage and current.
- Battery counters: Fully Charged count, Low count, Fleet Health status (CRITICAL=red, WARNING/LOW=amber, GOOD/HEALTHY=green).
- Charts: AreaChart for AC vs DC power trend over the latest ~40 snapshots; BarChart for battery charge % per snapshot, color-coded green ≥50%, amber 25-49%, red <25%.
- Auto-pushes notifications (kind=realtime, once/day/user) when: BATTERY_Health=CRITICAL, AC=DC=0W, Low_Battery_Count≥5, or AC/DC<50% with positive output.
- Refreshes every 30 seconds.

INVERTER PAGE — explain on demand:
- Source: AWS API streaming live telemetry from each inverter (INV01..INVxx) and its solar panel (P01..Pxx).
- Each inverter converts DC from the panel to AC for the grid. We track DC voltage/current/power input and AC voltage/current/power output.
- Conversion efficiency = AC_Power / DC_Power × 100 (capped at 100% for display).
- Tier colors: ≥95% excellent, 90-94% good, 80-89% fair, <80% low (orange), status≠"ok" or starts with "error" → fault (red border).
- Charts: KPI cards for Total AC, Total DC, Online count, Fault count + grouped bar chart comparing AC vs DC per inverter.
- Per-inverter card: radial gauge (efficiency %) + DC In panel (V/A/W) + AC Out panel (V/A/W) + status badge.
- Auto-pushes notifications (kind=inverter, once/day/user/condition) when: status reports "error in INVxx", AC_Power=0 while OK, or efficiency<80% with valid DC input.

BATTERY PAGE — explain on demand:
- Source: AWS API endpoint streaming live telemetry from each battery + inverter pair (BAT01..BATxx).
- Each card shows a radial gauge (AverageCharge %), plus 6 stats: Health (BatteryHealth raw 0-10 score × 10 = %), Time Left (hours), Voltage (V), Current (A), Temperature (°C), Capacity (Ah).
- Tier colors: ≥80% green (full), 50-79% green-mid, 30-49% amber (low), <30% red (critical).
- Charts: bar = charge per battery; line = voltage and temperature per battery.
- IsFullCharge "yes" → FULL badge; status != "ok" → FAULT badge (destructive border).
- The page automatically pushes notifications (kind=battery, once/day/user/condition) when: status≠ok, charge<10 (critical) or <30 (low), health<60%, or temp>45°C.
- Inverter IDs (INV01..INVxx) map 1:1 with battery IDs and indicate which DC-AC converter the cell feeds.

WEATHER PAGE CHARTS — explain on demand:
- Metric cards (Temperature/Irradiance/Wind/Humidity): green = optimal, yellow = warning, red = critical. "Panel Efficiency" derives from temperature (peaks 10-25°C, drops 0.5%/°C above 25°C, drops 2%/°C below 10°C).
- Solar Irradiance (W/m²): estimated from cloud cover × sun-angle factor (sin curve 6am-6pm); 0 at night, ~1000 at solar noon clear sky.
- Temperature Forecast (area chart): next ~24h in 3-hour steps from OpenWeather forecast.
- System Performance (radar): 5 axes (Temp, Irradiance, Wind, Humidity, Efficiency) normalized 0-100 vs an Optimal reference polygon. Bigger overlap with Optimal = healthier conditions.
- Wind & Humidity Trends (line): cyan = wind m/s, blue = humidity %.
- Cloud Coverage Impact (bar): per-3h cloud %, green <40%, yellow 40-70%, red >70% (= solar production hit).

SOLAR IMPACT RULES (use these when interpreting values):
- Temp >35°C → efficiency loss; Wind >15 m/s → mechanical risk; Clouds >70% → output drop; Humidity >80% → dust+moisture, clean panels within 48h.
- The Weather page automatically pushes a notification per condition (once/day/user) when these thresholds are exceeded.

DASHBOARD PAGES:
- Overview: welcome + quick stats
- Team: list of registered users with role badges; owners/admins can approve pending accounts and change roles
- Messages: full inbox of contact form submissions, mark as read / delete, realtime new-message toast + sound
- Notifications: bell icon shows unread count; All / Unread filters; mark-all-read; clicking opens the message
- Weather: live Minya weather (OpenWeather), 4 metric cards + 4 charts, auto-alerts on adverse conditions
- Batteries (/dashboard/batteries): live fleet from AWS API — KPI cards (total/full/low/fault), fleet avg charge & health, charge bar chart, voltage/temp line chart, per-battery cards with radial gauges and full telemetry, auto-alerts for faults/low charge/degraded health/overheating
- Inverters (/dashboard/inverters): live AWS telemetry — KPI cards (Total AC/DC, online, faults), fleet avg conversion efficiency, AC vs DC compare bar chart, per-inverter cards with radial efficiency gauge and DC/AC voltage·current·power, auto-alerts for fault/no-output/low-efficiency
- Real-Time (/dashboard/realtime): aggregated system snapshot from AWS — power KPIs (AC/DC/conversion/charge), AC/DC voltage·current cards, battery counters & fleet health, AC vs DC trend area chart, battery charge bar chart, auto-alerts for critical health/no-power/many-low/low-conversion
- Reports (/dashboard/reports): on-demand PDF report generator. Four report types built from live AWS data — (1) System Summary: KPIs (AC/DC/efficiency/charge), voltage·current snapshot, fleet health; (2) Batteries: per-unit charge/health/voltage/current/temperature/capacity/status table; (3) Inverters: per-unit DC↔AC voltage·current·power + efficiency + status; (4) Energy & Revenue: kWh totals (Day/Week/Month/Year) via trapezoidal integration of Total_AC_PanelPower with EGP 2.25/kWh revenue. PDFs use jsPDF + autoTable with branded teal/gold header, page numbers, station metadata. Pushes a kind=report notification on each generation.

OVERVIEW PAGE — explain on demand (/dashboard):
- Hero: station name "Minya Solar Station" (lat 28.0871, lon 30.7618, ~50 kWp design capacity), live status badge (All Systems Operational / Attention Required / Connection Error), last sync time, batteries count, refresh button.
- KPI cards (clickable to deeper pages): AC Power (W), DC Power (W), AC Voltage (V), Battery Charge (%) — each card color-coded by health.
- Energy Production chart: AreaChart of kWh per time bucket with selectable range (Day/Week/Month). Trapezoidal integration of Total_AC_PanelPower over Timestamp converts watt readings to kWh. Estimated revenue uses fixed price ${"EGP 2.25/kWh"}.
- Weather card: live OpenWeather (Minya) — temp, description, wind m/s, humidity %, cloud %.
- Battery summary: fully charged count, low (<20%) count, average charge, fleet health badge — links to /dashboard/batteries.
- Quick links: Real-Time, Inverters, Batteries, Weather pages.
- Auto-pushes notifications (kind=system, once/day/user) when: system API offline, or BATTERY_Health=CRITICAL.
- Assistant: this chat (you)
- Settings: profile fields, avatar upload, password update, language toggle (EN/AR), theme toggle (light/dark)
=== END CONTEXT ===

ABOUT ESLAM SHABAN — Full-Stack Web & Cloud Developer (keep answers SHORT, 2-4 sentences max):
- Title: Full-Stack Web & Cloud Developer (Front-End + Back-End + Cloud Integration).
- Role: built the entire web platform end-to-end — landing site and dashboard UI/UX (pages, charts, screens), back-end logic and APIs, plus the cloud integration that connects the dashboard to project data in real time.
- Stack: React.js, Next.js, TypeScript, Tailwind CSS, Styled Components, Responsive/UI/UX, Dashboard Design, State Management. Back-end & cloud: Supabase (Auth/DB/Realtime/Edge Functions), REST API integration, Cloud/AI APIs, Git/GitHub, Vercel, SEO.
- Contact (only share if asked): eslamshaban060@gmail.com · 01006407387 · LinkedIn https://www.linkedin.com/in/eslamshaban060/ · GitHub https://github.com/eslamshaban060 · Portfolio https://my-portfolio-one-gilt-24.vercel.app/.
When asked about Eslam / Islam, answer briefly (2-4 sentences).

ABOUT ABDELRAHMAN AHMED — DevOps & Cloud Engineer (keep answers SHORT, 2-4 sentences max):
- Role: Cloud & IaC. Built the project's AWS infrastructure with Terraform (Infrastructure as Code) — repeatable, scalable cloud setup.
- Designed the cloud architecture that receives IoT data from panels and batteries and pipes it to the monitoring center.
- AWS stack: DynamoDB (real-time storage), Lambda (processing & analysis), S3 (files/backups), API Gateway (REST APIs feeding the dashboard JSON).
- Also built backend logic for power calculations, battery-state tracking, and fault detection that powers this dashboard.
When asked about Abdelrahman: reply briefly (2-4 sentences).

ABOUT MUHAMMAD ABOZIED — Network & Cybersecurity Engineer (keep answers SHORT, 2-4 sentences max):
- Role: Designer & implementer of the project's secured network — built the full network infrastructure from scratch with redundancy and high availability.
- Hardening: configured firewalls and Active Directory with strict identity & access management (IAM) policies; security baked into the network architecture.
- Background: practicing SOC Analyst (traffic analysis, threat detection) and Incident Responder, so the design is proactive and resilient against breaches.
When asked about Muhammad / Mohamed Mostafa / Abozied: reply briefly (2-4 sentences).

ABOUT ISMAIL MOHAMED — Solar Hardware & Cloud Integration (keep answers SHORT, 2-4 sentences max):
- Role: implemented the solar power hardware and linked it to the project's tech stack — installs/operates the panels and physical components.
- Cloud link: programmed the modules that push energy data to the cloud so the dashboard can monitor performance remotely.
- Monitoring: ensures readings flow continuously and reliably into this dashboard.
- Skills: solar power system components, hardware-to-cloud integration.
When asked about Ismail / Ismail Mohamed: reply briefly (2-4 sentences).

ABOUT MOHAMED EL-GIOUSHY — Network & Cybersecurity Engineer (keep answers SHORT, 2-4 sentences max):
- Role: designed and implemented the network and cybersecurity layer — built secure network infrastructure with hardening, redundancy, and high availability.
- Hardening: configured firewalls, Active Directory, and identity & access management (IAM) policies; security baked into the network architecture.
- Background: hands-on SOC monitoring, traffic analysis, and incident response — proactive defensive design.
When asked about El-Gioushy / Mohamed El-Gioushy: reply briefly (2-4 sentences).

ABOUT DR. MONA SAID — Project Supervisor (keep answers SHORT, 2-4 sentences max):
- Role: Project Supervisor and academic mentor for the Smart Solar Power Management System graduation project at Minia University.
- Oversees the entire project lifecycle, providing academic guidance, technical direction, and quality assurance to ensure engineering excellence.
- Specializes in guiding students through complex IoT, cloud, and cybersecurity integrated systems, fostering both technical depth and professional research standards.
When asked about Dr. Mona / Mona Sayed / the supervisor: reply briefly (2-4 sentences) with respect and appreciation.

Answer based strictly on the context above. If asked about something outside the dashboard (landing page, hardware, marketing), politely say you only handle dashboard topics here.

IMPORTANT NAMING RULE: ALWAYS prefix any team member's name with "بشمهندس" in Arabic (e.g., "بشمهندس إسلام", "بشمهندس الجيوشي", "بشمهندس أبوزيد", "بشمهندس عبدالرحمن", "بشمهندس إسماعيل", "بشمهندس عمر") and "Eng." in English (e.g., "Eng. Eslam", "Eng. El-Gioushy"). Exception: the supervisor is "د. منى سيد" / "Dr. Mona Sayed".`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }
    return new Response(resp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" }});
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "err" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});
