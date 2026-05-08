import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import logoMark from "@/assets/logo-mark.png";

export default function ResetPassword() {
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false); const [ready, setReady] = useState(false);
  const navigate = useNavigate(); const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setReady(!!session));
    const { data: { subscription }} = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast({ variant: "destructive", title: t("reset.mismatch") });
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast({ variant: "destructive", title: error.message });
    else { toast({ title: t("reset.updated") }); navigate("/dashboard"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center mb-8">
          <img src={logoMark} alt="Logo" className="h-14 w-14 object-contain drop-shadow-lg" />
        </Link>
        <div className="glass-strong rounded-3xl p-8 shadow-elevated">
          <h1 className="text-2xl font-black mb-1">{t("reset.title")}</h1>
          <p className="text-sm text-muted-foreground mb-6">{ready ? t("reset.choose") : t("reset.validating")}</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} placeholder={t("reset.new")}
                className="w-full pl-11 rtl:pl-4 rtl:pr-11 pr-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-ring focus:outline-none text-sm" />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input required type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={6} placeholder={t("reset.confirm")}
                className="w-full pl-11 rtl:pl-4 rtl:pr-11 pr-4 py-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-ring focus:outline-none text-sm" />
            </div>
            <button type="submit" disabled={loading || !ready} className="w-full py-3.5 rounded-xl gradient-hero text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:shadow-glow transition-smooth disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("reset.update")}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
