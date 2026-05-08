import { motion } from "framer-motion";
import { Send, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" as const }
  }),
};

export function Contact() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const targetEmail = "eslamshaban060@gmail.com";

  const schema = z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255),
    message: z.string().trim().min(1).max(1000),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(formData);
    if (!parsed.success) {
      toast({ title: t("contact.toast.invalid"), description: parsed.error.errors[0]?.message, variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await (supabase as any).from("contact_messages").insert(parsed.data);
    setSending(false);
    if (error) {
      toast({ title: t("contact.toast.error"), description: error.message, variant: "destructive" });
      return;
    }
    // Fire-and-forget email notification to dashboard owner
    supabase.functions.invoke("notify-new-message", { body: { ...parsed.data, kind: "message" } }).catch(() => {});
    toast({ title: t("contact.toast.title"), description: t("contact.toast.desc") });
    setFormData({ name: "", email: "", message: "" });
  };

  const contactInfo = [
    { icon: Mail, label: t("contact.info.email"), value: targetEmail },
    { icon: MapPin, label: t("contact.info.location"), value: t("contact.info.location.value") },
    { icon: Phone, label: t("contact.info.phone"), value: "+20 123 456 7890" },
  ];

  return (
    <section id="contact" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
          <motion.span variants={fadeUp} custom={0} className="inline-block text-sm font-semibold text-primary tracking-widest uppercase mb-4">
            {t("contact.tag")}
          </motion.span>
          <motion.h2 variants={fadeUp} custom={1} className="text-4xl md:text-5xl font-black mb-4">
            {t("contact.title1")} <span className="text-gradient">{t("contact.title2")}</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-lg mx-auto">{t("contact.desc")}</motion.p>
        </motion.div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="md:col-span-2 space-y-6">
            {contactInfo.map((item, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="flex items-start gap-4 group">
                <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center shrink-0 shadow-glow group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-sm text-foreground">{item.value}</p>
                </div>
              </motion.div>
            ))}
            <motion.div variants={fadeUp} custom={4} className="hidden md:block mt-8 p-6 rounded-2xl glass-card">
              <p className="text-sm text-muted-foreground leading-relaxed">{t("contact.bio")}</p>
            </motion.div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="md:col-span-3">
            <motion.form variants={fadeUp} custom={1} onSubmit={handleSubmit} className="p-8 rounded-2xl glass-card space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">{t("contact.form.name")}</label>
                  <input type="text" required maxLength={100} value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    placeholder={t("contact.form.name.ph")} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">{t("contact.form.email")}</label>
                  <input type="email" required maxLength={255} value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    placeholder={t("contact.form.email.ph")} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-primary uppercase tracking-widest mb-2">{t("contact.form.message")}</label>
                <textarea required maxLength={1000} rows={5} value={formData.message}
                  onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                  placeholder={t("contact.form.message.ph")} />
              </div>
              <button type="submit" disabled={sending}
                className="w-full py-3.5 rounded-xl gradient-hero text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:shadow-glow hover:scale-[1.02] transition-all duration-300 disabled:opacity-60">
                {sending ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <><Send className="h-4 w-4 rtl:-scale-x-100" /> {t("contact.form.send")}</>
                )}
              </button>
            </motion.form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
