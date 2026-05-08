import { Activity, BarChart3, Bell, Brain, ShieldCheck, Leaf, Cloud, Zap, Database } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

export function Features() {
  const { t } = useLanguage();
  const features = [
    { icon: Activity, k: "features.f1" },
    { icon: BarChart3, k: "features.f2" },
    { icon: Bell, k: "features.f3" },
    { icon: Brain, k: "features.f4" },
    { icon: ShieldCheck, k: "features.f5" },
    { icon: Cloud, k: "features.f6" },
    { icon: Database, k: "features.f7" },
    { icon: Zap, k: "features.f8" },
    { icon: Leaf, k: "features.f9" },
  ];
  const audiences = [
    { k: "features.audience.plants", emoji: "☀️" },
    { k: "features.audience.factories", emoji: "🏭" },
    { k: "features.audience.farms", emoji: "🌱" },
  ];

  return (
    <section id="features" className="py-32 bg-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} className="text-center mb-16">
          <span className="inline-block text-xs font-bold text-primary tracking-[0.3em] uppercase mb-3">{t("features.tag")}</span>
          <h2 className="text-4xl md:text-5xl font-black mb-4">{t("features.title1")} <span className="text-gradient-gold">{t("features.title2")}</span></h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("features.desc")}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {features.map((f, i) => (
            <motion.div key={f.k}
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="glass rounded-2xl p-6 hover:shadow-card hover:-translate-y-1 transition-all group">
              <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="font-black text-base mb-1.5">{t(`${f.k}.title`)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(`${f.k}.desc`)}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
          className="grid md:grid-cols-3 gap-4 max-w-6xl mx-auto mt-10">
          {audiences.map(a => (
            <div key={a.k} className="glass rounded-2xl p-6 text-center">
              <div className="text-3xl mb-2">{a.emoji}</div>
              <p className="font-bold text-sm">{t(a.k)}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
