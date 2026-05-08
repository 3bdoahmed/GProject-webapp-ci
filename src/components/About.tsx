import { Brain, Shield, Zap, Cloud } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const }
  }),
};

export function About() {
  const { t } = useLanguage();
  const pillars = [
    { icon: Zap, k: "about.f1", color: "from-amber-400 to-orange-500" },
    { icon: Brain, k: "about.f2", color: "from-emerald-400 to-teal-500" },
    { icon: Cloud, k: "about.f3", color: "from-cyan-400 to-blue-500" },
    { icon: Shield, k: "about.f4", color: "from-violet-400 to-purple-500" },
  ];

  return (
    <section id="about" className="py-20 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-5 sm:px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
            className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
            <motion.span variants={fadeUp} custom={0}
              className="inline-block text-[10px] sm:text-xs font-bold text-primary tracking-[0.3em] uppercase mb-4">
              {t("about.tag")}
            </motion.span>
            <motion.h2 variants={fadeUp} custom={1}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-5 leading-[1.1]">
              {t("about.title1")} <span className="text-gradient">{t("about.title2")}</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2}
              className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
              {t("about.short")}
            </motion.p>
            <motion.div variants={fadeUp} custom={3}
              className="flex items-center justify-center gap-3 mt-6">
              <div className="h-[2px] w-10 gradient-hero rounded-full" />
              <span className="text-[10px] sm:text-xs font-bold text-primary tracking-[0.2em] uppercase">{t("about.excellence")}</span>
              <div className="h-[2px] w-10 gradient-hero rounded-full" />
            </motion.div>
          </motion.div>

          {/* Pillars */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {pillars.map((f, i) => (
              <motion.div key={f.k} variants={fadeUp} custom={i}
                className="group relative p-4 sm:p-6 rounded-2xl glass-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-500">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-md`}>
                  <f.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm mb-1 sm:mb-1.5 group-hover:text-primary transition-colors">
                  {t(`${f.k}.title`)}
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t(`${f.k}.desc`)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
