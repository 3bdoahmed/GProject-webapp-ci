import { useEffect, useMemo, useRef, useState } from "react";
import { emailNotifyAll } from "@/lib/emailNotifyAll";
import { motion } from "framer-motion";
import {
  Zap, Activity, ArrowRightLeft, RefreshCw, AlertTriangle, Power,
  TrendingUp, CheckCircle2, AlertCircle, CircuitBoard, Gauge, Plug,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, RadialBarChart, RadialBar, PolarAngleAxis, Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const API_URL = "https://l43h5rftk2.execute-api.eu-west-3.amazonaws.com/data";

type Inv = {
  inverter_id: string; panel_id: string;
  AC_Voltage: number; AC_Current: number; AC_Power: number;
  DC_Voltage: number; DC_Current: number; DC_Power: number;
  status: string; isFault: boolean; eff: number;
};

const normalize = (raw: any[]): Inv[] => raw.map((i: any) => {
  const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
  const ac = r2(i.AC_Power), dc = r2(i.DC_Power);
  const status = (i.status ?? "unknown").toString();
  return {
    inverter_id: i.inverter_id ?? "—", panel_id: i.panel_id ?? "—",
    AC_Voltage: r2(i.AC_Voltage), AC_Current: r2(i.AC_Current), AC_Power: ac,
    DC_Voltage: r2(i.DC_Voltage), DC_Current: r2(i.DC_Current), DC_Power: dc,
    status, isFault: !status.toLowerCase().startsWith("ok"),
    eff: dc > 0 ? Math.min(100, Math.round((ac / dc) * 1000) / 10) : 0,
  };
});

const effTier = (e: number, isFault: boolean, ac: number) => {
  if (isFault || ac === 0) return "fault";
  if (e >= 95) return "excellent";
  if (e >= 90) return "good";
  if (e >= 80) return "fair";
  return "low";
};

const tierColor = (t: string) => ({
  excellent: "hsl(142 70% 45%)",
  good: "hsl(var(--primary))",
  fair: "hsl(38 92% 50%)",
  low: "hsl(25 95% 53%)",
  fault: "hsl(var(--destructive))",
} as Record<string, string>)[t];

const tierLabel = (t: string, ar: boolean) => ({
  excellent: ar ? "ممتاز" : "Excellent",
  good: ar ? "جيد" : "Good",
  fair: ar ? "متوسط" : "Fair",
  low: ar ? "منخفض" : "Low",
  fault: ar ? "عطل" : "Fault",
} as Record<string, string>)[t];

export default function Inverters() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { user } = useAuth();
  const [inverters, setInverters] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const notifiedRef = useRef<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setLoading(true);
      const r = await fetch(API_URL);
      if (!r.ok) throw new Error("Failed to fetch inverters data");
      const data = await r.json();
      setInverters(normalize(Array.isArray(data) ? data : []));
      setLastUpdate(new Date());
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, []);

  // Notifications for faults / no output / degraded efficiency
  useEffect(() => {
    if (!inverters.length || !user) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    type Cond = { key: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };
    const conds: Cond[] = [];
    for (const i of inverters) {
      if (i.isFault) conds.push({
        key: `fault_${i.inverter_id}`,
        titleAr: `عطل في المحول ${i.inverter_id}`, titleEn: `Inverter ${i.inverter_id} fault`,
        bodyAr: `الحالة: ${i.status} — اللوح ${i.panel_id} متأثر. يلزم فحص فوري.`,
        bodyEn: `Status: ${i.status} — panel ${i.panel_id} affected. Immediate inspection required.`,
      });
      if (!i.isFault && i.AC_Power === 0) conds.push({
        key: `noac_${i.inverter_id}`,
        titleAr: `لا يوجد إنتاج من ${i.inverter_id}`, titleEn: `No output from ${i.inverter_id}`,
        bodyAr: `طاقة AC = 0W رغم أن الحالة OK — راجع توصيلات الشبكة.`,
        bodyEn: `AC power is 0W despite OK status — check grid connections.`,
      });
      if (!i.isFault && i.AC_Power > 0 && i.eff < 80 && i.DC_Power > 0) conds.push({
        key: `loweff_${i.inverter_id}`,
        titleAr: `كفاءة منخفضة للمحول ${i.inverter_id}`, titleEn: `Low efficiency on ${i.inverter_id}`,
        bodyAr: `كفاءة التحويل ${i.eff}% فقط — يُنصح بالفحص.`,
        bodyEn: `Conversion efficiency only ${i.eff}% — inspection recommended.`,
      });
    }
    (async () => {
      for (const c of conds) {
        const lsKey = `inv_notif:${user.id}:${c.key}:${dayKey}`;
        if (localStorage.getItem(lsKey) || notifiedRef.current.has(lsKey)) continue;
        notifiedRef.current.add(lsKey);
        const { error } = await (supabase as any).from("notifications").insert({
          user_id: user.id, kind: "inverter",
          title: ar ? c.titleAr : c.titleEn,
          body: ar ? c.bodyAr : c.bodyEn,
          link: "/dashboard/inverters",
        });
        if (!error) {
          localStorage.setItem(lsKey, "1");
          emailNotifyAll({ title: ar ? c.titleAr : c.titleEn, body: ar ? c.bodyAr : c.bodyEn, kind: "inverter" });
        }
      }
    })();
  }, [inverters, user, ar]);

  const stats = useMemo(() => {
    const totalAC = Math.round(inverters.reduce((s, i) => s + i.AC_Power, 0));
    const totalDC = Math.round(inverters.reduce((s, i) => s + i.DC_Power, 0));
    const fault = inverters.filter(i => i.isFault).length;
    const online = inverters.filter(i => !i.isFault && i.AC_Power > 0).length;
    const valid = inverters.filter(i => !i.isFault && i.DC_Power > 0);
    const avgEff = valid.length ? Math.round(valid.reduce((s, i) => s + i.eff, 0) / valid.length) : 0;
    return { totalAC, totalDC, fault, online, avgEff };
  }, [inverters]);

  if (loading && !inverters.length) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-14 h-14 border-4 border-border border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">{ar ? "جاري تحميل بيانات المحولات..." : "Loading inverter data..."}</p>
      </Card>
    );
  }

  if (error && !inverters.length) {
    return (
      <Alert className="border-destructive">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <AlertDescription className="flex items-center justify-between text-destructive">
          {ar ? "خطأ في الاتصال بالـ API: " : "API error: "}{error}
          <button onClick={fetchData} className="ms-4 px-3 py-1 rounded-md bg-destructive text-destructive-foreground text-xs font-bold">
            {ar ? "إعادة المحاولة" : "Retry"}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const sorted = [...inverters].sort((a, b) => a.inverter_id.localeCompare(b.inverter_id));
  const compareData = sorted.map(i => ({
    id: i.inverter_id, AC: Math.round(i.AC_Power), DC: Math.round(i.DC_Power),
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <ArrowRightLeft className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {ar ? "إدارة المحولات" : "Inverters Management"}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {inverters.length} {ar ? "محول • آخر تحديث " : "inverters • Updated "}{lastUpdate.toLocaleTimeString()}
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

      {/* Alerts */}
      {stats.fault > 0 && (
        <Alert className="bg-destructive/10 border-destructive/40">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertDescription className="text-destructive font-medium">
            {ar
              ? `🚨 ${stats.fault} محول في حالة عطل — راجع الكروت أدناه للتفاصيل.`
              : `🚨 ${stats.fault} inverter${stats.fault > 1 ? "s" : ""} in fault state — see cards below.`}
          </AlertDescription>
        </Alert>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: ar ? "إجمالي AC" : "Total AC", value: `${stats.totalAC.toLocaleString()} W`, icon: Power, color: "hsl(var(--primary))" },
          { label: ar ? "إجمالي DC" : "Total DC", value: `${stats.totalDC.toLocaleString()} W`, icon: Zap, color: "hsl(var(--accent))" },
          { label: ar ? "نشط" : "Online", value: `${stats.online}/${inverters.length}`, icon: CheckCircle2, color: "hsl(142 70% 45%)" },
          { label: ar ? "أعطال" : "Faults", value: stats.fault, icon: AlertCircle, color: "hsl(var(--destructive))" },
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

      {/* Avg efficiency strip */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            <h3 className="font-bold">{ar ? "متوسط كفاءة التحويل" : "Average Conversion Efficiency"}</h3>
          </div>
          <span className="text-2xl font-black text-primary">{stats.avgEff}%</span>
        </div>
        <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary via-accent to-primary transition-all duration-700 rounded-full"
            style={{ width: `${Math.min(100, stats.avgEff)}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {stats.avgEff >= 95 ? (ar ? "✅ أداء ممتاز" : "✅ Excellent performance")
            : stats.avgEff >= 90 ? (ar ? "👍 أداء جيد" : "👍 Good performance")
            : stats.avgEff >= 80 ? (ar ? "⚠️ يحتاج متابعة" : "⚠️ Needs monitoring")
            : (ar ? "🔴 يحتاج صيانة" : "🔴 Needs maintenance")}
        </p>
      </Card>

      {/* AC vs DC compare chart */}
      <Card className="p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />{ar ? "مقارنة AC مقابل DC لكل محول" : "AC vs DC power per inverter"}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={compareData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="id" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="DC" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} name={ar ? "DC (واط)" : "DC (W)"} />
            <Bar dataKey="AC" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={ar ? "AC (واط)" : "AC (W)"} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Per-inverter cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((i, idx) => {
          const tier = effTier(i.eff, i.isFault, i.AC_Power);
          const color = tierColor(tier);
          const radial = [{ name: "eff", value: i.eff, fill: color }];
          return (
            <motion.div key={i.inverter_id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <Card className={`p-5 hover:shadow-xl transition-smooth hover:-translate-y-1 border-2 ${
                i.isFault ? "border-destructive/60" : tier === "low" ? "border-orange-400/40" : "border-border"
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}25` }}>
                      <ArrowRightLeft className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-black text-base">{i.inverter_id}</h3>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <CircuitBoard className="w-3 h-3" />{ar ? "لوح" : "Panel"} {i.panel_id}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1"
                      style={{ background: `${color}25`, color }}>
                      {i.isFault ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {tierLabel(tier, ar).toUpperCase()}
                    </span>
                    {i.isFault && <span className="text-[9px] text-destructive font-mono">{i.status}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Radial efficiency gauge */}
                  <div className="relative h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart innerRadius="68%" outerRadius="100%" data={radial} startAngle={220} endAngle={-40}>
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={10} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black" style={{ color }}>{i.eff}%</span>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{ar ? "كفاءة" : "Eff"}</span>
                    </div>
                  </div>

                  {/* DC + AC side panels */}
                  <div className="col-span-2 space-y-2">
                    <div className="p-2.5 bg-accent/10 rounded-lg border border-accent/20">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Zap className="w-3 h-3 text-accent" />
                        <span className="text-[10px] uppercase tracking-wider font-bold text-accent">{ar ? "دخل DC" : "DC In"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <Mini label="V" value={`${i.DC_Voltage}`} />
                        <Mini label="A" value={`${i.DC_Current}`} />
                        <Mini label="W" value={`${i.DC_Power}`} accent />
                      </div>
                    </div>
                    <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Plug className="w-3 h-3 text-primary" />
                        <span className="text-[10px] uppercase tracking-wider font-bold text-primary">{ar ? "خرج AC" : "AC Out"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <Mini label="V" value={`${i.AC_Voltage}`} />
                        <Mini label="A" value={`${i.AC_Current}`} />
                        <Mini label="W" value={`${i.AC_Power}`} primary />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, primary, accent }: { label: string; value: string; primary?: boolean; accent?: boolean }) {
  return (
    <div>
      <div className={`text-sm font-bold ${primary ? "text-primary" : accent ? "text-accent" : "text-foreground"}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
