import { useState, useEffect, useMemo, useRef } from "react";
import { emailNotifyAll } from "@/lib/emailNotifyAll";
import { motion } from "framer-motion";
import {
  CloudSun, Wind, Droplets, Sun, AlertTriangle, ThermometerSun,
  TrendingUp, Zap, RefreshCw, Eye, Gauge, Sunrise, Sunset, Compass,
  CheckCircle2, CircuitBoard,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, RadialBarChart, RadialBar, Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const API_KEY = "bdeb06fa12b44fa44b843321dc99e5b2";
const MINYA_LAT = 28.0871;
const MINYA_LON = 30.7618;

type WX = any;

const getStatusColor = (value: number, optimal: [number, number], warning: [number, number]) => {
  if (value >= optimal[0] && value <= optimal[1]) return "hsl(142 70% 45%)";
  if (value >= warning[0] && value <= warning[1]) return "hsl(38 92% 50%)";
  return "hsl(var(--destructive))";
};

export default function Weather() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const ar = lang === "ar";
  const [weather, setWeather] = useState<WX>(null);
  const [forecast, setForecast] = useState<WX>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const notifiedRef = useRef<Set<string>>(new Set());

  const fetchWeatherData = async () => {
    try {
      setLoading(true);
      const [c, f] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${MINYA_LAT}&lon=${MINYA_LON}&appid=${API_KEY}&units=metric`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${MINYA_LAT}&lon=${MINYA_LON}&appid=${API_KEY}&units=metric`),
      ]);
      if (!c.ok || !f.ok) throw new Error("Failed to fetch weather data");
      setWeather(await c.json());
      setForecast(await f.json());
      setLastUpdate(new Date());
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchWeatherData();
    const id = setInterval(fetchWeatherData, 600000);
    return () => clearInterval(id);
  }, []);

  // Push notifications for adverse conditions (throttled per day per condition)
  useEffect(() => {
    if (!weather || !user) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    const conditions: { key: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }[] = [];
    if (weather.main.temp > 35) conditions.push({
      key: "high_temp",
      titleAr: "تنبيه: درجة حرارة مرتفعة", titleEn: "Alert: High temperature",
      bodyAr: `درجة الحرارة ${weather.main.temp.toFixed(1)}°م — كفاءة الألواح ستنخفض.`,
      bodyEn: `Temperature ${weather.main.temp.toFixed(1)}°C — panel efficiency will drop.`,
    });
    if (weather.wind.speed > 15) conditions.push({
      key: "high_wind",
      titleAr: "تنبيه: رياح قوية", titleEn: "Alert: Strong winds",
      bodyAr: `سرعة الرياح ${weather.wind.speed.toFixed(1)} م/ث — راقب التثبيتات.`,
      bodyEn: `Wind speed ${weather.wind.speed.toFixed(1)} m/s — inspect mounting.`,
    });
    if (weather.clouds.all > 70) conditions.push({
      key: "heavy_clouds",
      titleAr: "تنبيه: غيوم كثيفة", titleEn: "Alert: Heavy cloud cover",
      bodyAr: `الغيوم ${weather.clouds.all}% — انخفاض ملحوظ في الإنتاج الشمسي.`,
      bodyEn: `Cloud cover ${weather.clouds.all}% — significantly reduced solar output.`,
    });
    if (weather.main.humidity > 80) conditions.push({
      key: "high_humidity",
      titleAr: "تنبيه: رطوبة عالية", titleEn: "Alert: High humidity",
      bodyAr: `الرطوبة ${weather.main.humidity}% — يُنصح بتنظيف الألواح خلال 48 ساعة.`,
      bodyEn: `Humidity ${weather.main.humidity}% — clean panels within 48h.`,
    });

    (async () => {
      for (const c of conditions) {
        const lsKey = `wx_notif:${user.id}:${c.key}:${dayKey}`;
        if (localStorage.getItem(lsKey) || notifiedRef.current.has(lsKey)) continue;
        notifiedRef.current.add(lsKey);
        const { error } = await (supabase as any).from("notifications").insert({
          user_id: user.id, kind: "weather",
          title: ar ? c.titleAr : c.titleEn,
          body: ar ? c.bodyAr : c.bodyEn,
          link: "/dashboard/weather",
        });
        if (!error) {
          localStorage.setItem(lsKey, "1");
          emailNotifyAll({ title: ar ? c.titleAr : c.titleEn, body: ar ? c.bodyAr : c.bodyEn, kind: "weather" });
        }
      }
    })();
  }, [weather, user, ar]);

  const getWindDirection = (deg: number) => ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg/45)%8];

  const irradiance = useMemo(() => {
    if (!weather) return 0;
    const cloudFactor = (100 - weather.clouds.all) / 100;
    const hour = new Date().getHours();
    const sunAngle = (hour >= 6 && hour <= 18) ? Math.sin(((hour - 6) / 12) * Math.PI) : 0;
    return Number((1000 * cloudFactor * sunAngle).toFixed(0));
  }, [weather]);

  const efficiency = useMemo(() => {
    if (!weather) return 0;
    const t = weather.main.temp;
    if (t >= 10 && t <= 25) return 100;
    if (t > 25) return Math.max(50, 100 - (t - 25) * 0.5);
    return Math.max(50, 100 - (25 - t) * 2);
  }, [weather]);

  if (loading && !weather) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-14 h-14 border-4 border-border border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">{ar ? "جاري تحميل بيانات الطقس..." : "Loading weather data..."}</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert className="border-destructive">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <AlertDescription className="flex items-center justify-between text-destructive">
          {ar ? "خطأ في تحميل البيانات: " : "Error loading data: "}{error}
          <button onClick={fetchWeatherData} className="ms-4 px-3 py-1 rounded-md bg-destructive text-destructive-foreground text-xs font-bold">
            {ar ? "إعادة المحاولة" : "Retry"}
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const tempColor = getStatusColor(weather.main.temp, [10, 25], [25, 35]);
  const windColor = getStatusColor(weather.wind.speed, [0, 10], [10, 15]);
  const irradianceColor = irradiance >= 700 ? "hsl(142 70% 45%)" : irradiance >= 400 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))";
  const humColor = weather.main.humidity <= 60 ? "hsl(142 70% 45%)" : weather.main.humidity <= 80 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))";

  const forecastData = forecast ? forecast.list.slice(0, 8).map((item: any) => {
    const date = new Date(item.dt * 1000);
    return {
      time: date.toLocaleTimeString("en-US", { hour: "2-digit" }),
      temp: Number(item.main.temp.toFixed(1)),
      humidity: item.main.humidity,
      wind: Number(item.wind.speed.toFixed(1)),
      clouds: item.clouds.all,
    };
  }) : [];

  const performanceData = [
    { metric: ar ? "حرارة" : "Temp", value: Math.min(100, (weather.main.temp / 45) * 100), optimal: 60 },
    { metric: ar ? "إشعاع" : "Irradiance", value: (irradiance / 1000) * 100, optimal: 80 },
    { metric: ar ? "رياح" : "Wind", value: Math.min(100, (weather.wind.speed / 20) * 100), optimal: 30 },
    { metric: ar ? "رطوبة" : "Humidity", value: weather.main.humidity, optimal: 50 },
    { metric: ar ? "كفاءة" : "Efficiency", value: efficiency, optimal: 90 },
  ];

  const sunrise = new Date(weather.sys.sunrise * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const sunset = new Date(weather.sys.sunset * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const efficiencyRadial = [{ name: "eff", value: efficiency, fill: tempColor }];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <CloudSun className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {ar ? "محطة الطقس - المنيا" : "Weather Station - Minya"}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {ar ? "مباشر • آخر تحديث " : "Live • Updated "}{lastUpdate.toLocaleTimeString()}
                <span className="mx-2">•</span>
                <span className="capitalize">{weather.weather?.[0]?.description}</span>
              </p>
            </div>
          </div>
          <button onClick={fetchWeatherData}
            className="px-5 py-2.5 gradient-hero text-primary-foreground rounded-xl hover:shadow-glow transition-smooth font-bold flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {ar ? "تحديث" : "Refresh"}
          </button>
        </div>
      </Card>

      {/* Critical Alerts */}
      {(weather.main.temp > 35 || weather.wind.speed > 15 || weather.clouds.all > 70 || weather.main.humidity > 80) && (
        <Alert className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription className="text-amber-900 dark:text-amber-100 font-medium">
            {weather.main.temp > 35 && (ar
              ? `🌡️ حرارة مرتفعة: ${weather.main.temp.toFixed(1)}°م. `
              : `🌡️ High Temp: ${weather.main.temp.toFixed(1)}°C. `)}
            {weather.wind.speed > 15 && (ar
              ? `💨 رياح قوية: ${weather.wind.speed.toFixed(1)} م/ث. `
              : `💨 Strong Winds: ${weather.wind.speed.toFixed(1)} m/s. `)}
            {weather.clouds.all > 70 && (ar
              ? `☁️ غيوم كثيفة: ${weather.clouds.all}%. `
              : `☁️ Heavy Clouds: ${weather.clouds.all}%. `)}
            {weather.main.humidity > 80 && (ar
              ? `💧 رطوبة عالية: ${weather.main.humidity}%.`
              : `💧 High Humidity: ${weather.main.humidity}%.`)}
          </AlertDescription>
        </Alert>
      )}

      {/* Main 4-metric grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: ThermometerSun, label: ar ? "درجة الحرارة" : "Temperature", value: `${weather.main.temp.toFixed(1)}°C`,
            sub: `${ar ? "محسوسة" : "Feels like"} ${weather.main.feels_like.toFixed(1)}°C`,
            color: tempColor, bar: efficiency, barLabel: ar ? "كفاءة الألواح" : "Panel Efficiency", barVal: `${efficiency.toFixed(0)}%` },
          { icon: Sun, label: ar ? "الإشعاع الشمسي" : "Solar Irradiance", value: `${irradiance}`,
            sub: `W/m² • ${Math.round((irradiance / 1000) * 100)}% ${ar ? "من الذروة" : "of peak"}`,
            color: irradianceColor, bar: weather.clouds.all, barLabel: ar ? "الغيوم" : "Cloud Cover", barVal: `${weather.clouds.all}%`, barColor: "hsl(217 91% 60%)" },
          { icon: Wind, label: ar ? "سرعة الرياح" : "Wind Speed", value: weather.wind.speed.toFixed(1),
            sub: `m/s • ${getWindDirection(weather.wind.deg)} (${weather.wind.deg}°)`,
            color: windColor, bar: Math.min(100, (weather.wind.speed / 20) * 100),
            barLabel: ar ? "خطر على المعدات" : "Equipment Risk",
            barVal: weather.wind.speed < 10 ? (ar ? "منخفض" : "Low") : weather.wind.speed < 15 ? (ar ? "متوسط" : "Medium") : (ar ? "مرتفع" : "High") },
          { icon: Droplets, label: ar ? "الرطوبة" : "Humidity", value: `${weather.main.humidity}%`,
            sub: ar ? "رطوبة نسبية" : "Relative humidity",
            color: humColor, bar: weather.main.humidity, barLabel: ar ? "حالة التنظيف" : "Cleaning Status",
            barVal: weather.main.humidity > 80 ? (ar ? "عاجل" : "Urgent") : weather.main.humidity > 60 ? (ar ? "قريبًا" : "Soon") : (ar ? "عادي" : "Normal") },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-5 hover:shadow-xl transition-smooth hover:-translate-y-1 border-2 border-border/60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${m.color}25` }}>
                  <m.icon className="w-5 h-5" style={{ color: m.color }} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{m.label}</span>
              </div>
              <div className="text-4xl font-black" style={{ color: m.color }}>{m.value}</div>
              <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />{m.sub}
              </div>
              <div className="pt-3 mt-3 border-t border-border">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-muted-foreground">{m.barLabel}</span>
                  <span className="font-bold" style={{ color: m.color }}>{m.barVal}</span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-700 rounded-full" style={{ width: `${m.bar}%`, backgroundColor: m.barColor || m.color }} />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Secondary stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Sunrise, label: ar ? "الشروق" : "Sunrise", value: sunrise },
          { icon: Sunset, label: ar ? "الغروب" : "Sunset", value: sunset },
          { icon: Gauge, label: ar ? "الضغط" : "Pressure", value: `${weather.main.pressure} hPa` },
          { icon: Eye, label: ar ? "الرؤية" : "Visibility", value: `${(weather.visibility / 1000).toFixed(1)} km` },
          { icon: Compass, label: ar ? "اتجاه الرياح" : "Wind Dir", value: `${getWindDirection(weather.wind.deg)} ${weather.wind.deg}°` },
          { icon: CircuitBoard, label: ar ? "الموقع" : "Location", value: weather.name || "Minya" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
            <Card className="p-3 hover:shadow-md transition-smooth">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
              </div>
              <div className="text-sm font-bold">{s.value}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Featured efficiency gauge + system performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-1">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />{ar ? "كفاءة الإنتاج الحالية" : "Current Production Efficiency"}
          </h3>
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="65%" outerRadius="100%" data={efficiencyRadial} startAngle={220} endAngle={-40}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={12} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black" style={{ color: tempColor }}>{efficiency.toFixed(0)}%</span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{ar ? "كفاءة الألواح" : "Panel Efficiency"}</span>
            </div>
          </div>
          <div className="mt-3 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: tempColor }} />
            <span>{ar
              ? `الذروة عند 10–25°م. حاليًا: ${weather.main.temp.toFixed(1)}°م.`
              : `Peak at 10–25°C. Current: ${weather.main.temp.toFixed(1)}°C.`}</span>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent" />{ar ? "أداء النظام (متعدد المحاور)" : "System Performance Radar"}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={performanceData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Radar name={ar ? "الحالي" : "Current"} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
              <Radar name={ar ? "الأمثل" : "Optimal"} dataKey="optimal" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.2} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Forecast charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <ThermometerSun className="w-4 h-4 text-primary" />{ar ? "توقعات درجة الحرارة (24س)" : "Temperature Forecast (24h)"}
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="temp" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#tempGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Wind className="w-4 h-4 text-accent" />{ar ? "الرياح والرطوبة" : "Wind & Humidity"}
          </h3>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="wind" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name={ar ? "رياح (م/ث)" : "Wind (m/s)"} />
              <Line type="monotone" dataKey="humidity" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 3 }} name={ar ? "رطوبة (%)" : "Humidity (%)"} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Sun className="w-4 h-4 text-primary" />{ar ? "تأثير الغطاء السحابي على الإنتاج" : "Cloud Coverage Impact on Production"}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="clouds" radius={[6, 6, 0, 0]} name={ar ? "الغيوم (%)" : "Cloud Cover (%)"}>
                {forecastData.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.clouds > 70 ? "hsl(var(--destructive))" : entry.clouds > 40 ? "hsl(38 92% 50%)" : "hsl(142 70% 45%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
