import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoMark from "@/assets/logo-mark.png";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useAuth } from "@/hooks/useAuth";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const { user, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      toast({ title: t("auth.welcome") });
      navigate("/dashboard", { replace: true });
      return;
    } catch (err: any) {
      toast({ variant: "destructive", title: t("auth.error"), description: err.message });
      setLoading(false);
    }
  };

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute top-4 right-4 z-10"><LanguageToggle /></div>

      {loading && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-bold">{lang === "ar" ? "جارِ تسجيل الدخول..." : "Signing in..."}</p>
        </div>
      )}

      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center mb-8">
          <img src={logoMark} alt="Logo" className="h-14 w-14 object-contain drop-shadow-lg" />
        </Link>

        <div className="glass-strong rounded-3xl p-8 shadow-elevated">
          <h1 className="text-2xl font-black mb-1">{t("auth.welcome")}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t("auth.signin.sub")}</p>

          <form onSubmit={submit} className="space-y-3">
            <Field icon={Mail}><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={255} placeholder={t("auth.email")} className="w-full bg-transparent outline-none text-sm" /></Field>
            <Field icon={Lock}><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} placeholder={t("auth.password")} className="w-full bg-transparent outline-none text-sm" /></Field>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">{t("auth.forgot")}</Link>
            </div>

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl gradient-hero text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:shadow-glow transition-smooth disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t("auth.signin")} <ArrowRight className="w-4 h-4 rtl:rotate-180" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {lang === "ar" ? "الحسابات يتم إنشاؤها بواسطة المسؤول" : "Accounts are created by an administrator"}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-background border border-border focus-within:ring-2 focus-within:ring-ring">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      {children}
    </div>
  );
}
