import { useEffect, useMemo, useRef, useState } from "react";
import { emailNotifyAll } from "@/lib/emailNotifyAll";
import { motion } from "framer-motion";
import {
  Battery as BatteryIcon, BatteryCharging, BatteryFull, BatteryLow, BatteryWarning,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, Heart, Zap, Activity,
  Thermometer, Gauge, CircuitBoard, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis, Cell, LineChart, Line, Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const API_URL = "https://izn19wv78k.execute-api.eu-west-3.amazonaws.com/data";

type Battery = {
  battery_id: string;
  inverter_id: string;
  IsFullCharge: string;
  AverageCharge: number;
  TimeRemaining: number;
  BatteryHealth: number;       // raw 0-10 score
  HealthPct: number;           // BatteryHealth * 10
  Capacity_Ah: number;
  current: number;
  voltage: number;
  temperature: number;
  status: string;
};

const normalize = (raw: any[]): Battery[] =>
  raw.map((b: any) => {
    const health = Number(b.BatteryHealth ?? b[" BatteryHealth"]) || 0;
    return {
      battery_id: b.battery_id ?? b.id ?? "—",
      inverter_id: b.inverter_id ?? "—",
      IsFullCharge: (b.IsFullCharge ?? b[" IsFullCharge"] ?? "no").toString().trim().toLowerCase(),
      AverageCharge: Number(b.AverageCharge ?? b[" AverageCharge"] ?? b["ِِAverageCharge"]) || 0,
      TimeRemaining: Number(b.TimeRemaining) || 0,
      BatteryHealth: health,
      HealthPct: Math.round(health * 10),
      Capacity_Ah: Number(b.Capacity_Ah) || 0,
      current: Number(b.current) || 0,
      voltage: Number(b.voltage) || 0,
      temperature: Number(b.temperature) || 0,
      status: (b.status ?? "unknown").toString().toLowerCase(),
    };
  });

const chargeTier = (c: number) =>
  c >= 80 ? "full" : c >= 50 ? "good" : c >= 30 ? "low" : "critical";

const tierColor = (tier: string) => ({
  full: "hsl(var(--primary))",
  good: "hsl(142 70% 45%)",
  low: "hsl(38 92% 50%)",
  critical: "hsl(var(--destructive))",
} as Record<string, string>)[tier];

export default function Batteries() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { user } = useAuth();
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const notifiedRef = useRef<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setLoading(true);
      const r = await fetch(API_URL);
      if (!r.ok) throw new Error("Failed to fetch battery data");
      const data = await r.json();
      setBatteries(normalize(Array.isArray(data) ? data : []));
      setLastUpdate(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, []);

  // Push notifications for failing/critical batteries (throttled per day per battery+condition)
  useEffect(() => {
    if (!batteries.length || !user) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    type Cond = { key: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };
    const conditions: Cond[] = [];
    for (const b of batteries) {
      if (b.status !== "ok") conditions.push({
        key: `fault_${b.battery_id}`,
        titleAr: `عطل في البطارية ${b.battery_id}`, titleEn: `Battery ${b.battery_id} fault`,
        bodyAr: `حالة البطارية: ${b.status} — يلزم فحص فوري للمحول ${b.inverter_id}.`,
        bodyEn: `Status reported: ${b.status} — immediate inspection of inverter ${b.inverter_id} required.`,
      });
      if (b.AverageCharge < 10) conditions.push({
        key: `crit_${b.battery_id}`,
        titleAr: `شحن حرج للبطارية ${b.battery_id}`, titleEn: `Critical charge on Battery ${b.battery_id}`,
        bodyAr: `الشحن ${b.AverageCharge}% فقط — توقف وشيك. الجهد ${b.voltage}V.`,
        bodyEn: `Charge is only ${b.AverageCharge}% — imminent shutdown. Voltage ${b.voltage}V.`,
      });
      else if (b.AverageCharge < 30) conditions.push({
        key: `low_${b.battery_id}`,
        titleAr: `شحن منخفض للبطارية ${b.battery_id}`, titleEn: `Low charge on Battery ${b.battery_id}`,
        bodyAr: `الشحن ${b.AverageCharge}% — يرجى المتابعة.`,
        bodyEn: `Charge at ${b.AverageCharge}% — monitor.`,
      });
      if (b.HealthPct < 60) conditions.push({
        key: `health_${b.battery_id}`,
        titleAr: `صحة متدهورة للبطارية ${b.battery_id}`, titleEn: `Degraded health on Battery ${b.battery_id}`,
        bodyAr: `الصحة ${b.HealthPct}% — يُنصح بالاستبدال.`,
        bodyEn: `Health ${b.HealthPct}% — replacement recommended.`,
      });
      if (b.temperature > 45) conditions.push({
        key: `temp_${b.battery_id}`,
        titleAr: `حرارة عالية للبطارية ${b.battery_id}`, titleEn: `Battery ${b.battery_id} overheating`,
        bodyAr: `الحرارة ${b.temperature}°م — خطر تلف.`,
        bodyEn: `Temperature ${b.temperature}°C — damage risk.`,
      });
    }
    (async () => {
      for (const c of conditions) {
        const lsKey = `bat_notif:${user.id}:${c.key}:${dayKey}`;
        if (localStorage.getItem(lsKey) || notifiedRef.current.has(lsKey)) continue;
        notifiedRef.current.add(lsKey);
        const { error } = await (supabase as any).from("notifications").insert({
          user_id: user.id, kind: "battery",
          title: ar ? c.titleAr : c.titleEn,
          body: ar ? c.bodyAr : c.bodyEn,
          link: "/dashboard/batteries",
        });
        if (!error) {
          localStorage.setItem(lsKey, "1");
          emailNotifyAll({ title: ar ? c.titleAr : c.titleEn, body: ar ? c.bodyAr : c.bodyEn, kind: "battery" });
        }
      }
    })();
  }, [batteries, user, ar]);

  const stats = useMemo(() => {
    const full = batteries.filter(b => b.IsFullCharge === "yes").length;
    const low = batteries.filter(b => b.AverageCharge < 30).length;
    const fault = batteries.filter(b => b.status !== "ok").length;
    const avgCharge = batteries.length ? Math.round(batteries.reduce((s, b) => s + b.AverageCharge, 0) / batteries.length) : 0;
    const avgHealth = batteries.length ? Math.round(batteries.reduce((s, b) => s + b.HealthPct, 0) / batteries.length) : 0;
    return { full, low, fault, avgCharge, avgHealth };
  }, [batteries]);

  if (loading && !batteries.length) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-14 h-14 border-4 border-border border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">{ar ? "جاري تحميل بيانات البطاريات..." : "Loading battery data..."}</p>
      </Card>
    );
  }

  if (error && !batteries.length) {
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

  const sorted = [...batteries].sort((a, b) => a.battery_id.localeCompare(b.battery_id));
  const chartData = sorted.map(b => ({
    id: b.battery_id, charge: b.AverageCharge, health: b.HealthPct,
    voltage: b.voltage, temp: b.temperature, color: tierColor(chargeTier(b.AverageCharge)),
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <BatteryCharging className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {ar ? "إدارة البطاريات" : "Battery Management"}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {batteries.length} {ar ? "بطارية • آخر تحديث " : "batteries • Updated "}{lastUpdate.toLocaleTimeString()}
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

      {/* Critical alerts bar */}
      {(stats.fault > 0 || stats.low > 0) && (
        <Alert className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-100 font-medium">
            {stats.fault > 0 && (ar ? `🚨 ${stats.fault} بطارية في حالة عطل. ` : `🚨 ${stats.fault} batteries reporting fault. `)}
            {stats.low > 0 && (ar ? `🔋 ${stats.low} بطارية منخفضة الشحن (<30%).` : `🔋 ${stats.low} batteries low (<30%).`)}
          </AlertDescription>
        </Alert>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: ar ? "إجمالي" : "Total", value: batteries.length, icon: CircuitBoard, color: "hsl(var(--primary))" },
          { label: ar ? "ممتلئة" : "Full", value: stats.full, icon: BatteryFull, color: "hsl(142 70% 45%)" },
          { label: ar ? "منخفضة" : "Low", value: stats.low, icon: BatteryLow, color: "hsl(38 92% 50%)" },
          { label: ar ? "أعطال" : "Faults", value: stats.fault, icon: BatteryWarning, color: "hsl(var(--destructive))" },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-5 hover:shadow-xl transition-smooth hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${k.color}20` }}>
                  <k.icon className="w-5 h-5" style={{ color: k.color }} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{k.label}</span>
              </div>
              <div className="text-3xl font-black" style={{ color: k.color }}>{k.value}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Fleet averages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{ar ? "متوسط الشحن" : "Fleet Avg Charge"}</h3>
            </div>
            <span className="text-2xl font-black text-primary">{stats.avgCharge}%</span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-700 rounded-full"
              style={{ width: `${stats.avgCharge}%` }} />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-accent" />
              <h3 className="font-bold">{ar ? "متوسط الصحة" : "Fleet Avg Health"}</h3>
            </div>
            <span className="text-2xl font-black text-accent">{stats.avgHealth}%</span>
          </div>
          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-700 rounded-full"
              style={{ width: `${stats.avgHealth}%` }} />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" />{ar ? "مستوى الشحن لكل بطارية" : "Charge level per battery"}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="id" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="charge" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-accent" />{ar ? "الجهد والحرارة" : "Voltage & Temperature"}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="id" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="voltage" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} name={ar ? "الجهد (V)" : "Voltage (V)"} />
              <Line type="monotone" dataKey="temp" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 4 }} name={ar ? "الحرارة (°م)" : "Temp (°C)"} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Battery cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((b, idx) => {
          const tier = chargeTier(b.AverageCharge);
          const color = tierColor(tier);
          const isFull = b.IsFullCharge === "yes";
          const fault = b.status !== "ok";
          const radial = [{ name: "charge", value: b.AverageCharge, fill: color }];
          return (
            <motion.div key={b.battery_id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <Card className={`p-5 hover:shadow-xl transition-smooth hover:-translate-y-1 border-2 ${
                fault ? "border-destructive/60" : tier === "critical" ? "border-destructive/40" : tier === "low" ? "border-amber-400/50" : "border-border"
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}25` }}>
                      <BatteryIcon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-black text-base">{b.battery_id}</h3>
                      <span className="text-[11px] text-muted-foreground">{ar ? "محول" : "Inverter"} {b.inverter_id}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isFull && (
                      <span className="px-2 py-0.5 bg-primary/15 text-primary rounded-full text-[10px] font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />{ar ? "ممتلئة" : "FULL"}
                      </span>
                    )}
                    {fault && (
                      <span className="px-2 py-0.5 bg-destructive/15 text-destructive rounded-full text-[10px] font-black flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{b.status.toUpperCase()}
                      </span>
                    )}
                    {!isFull && !fault && tier === "critical" && (
                      <span className="px-2 py-0.5 bg-destructive/15 text-destructive rounded-full text-[10px] font-black">{ar ? "حرج" : "CRITICAL"}</span>
                    )}
                    {!isFull && !fault && tier === "low" && (
                      <span className="px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-black">{ar ? "منخفض" : "LOW"}</span>
                    )}
                  </div>
                </div>

                {/* Radial charge gauge */}
                <div className="relative h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="70%" outerRadius="100%" data={radial} startAngle={220} endAngle={-40}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black" style={{ color }}>{b.AverageCharge}%</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ar ? "الشحن" : "Charge"}</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Stat icon={Heart} label={ar ? "الصحة" : "Health"} value={`${b.HealthPct}%`} color={b.HealthPct >= 70 ? "hsl(var(--primary))" : b.HealthPct >= 50 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))"} />
                  <Stat icon={Clock} label={ar ? "الوقت المتبقي" : "Time left"} value={`${b.TimeRemaining}h`} />
                  <Stat icon={Zap} label={ar ? "الجهد" : "Voltage"} value={`${b.voltage}V`} />
                  <Stat icon={Activity} label={ar ? "التيار" : "Current"} value={`${b.current}A`} />
                  <Stat icon={Thermometer} label={ar ? "الحرارة" : "Temp"} value={`${b.temperature}°C`} color={b.temperature > 40 ? "hsl(var(--destructive))" : undefined} />
                  <Stat icon={Gauge} label={ar ? "السعة" : "Capacity"} value={`${b.Capacity_Ah}Ah`} />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-bold" style={{ color: color || undefined }}>{value}</div>
    </div>
  );
}
