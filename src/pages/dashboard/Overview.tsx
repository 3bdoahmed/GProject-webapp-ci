import { useEffect, useMemo, useRef, useState } from "react";
import { emailNotifyAll } from "@/lib/emailNotifyAll";
import { motion } from "framer-motion";
import {
  MapPin, Battery, Zap, Activity, Wifi, WifiOff, CheckCircle2, AlertCircle,
  Clock, Wind, Droplets, ExternalLink, Coins, Sun, BatteryFull, BatteryWarning,
  TrendingUp, ArrowRightLeft, RefreshCw, Cloud,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const PRICE_PER_KWH = 2.25;
const STATION = { name: "Minya Solar Station", location: "Minya, Egypt", lat: 28.0871, lon: 30.7618, capacity: "~50 kWp" };
const API_SYSTEM = "https://lkxns0ebgc.execute-api.eu-west-3.amazonaws.com/data";
const API_BATTERY = "https://izn19wv78k.execute-api.eu-west-3.amazonaws.com/data";
const WEATHER_URL = `https://api.openweathermap.org/data/2.5/weather?lat=${STATION.lat}&lon=${STATION.lon}&appid=bdeb06fa12b44fa44b843321dc99e5b2&units=metric`;
const REFRESH_MS = 30_000;

const cleanBat = (rec: any, field: string) => {
  const norm = (s: string) => s.replace(/[^\x00-\x7F]/g, "").trim().toLowerCase();
  const target = norm(field);
  for (const k of Object.keys(rec)) if (norm(k) === target) return rec[k];
  return null;
};
const r0 = (n: any) => Math.round(Number(n) || 0);
const r1 = (n: any) => Math.round((Number(n) || 0) * 10) / 10;
const f0 = (n: any) => r0(n).toLocaleString();
const egp = (n: number) => `EGP ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safeFetch = async (u: string) => { try { const r = await fetch(u); return r.ok ? { ok: true, data: await r.json() } : { ok: false, data: null }; } catch { return { ok: false, data: null }; } };
const toArr = (d: any) => Array.isArray(d) ? d : d ? [d] : [];

type Pt = { wh: number; ts: number };
const calcKWh = (pts: Pt[]) => {
  if (pts.length < 2) return 0;
  let kwh = 0;
  for (let i = 1; i < pts.length; i++) {
    const dtH = (pts[i].ts - pts[i - 1].ts) / 3_600_000;
    kwh += ((pts[i].wh + pts[i - 1].wh) / 2 * dtH) / 1000;
  }
  return kwh;
};
const cutoff = (range: string) => Date.now() - (
  range === "day" ? 86_400_000 :
  range === "week" ? 604_800_000 :
  range === "month" ? 2_592_000_000 :
  31_536_000_000 // year
);
const labelFor = (ts: number, range: string) => {
  const d = new Date(ts);
  if (range === "day") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "week") return d.toLocaleDateString([], { weekday: "short" });
  if (range === "month") return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
};
const buildChart = (pts: Pt[], range: string) => {
  const filt = pts.filter(p => p.ts >= cutoff(range));
  if (!filt.length) return [];
  const slots = new Map<string, Pt[]>();
  filt.forEach(p => {
    const lbl = labelFor(p.ts, range);
    if (!slots.has(lbl)) slots.set(lbl, []);
    slots.get(lbl)!.push(p);
  });
  return Array.from(slots.entries()).map(([label, ps]) => ({
    label,
    kWh: +(ps.length > 1 ? calcKWh(ps) : (ps[0].wh / 1000) * (range === "day" ? 0.5 : 1)).toFixed(2),
  }));
};

export default function Overview() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { user } = useAuth();
  const [sysLatest, setSysLatest] = useState<any>(null);
  const [energyPts, setEnergyPts] = useState<Pt[]>([]);
  const [batteries, setBatteries] = useState<any[]>([]);
  const [wx, setWx] = useState<any>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [range, setRange] = useState<"day" | "week" | "month" | "year">("day");
  const notifiedRef = useRef<Set<string>>(new Set());

  const loadAll = async () => {
    const [s, b, w] = await Promise.all([safeFetch(API_SYSTEM), safeFetch(API_BATTERY), safeFetch(WEATHER_URL)]);
    if (s.ok) {
      const all = toArr(s.data);
      if (all.length) {
        const latest = all.reduce((a: any, b: any) => new Date(b.Timestamp) > new Date(a.Timestamp) ? b : a);
        setSysLatest(latest);
        setOnline(true);
        setLastSync(new Date());
        setEnergyPts(prev => {
          const seen = new Set(prev.map(p => p.ts));
          const nw = all.map((r: any) => ({ wh: Number(r.Total_AC_PanelPower) || 0, ts: new Date(r.Timestamp).getTime() }))
            .filter(p => p.ts && !seen.has(p.ts));
          return [...prev, ...nw].sort((a, b) => a.ts - b.ts).slice(-5000);
        });
      }
    } else setOnline(false);
    if (b.ok) {
      const all = toArr(b.data);
      const map = new Map<string, any>();
      all.forEach((r: any) => {
        const id = String(r.battery_id ?? "?");
        const ts = new Date(String(r.timestamp ?? "").trim()).getTime();
        const ex = map.get(id);
        if (!ex || ts > ex._ts) map.set(id, { ...r, _ts: ts });
      });
      setBatteries([...map.values()]);
    }
    if (w.ok) setWx(Array.isArray(w.data) ? w.data[0] : w.data);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const acP = sysLatest ? Number(sysLatest.Total_AC_PanelPower) || 0 : 0;
  const dcP = sysLatest ? Number(sysLatest.Total_DC_PanelPower) || 0 : 0;
  const acV = sysLatest ? Number(sysLatest.Total_AC_PanelVoltage) || 0 : 0;
  const sysCharge = sysLatest ? Number(sysLatest.TotalBatteryCharge) || 0 : 0;
  const fleetHealth = (sysLatest?.BATTERY_Health ?? "").toString().toUpperCase();

  const avgCharge = batteries.length ? Math.round(batteries.reduce((s, b) => s + (Number(cleanBat(b, "AverageCharge")) || 0), 0) / batteries.length) : 0;
  const lowN = batteries.filter(b => (Number(cleanBat(b, "AverageCharge")) || 0) < 20).length;
  const fullN = batteries.filter(b => String(cleanBat(b, "IsFullCharge")).trim().toLowerCase() === "yes").length;

  const chartData = useMemo(() => buildChart(energyPts, range), [energyPts, range]);
  const rangedPts = useMemo(() => energyPts.filter(p => p.ts >= cutoff(range)), [energyPts, range]);
  const totalKWh = calcKWh(rangedPts);
  const totalRev = totalKWh * PRICE_PER_KWH;

  const status: "ok" | "warn" | "error" | "idle" = !online ? "error" : fleetHealth === "CRITICAL" || lowN > 0 ? "warn" : online ? "ok" : "idle";
  const statusColor = { ok: "hsl(142 70% 45%)", warn: "hsl(38 92% 50%)", error: "hsl(var(--destructive))", idle: "hsl(var(--muted-foreground))" }[status];
  const statusLabel = ar
    ? { ok: "كل الأنظمة تعمل", warn: "يحتاج انتباه", error: "خطأ في الاتصال", idle: "جاري الاتصال..." }[status]
    : { ok: "All Systems Operational", warn: "Attention Required", error: "Connection Error", idle: "Connecting…" }[status];

  // Notifications: connection lost / fleet critical
  useEffect(() => {
    if (!user || online === null) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    const conds: { key: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }[] = [];
    if (online === false) conds.push({
      key: "ov_offline", titleAr: "النظام غير متصل", titleEn: "System offline",
      bodyAr: "تعذر الوصول إلى واجهة بيانات المحطة. تحقق من الاتصال.",
      bodyEn: "Cannot reach the station data API. Check connectivity.",
    });
    if (fleetHealth === "CRITICAL") conds.push({
      key: "ov_fleet_critical", titleAr: "حالة الأسطول حرجة", titleEn: "Fleet health CRITICAL",
      bodyAr: `إجمالي شحن البطاريات ${r1(sysCharge)}% — تدخل فوري.`,
      bodyEn: `Total battery charge ${r1(sysCharge)}% — immediate action required.`,
    });
    (async () => {
      for (const c of conds) {
        const lsKey = `ov_notif:${user.id}:${c.key}:${dayKey}`;
        if (localStorage.getItem(lsKey) || notifiedRef.current.has(lsKey)) continue;
        notifiedRef.current.add(lsKey);
        const { error } = await (supabase as any).from("notifications").insert({
          user_id: user.id, kind: "system",
          title: ar ? c.titleAr : c.titleEn, body: ar ? c.bodyAr : c.bodyEn,
          link: "/dashboard",
        });
        if (!error) {
          localStorage.setItem(lsKey, "1");
          emailNotifyAll({ title: ar ? c.titleAr : c.titleEn, body: ar ? c.bodyAr : c.bodyEn, kind: "system" });
        }
      }
    })();
  }, [online, fleetHealth, sysCharge, user, ar]);

  const wxTemp = wx?.main?.temp != null ? Math.round(Number(wx.main.temp)) : null;
  const wxHum = wx?.main?.humidity != null ? Math.round(Number(wx.main.humidity)) : null;
  const wxWind = wx?.wind?.speed != null ? r1(wx.wind.speed) : null;
  const wxClouds = wx?.clouds?.all != null ? Math.round(Number(wx.clouds.all)) : null;
  const wxDesc = wx?.weather?.[0]?.description ?? "";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-primary/10 via-card to-accent/5 border-primary/20">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10 blur-3xl" style={{ background: "hsl(var(--primary))" }} />
          <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="relative flex w-2.5 h-2.5">
                  {status !== "idle" && <span className="absolute inset-0 rounded-full opacity-60 animate-ping" style={{ background: statusColor }} />}
                  <span className="relative w-2.5 h-2.5 rounded-full" style={{ background: statusColor }} />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: statusColor }}>{statusLabel}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {ar ? "محطة المنيا للطاقة الشمسية" : STATION.name}
              </h1>
              <a href={`https://maps.google.com/?q=${STATION.lat},${STATION.lon}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group w-fit">
                <MapPin className="w-4 h-4 text-primary" />{ar ? "المنيا، مصر" : STATION.location}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>
              {lastSync && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />{ar ? "آخر مزامنة " : "Last synced "}{lastSync.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex sm:flex-col gap-3 flex-wrap shrink-0">
              <Card className="px-5 py-3 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-foreground">{STATION.capacity}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{ar ? "السعة التصميمية" : "Design Capacity"}</span>
              </Card>
              <Card className="px-4 py-2.5 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-foreground">{loading ? "—" : batteries.length}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{ar ? "بطاريات" : "Batteries"}</span>
              </Card>
              <button onClick={loadAll} className="px-4 py-2.5 rounded-2xl gradient-hero text-primary-foreground font-bold flex items-center gap-2 hover:shadow-glow transition-smooth">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                {ar ? "تحديث" : "Sync"}
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: ar ? "طاقة AC" : "AC Power", value: `${f0(acP)} W`, icon: Zap, color: "hsl(var(--primary))", to: "/dashboard/realtime" },
          { label: ar ? "طاقة DC" : "DC Power", value: `${f0(dcP)} W`, icon: Activity, color: "hsl(var(--accent))", to: "/dashboard/realtime" },
          { label: ar ? "جهد AC" : "AC Voltage", value: `${r1(acV)} V`, icon: ArrowRightLeft, color: "hsl(var(--primary))", to: "/dashboard/inverters" },
          { label: ar ? "شحن البطاريات" : "Battery Charge", value: `${r1(sysCharge)}%`, icon: Battery, color: sysCharge >= 50 ? "hsl(142 70% 45%)" : sysCharge >= 25 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))", to: "/dashboard/batteries" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={k.to}>
              <Card className="p-5 hover:shadow-xl transition-smooth hover:-translate-y-0.5 cursor-pointer h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${k.color}25` }}>
                    <k.icon className="w-5 h-5" style={{ color: k.color }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{k.label}</span>
                </div>
                <div className="text-2xl font-black" style={{ color: k.color }}>{k.value}</div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Energy chart + Weather sidebar */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />{ar ? "إنتاج الطاقة" : "Energy Production"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ar ? "المبلغ التقديري بسعر " : "Estimated revenue @ "}{egp(PRICE_PER_KWH)}/kWh
              </p>
            </div>
            <div className="flex gap-1 p-1 rounded-lg bg-secondary">
              {(["day", "week", "month", "year"] as const).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-smooth ${range === r ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                  {ar ? { day: "اليوم", week: "أسبوع", month: "شهر", year: "سنة" }[r] : { day: "Day", week: "Week", month: "Month", year: "Year" }[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="text-[10px] uppercase tracking-wider font-bold text-primary mb-1">{ar ? "إجمالي الطاقة" : "Total Energy"}</div>
              <div className="text-2xl font-black text-primary flex items-center gap-2"><Sun className="w-5 h-5" />{r1(totalKWh)} kWh</div>
            </div>
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
              <div className="text-[10px] uppercase tracking-wider font-bold text-accent mb-1">{ar ? "الإيرادات التقديرية" : "Est. Revenue"}</div>
              <div className="text-2xl font-black text-accent flex items-center gap-2"><Coins className="w-5 h-5" />{egp(totalRev)}</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="ovEnergy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: any) => [`${r1(v)} kWh — ${egp(Number(v) * PRICE_PER_KWH)}`, ar ? "الإنتاج" : "Output"]} />
              <Area type="monotone" dataKey="kWh" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ovEnergy)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <div className="space-y-4">
          {/* Weather */}
          <Card className="p-5">
            <h3 className="font-bold flex items-center gap-2 mb-3"><Cloud /> {ar ? "الطقس الحالي" : "Current Weather"}</h3>
            {wx ? (
              <>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-4xl font-black text-primary">{wxTemp ?? "—"}°</span>
                  <span className="text-xs text-muted-foreground capitalize mb-1">{wxDesc}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini icon={<Wind className="w-3.5 h-3.5" />} label={ar ? "رياح" : "Wind"} value={wxWind != null ? `${wxWind} m/s` : "—"} />
                  <Mini icon={<Droplets className="w-3.5 h-3.5" />} label={ar ? "رطوبة" : "Hum"} value={wxHum != null ? `${wxHum}%` : "—"} />
                  <Mini icon={<Cloud className="w-3.5 h-3.5" />} label={ar ? "غيوم" : "Clouds"} value={wxClouds != null ? `${wxClouds}%` : "—"} />
                </div>
              </>
            ) : <p className="text-xs text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</p>}
          </Card>

          {/* Battery summary */}
          <Card className="p-5">
            <h3 className="font-bold flex items-center gap-2 mb-3"><Battery className="w-4 h-4 text-primary" />{ar ? "ملخص البطاريات" : "Battery Summary"}</h3>
            <div className="space-y-3">
              <Row icon={<BatteryFull className="w-4 h-4" style={{ color: "hsl(142 70% 45%)" }} />} label={ar ? "مشحونة بالكامل" : "Fully Charged"} value={`${fullN}/${batteries.length || "—"}`} />
              <Row icon={<BatteryWarning className="w-4 h-4 text-destructive" />} label={ar ? "منخفضة" : "Low"} value={`${lowN}`} valueColor={lowN > 0 ? "text-destructive" : undefined} />
              <Row icon={<Activity className="w-4 h-4 text-primary" />} label={ar ? "متوسط الشحن" : "Avg Charge"} value={`${avgCharge}%`} />
              <Row icon={<CheckCircle2 className="w-4 h-4" style={{ color: statusColor }} />} label={ar ? "حالة الأسطول" : "Fleet Health"} value={fleetHealth || "—"} valueColor="text-foreground" />
            </div>
            <Link to="/dashboard/batteries" className="mt-4 block text-center text-xs font-bold text-primary hover:underline">
              {ar ? "عرض كل البطاريات →" : "View all batteries →"}
            </Link>
          </Card>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: "/dashboard/realtime", icon: Activity, label: ar ? "المراقبة اللحظية" : "Real-Time" },
          { to: "/dashboard/inverters", icon: ArrowRightLeft, label: ar ? "المحولات" : "Inverters" },
          { to: "/dashboard/batteries", icon: Battery, label: ar ? "البطاريات" : "Batteries" },
          { to: "/dashboard/weather", icon: Cloud, label: ar ? "الطقس" : "Weather" },
        ].map(q => (
          <Link key={q.to} to={q.to}>
            <Card className="p-4 flex items-center gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-smooth cursor-pointer">
              <div className="w-10 h-10 rounded-lg gradient-hero flex items-center justify-center">
                <q.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm">{q.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-secondary/50">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}
function Row({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <span className={`text-sm font-black ${valueColor ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

