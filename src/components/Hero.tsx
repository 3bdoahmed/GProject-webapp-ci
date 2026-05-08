import { ArrowRight, Activity, Cpu, Cloud, BellRing, ShieldCheck, Sparkles, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import dashboardImg from "@/assets/dashboard-mockup.jpg";

export function Hero() {
  const { t, lang } = useLanguage();
  const pills = [
    { icon: Activity, key: "hero.pill.live" },
    { icon: Cloud, key: "hero.pill.cloud" },
    { icon: Cpu, key: "hero.pill.iot" },
    { icon: BellRing, key: "hero.pill.alerts" },
    { icon: ShieldCheck, key: "hero.pill.security" },
    { icon: Sparkles, key: "hero.pill.ai" },
  ];
  const isAr = lang === "ar";

  return (
    <section id="home" className="relative min-h-screen flex items-center overflow-hidden pt-28 pb-16">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 grid-pattern opacity-[0.15] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[140px] animate-pulse-glow" />
      <div className="absolute bottom-0 -right-40 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[140px] animate-pulse-glow" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 text-center lg:text-start">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase">{t("hero.badge")}</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight mb-6">
              {isAr ? (
                <>
                  <span>منظومة </span>
                  <span className="text-gradient-gold">الطاقة</span>
                  <br />
                  الذكية للمراقبة
                  <br />
                  <span className="text-gradient">والتشغيل</span>
                </>
              ) : (
                <>
                  Smart <span className="text-gradient-gold">Energy</span>
                  <br />
                  Monitoring &amp;
                  <br />
                  <span className="text-gradient">Operation System</span>
                </>
              )}
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              {t("hero.sub")}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10">
              <Link to="/auth"
                className="px-7 h-13 py-4 rounded-full gradient-hero text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-glow hover:scale-105 transition-all">
                {t("hero.cta.launch")} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
              <a href="#about"
                className="px-7 py-4 rounded-full glass border border-border font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/5 transition-all">
                <Play className="w-3.5 h-3.5 rtl:rotate-180" /> {t("hero.cta.how")}
              </a>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.06 }}}}
              className="flex flex-wrap justify-center lg:justify-start gap-2">
              {pills.map(p => (
                <motion.div key={p.key}
                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 }}}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-border/50 text-[11px] font-bold">
                  <p.icon className="w-3 h-3 text-accent" /> {t(p.key)}
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="lg:col-span-5 relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-accent/30 via-primary/20 to-transparent blur-3xl" />
            <div className="relative rounded-3xl overflow-hidden shadow-elevated border border-border/40 bg-card animate-float">
              <img src={dashboardImg} alt={t("hero.dashboard.alt")} width={1280} height={832} className="w-full h-auto" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent pointer-events-none" />
            </div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}
              className="absolute -left-4 top-10 glass-strong rounded-2xl p-3 shadow-card hidden md:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{t("hero.float.live")}</div>
                <div className="text-sm font-black">5.24 kW</div>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}
              className="absolute -right-4 bottom-10 glass-strong rounded-2xl p-3 shadow-card hidden md:flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{t("hero.float.ai")}</div>
                <div className="text-sm font-black">{t("hero.float.healthy")}</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
