import { useEffect, useMemo, useRef, useState } from "react";
import { emailNotifyAll } from "@/lib/emailNotifyAll";
import { motion } from "framer-motion";
import {
  Activity, Zap, Power, Gauge, Battery, BatteryWarning, BatteryFull,
  RefreshCw, AlertTriangle, TrendingUp, Wifi, WifiOff, Clock, HeartPulse,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, BarChart, Bar, Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const API_URL = "https://lkxns0ebgc.execute-api.eu-west-3.amazonaws.com/data";
const REFRESH_MS = 30_000;

type Snap = {
  ts: string;
  acV: number; acA: number; acP: number;
  dcV: number; dcA: number; dcP: number;
  charge: number; lowN: number; fullN: number;
  health: string;
};

const r1 = (n: any) => Math.round((Number(n) || 0) * 10) / 10;
const r0 = (n: any) => Math.round(Number(n) || 0);
const fmtTime = (ts: string) => {
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

const normalize = (raw: any[]): Snap[] => raw
  .filter((r) => r?.Timestamp)
  .sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime())
  .map((r) => ({
    ts: r.Timestamp,
    acV: r1(r.Total_AC_PanelVoltage), acA: r1(r.Total_AC_PanelCurrent), acP: r1(r.Total_AC_PanelPower),
    dcV: r1(r.Total_DC_PanelVoltage), dcA: r1(r.Total_DC_PanelCurrent), dcP: r1(r.Total_DC_PanelPower),
    charge: r1(r.TotalBatteryCharge),
    lowN: r0(r.Low_Battery_Count), fullN: r0(r.Fully_Charged_Count),
    health: (r.BATTERY_Health ?? "UNKNOWN").toString().toUpperCase(),
  }));

const healthColor = (h: string) => h === "CRITICAL" ? "hsl(var(--destructive))"
  : h === "WARNING" || h === "LOW" ? "hsl(38 92% 50%)"
  : h === "GOOD" || h === "OK" || h === "HEALTHY" ? "hsl(142 70% 45%)"
  : "hsl(var(--muted-foreground))";

export default function RealtimeMonitoring() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { user } = useAuth();
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setLoading(true);
      const r = await fetch(API_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const arr = normalize(Array.isArray(j) ? j : [j]);
      if (!arr.length) throw new Error("No data");
      setSnaps(arr.slice(-40));
      setLastSync(new Date());
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const latest = snaps[snaps.length - 1];

  // Notifications
  useEffect(() => {
    if (!latest || !user) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    type Cond = { key: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };
    const conds: Cond[] = [];

    if (latest.health === "CRITICAL") conds.push({
      key: "rt_health_critical",
      titleAr: "حالة البطاريات: حرجة",
      titleEn: "Battery fleet: CRITICAL",
      bodyAr: `إجمالي شحن البطاريات ${latest.charge}% — ${latest.lowN} بطاريات منخفضة. يلزم تدخل فوري.`,
      bodyEn: `Total battery charge ${latest.charge}% — ${latest.lowN} low batteries. Immediate action required.`,
    });
    if (latest.acP === 0 && latest.dcP === 0) conds.push({
      key: "rt_no_power",
      titleAr: "النظام لا ينتج أي طاقة",
      titleEn: "System producing no power",
      bodyAr: "AC و DC = 0W — تحقق من الألواح والمحولات.",
      bodyEn: "Both AC and DC = 0W — check panels and inverters.",
    });
    if (latest.lowN >= 5) conds.push({
      key: "rt_many_low",
      titleAr: `${latest.lowN} بطاريات بشحن منخفض`,
      titleEn: `${latest.lowN} batteries running low`,
      bodyAr: "عدد كبير من البطاريات أقل من الحد الآمن — راجع صفحة البطاريات.",
      bodyEn: "Multiple batteries below safe threshold — see Batteries page.",
    });
    if (latest.dcP > 0 && latest.acP / latest.dcP < 0.5 && latest.acP > 0) conds.push({
      key: "rt_low_conv",
      titleAr: "كفاءة تحويل منخفضة",
      titleEn: "Low conversion efficiency",
      bodyAr: `AC/DC أقل من 50% — راجع صفحة المحولات.`,
      bodyEn: `AC/DC below 50% — check Inverters page.`,
    });

    (async () => {
      for (const c of conds) {
        const lsKey = `rt_notif:${user.id}:${c.key}:${dayKey}`;
        if (localStorage.getItem(lsKey) || notifiedRef.current.has(lsKey)) continue;
        notifiedRef.current.add(lsKey);
        const { error } = await (supabase as any).from("notifications").insert({
          user_id: user.id, kind: "realtime",
          title: ar ? c.titleAr : c.titleEn,
          body: ar ? c.bodyAr : c.bodyEn,
          link: "/dashboard/realtime",
        });
        if (!error) {
          localStorage.setItem(lsKey, "1");
          emailNotifyAll({ title: ar ? c.titleAr : c.titleEn, body: ar ? c.bodyAr : c.bodyEn, kind: "realtime" });
        }
      }
    })();
  }, [latest, user, ar]);

  const trend = useMemo(() => snaps.map(s => ({
    time: fmtTime(s.ts), AC: s.acP, DC: s.dcP, charge: s.charge,
  })), [snaps]);

  if (loading && !snaps.length) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-14 h-14 border-4 border-border border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">{ar ? "جاري تحميل البيانات اللحظية..." : "Loading real-time data..."}</p>
      </Card>
    );
  }

  if (error && !snaps.length) {
    return (
      <Alert className="border-destructive">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <AlertDescription className="flex items-center justify-between text-destructive">
          {ar ? "خطأ في الاتصال: " : "Connection error: "}{error}
          <button onClick={fetchData} className="ms-4 px-3 py-1 rounded-md bg-destructive text-destructive-foreground text-xs font-bold">
            {ar ? "إعادة المحاولة" : "Retry"}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const hColor = healthColor(latest!.health);
  const conv = latest!.dcP > 0 ? Math.min(100, Math.round((latest!.acP / latest!.dcP) * 100)) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Activity className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {ar ? "المراقبة اللحظية" : "Real-Time Monitoring"}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                {error
                  ? <><WifiOff className="w-3.5 h-3.5 text-destructive" /> <span className="text-destructive">{ar ? "متقطع" : "Disconnected"}</span></>
                  : <><Wifi className="w-3.5 h-3.5 text-green-500" /> <span className="text-green-600">{ar ? "متصل" : "Live"}</span></>
                }
                <span className="mx-1">•</span>
                <Clock className="w-3 h-3" />
                {lastSync ? lastSync.toLocaleTimeString() : "—"}
              </p>
            </div>
          </div>
          <button onClick={fetchData}
            className="px-5 py-2.5 gradient-hero text-primary-foreground rounded-xl hover:shadow-glow transition-smooth font-bold flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {ar ? "تحديث" : "Refresh"}
          </button>
        </div>
      </Card>

      {/* Critical banner */}
      {latest!.health === "CRITICAL" && (
        <Alert className="bg-destructive/10 border-destructive/40">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertDescription className="text-destructive font-medium">
            {ar
              ? `🚨 حالة البطاريات حرجة — ${latest!.lowN} بطارية منخفضة الشحن، الإجمالي ${latest!.charge}%.`
              : `🚨 Battery fleet CRITICAL — ${latest!.lowN} low batteries, total charge ${latest!.charge}%.`}
          </AlertDescription>
        </Alert>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: ar ? "إجمالي AC" : "Total AC Power", value: `${r0(latest!.acP).toLocaleString()} W`, icon: Power, color: "hsl(var(--primary))" },
          { label: ar ? "إجمالي DC" : "Total DC Power", value: `${r0(latest!.dcP).toLocaleString()} W`, icon: Zap, color: "hsl(var(--accent))" },
          { label: ar ? "كفاءة التحويل" : "Conversion Eff.", value: `${conv}%`, icon: Gauge, color: conv >= 90 ? "hsl(142 70% 45%)" : conv >= 70 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))" },
          { label: ar ? "شحن البطاريات" : "Battery Charge", value: `${latest!.charge}%`, icon: Battery, color: latest!.charge >= 50 ? "hsl(142 70% 45%)" : latest!.charge >= 25 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-5 hover:shadow-xl transition-smooth hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${k.color}25` }}>
                  <k.icon className="w-5 h-5" style={{ color: k.color }} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{k.label}</span>
              </div>
              <div className="text-2xl font-black" style={{ color: k.color }}>{k.value}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: ar ? "جهد AC" : "AC Voltage", value: `${latest!.acV} V`, icon: TrendingUp },
          { label: ar ? "تيار AC" : "AC Current", value: `${latest!.acA} A`, icon: TrendingUp },
          { label: ar ? "جهد DC" : "DC Voltage", value: `${latest!.dcV} V`, icon: TrendingUp },
          { label: ar ? "تيار DC" : "DC Current", value: `${latest!.dcA} A`, icon: TrendingUp },
        ].map((k, i) => (
          <Card key={k.label} className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{k.label}</div>
            <div className="text-xl font-black text-foreground">{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Battery counts + health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "hsl(142 70% 45% / 0.15)" }}>
            <BatteryFull className="w-6 h-6" style={{ color: "hsl(142 70% 45%)" }} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">{ar ? "بطاريات مشحونة بالكامل" : "Fully Charged"}</div>
            <div className="text-2xl font-black" style={{ color: "hsl(142 70% 45%)" }}>{latest!.fullN}</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--destructive) / 0.15)" }}>
            <BatteryWarning className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">{ar ? "بطاريات منخفضة" : "Low Batteries"}</div>
            <div className="text-2xl font-black text-destructive">{latest!.lowN}</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${hColor}25` }}>
            <HeartPulse className="w-6 h-6" style={{ color: hColor }} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">{ar ? "حالة الأسطول" : "Fleet Health"}</div>
            <div className="text-2xl font-black" style={{ color: hColor }}>{latest!.health}</div>
          </div>
        </Card>
      </div>

      {/* Power trend */}
      <Card className="p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          {ar ? "اتجاه الطاقة (AC مقابل DC)" : "Power Trend (AC vs DC)"}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="acGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(v: any) => `${r0(v).toLocaleString()} W`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="DC" stroke="hsl(var(--accent))" fill="url(#dcGrad)" strokeWidth={2} name={ar ? "DC" : "DC Power"} />
            <Area type="monotone" dataKey="AC" stroke="hsl(var(--primary))" fill="url(#acGrad)" strokeWidth={2} name={ar ? "AC" : "AC Power"} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Battery charge trend */}
      <Card className="p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Battery className="w-4 h-4 text-accent" />
          {ar ? "اتجاه شحن البطاريات" : "Battery Charge Trend"}
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(v: any) => `${v}%`} />
            <Bar dataKey="charge" radius={[6, 6, 0, 0]} name={ar ? "شحن %" : "Charge %"}>
              {trend.map((d, i) => (
                <Cell key={i} fill={d.charge >= 50 ? "hsl(142 70% 45%)" : d.charge >= 25 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}