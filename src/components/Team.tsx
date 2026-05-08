import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

import islamImg from "@/assets/team/islam.jpg";
import gioushy from "@/assets/team/gioushy.jpg";
import mostafa from "@/assets/team/mostafa.jpg";
import abdelrahman from "@/assets/team/abdelrahman.jpg";
import ismailImg from "@/assets/team/ismail.jpg";
import omarImg from "@/assets/team/omar.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: "easeOut" as const }
  }),
};
const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: "easeOut" as const } },
};

export function Team() {
  const { t, lang } = useLanguage();
  const isAr = lang === "ar";

  const supervisor = {
    name: isAr ? "د. منى سيد" : "Dr. Mona Sayed",
    role: t("team.role.supervisor"),
    initials: isAr ? "م.س" : "MS",
  };

  const members = [
    { name: isAr ? "إسلام شعبان" : "Islam Shaban", role: t("team.role.web"), image: islamImg },
    { name: isAr ? "محمد الجيوشي" : "Mohamed El-Gioushy", role: t("team.role.embedded"), image: gioushy },
    { name: isAr ? "محمد أبوزيد" : "Muhammad Abozied", role: t("team.role.security"), image: mostafa },
    { name: isAr ? "عبدالرحمن أحمد" : "Abdelrahman Ahmed", role: t("team.role.cloud"), image: abdelrahman },
    { name: isAr ? "إسماعيل محمد" : "Ismail Mohamed", role: t("team.role.control"), image: ismailImg },
    { name: isAr ? "عمر خالد" : "Omar Khaled", role: t("team.role.control"), image: omarImg },
  ];

  return (
    <section id="team" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
          <motion.span variants={fadeUp} custom={0} className="inline-block text-sm font-semibold text-primary tracking-widest uppercase mb-4">
            {t("team.tag")}
          </motion.span>
          <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-black mb-4">
            {t("team.title1")} <span className="text-gradient">{t("team.title2")}</span>
          </motion.h2>
          <motion.div variants={fadeUp} custom={2} className="w-20 h-1 gradient-hero rounded-full mx-auto" />
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} className="max-w-md mx-auto mb-8">
          <div className="relative p-1 rounded-3xl gradient-hero shadow-glow">
            <div className="relative rounded-3xl bg-card p-8 text-center overflow-hidden">
              <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
                <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center shadow-lg">
                  <Crown className="h-5 w-5 text-accent-foreground" />
                </div>
              </div>
              <div className="relative w-28 h-28 mx-auto mb-5">
                <div className="absolute -inset-1 rounded-full gradient-hero opacity-30 blur-md animate-pulse-glow" />
                <div className="relative w-28 h-28 rounded-full gradient-hero flex items-center justify-center border-4 border-primary/20">
                  <span className="text-3xl font-black text-primary-foreground">{supervisor.initials}</span>
                </div>
              </div>
              <span className="inline-block text-xs font-bold text-primary tracking-widest uppercase mb-2">
                {t("team.supervisor")}
              </span>
              <h3 className="text-2xl font-black mb-1">{supervisor.name}</h3>
              <p className="text-sm text-muted-foreground">{supervisor.role}</p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <div className="h-px w-12 gradient-hero opacity-50" />
                <div className="w-2 h-2 rounded-full gradient-hero" />
                <div className="h-px w-12 gradient-hero opacity-50" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }} className="w-px h-16 gradient-hero mx-auto origin-top opacity-40" />

        <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.5 }} className="text-center mb-8">
          <span className="inline-block px-5 py-2 rounded-full glass-card text-xs font-bold text-primary tracking-widest uppercase">
            {t("team.members")}
          </span>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {members.map((member, i) => (
            <motion.div key={i} variants={fadeUp} custom={i + 2} className="group">
              <div className="relative rounded-2xl glass-card p-5 text-center hover:shadow-elevated hover:-translate-y-3 transition-all duration-500 cursor-pointer overflow-hidden">
                <div className="absolute inset-0 gradient-hero opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className="absolute -inset-1 rounded-full gradient-hero opacity-0 group-hover:opacity-30 blur-md transition-opacity duration-500" />
                    {"image" in member && member.image ? (
                      <img src={member.image} alt={member.name}
                        className="relative w-20 h-20 rounded-full object-cover border-2 border-border group-hover:border-primary/40 transition-colors duration-500" />
                    ) : (
                      <div className="relative w-20 h-20 rounded-full gradient-hero flex items-center justify-center border-2 border-primary/20 group-hover:scale-110 transition-transform duration-500">
                        <span className="text-xl font-bold text-primary-foreground">
                          {"initials" in member ? String((member as { initials: string }).initials) : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors duration-300">{member.name}</h3>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                  <div className="h-0.5 w-0 group-hover:w-10 gradient-hero rounded-full transition-all duration-500 mx-auto mt-3" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
