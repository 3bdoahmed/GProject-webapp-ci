import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Loader2, ArrowLeft, CheckCircle2, KeyRound, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import logoMark from "@/assets/logo-mark.png";

type Step = "email" | "otp" | "password" | "done";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const ar = lang === "ar";

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { data, error } = await supabase.functions.invoke("send-reset-otp", { body: { email } });
    if (error || (data as any)?.error) toast({ variant: "destructive", title: (data as any)?.error || error?.message || "Error" });
    else { setStep("otp"); toast({ title: ar ? "تم إرسال الكود" : "Code sent", description: ar ? "افحص بريدك الإلكتروني" : "Check your inbox" }); }
    setLoading(false);
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("reset-password-otp", { body: { email, code: otp, verifyOnly: true } });
    if (error || (data as any)?.error) toast({ variant: "destructive", title: ar ? "كود خاطئ أو منتهي" : "Invalid or expired code", description: (data as any)?.error || error?.message });
    else setStep("password");
    setLoading(false);
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast({ variant: "destructive", title: ar ? "كلمات السر غير متطابقة" : "Passwords do not match" });
    if (password.length < 6) return toast({ variant: "destructive", title: ar ? "كلمة السر قصيرة" : "Password too short" });
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("reset-password-otp", { body: { email, code: otp, newPassword: password } });
    if (error || (data as any)?.error) toast({ variant: "destructive", title: (data as any)?.error || error?.message || "Error" });
    else { setStep("done"); setTimeout(() => navigate("/auth"), 1500); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center mb-8">
          <img src={logoMark} alt="Logo" className="h-14 w-14 object-contain drop-shadow-lg" />
        </Link>

        <div className="glass-strong rounded-3xl p-6 sm:p-8 shadow-elevated">
          <Stepper step={step} />

          {step === "email" && (
            <>
              <h1 className="text-2xl font-black mb-1">{ar ? "نسيت كلمة السر؟" : "Forgot password?"}</h1>
              <p className="text-sm text-muted-foreground mb-6">{ar ? "اكتب بريدك وهنبعتلك كود تحقق من 6 أرقام." : "Enter your email and we'll send you a 6-digit verification code."}</p>
              <form onSubmit={sendOtp} className="space-y-4">
                <Field icon={Mail}>
                  <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={ar ? "البريد الإلكتروني" : "Email"} className="w-full bg-transparent outline-none text-sm" />
                </Field>
                <SubmitBtn loading={loading}>{ar ? "إرسال الكود" : "Send code"}</SubmitBtn>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <h1 className="text-2xl font-black mb-1">{ar ? "أدخل الكود" : "Enter code"}</h1>
              <p className="text-sm text-muted-foreground mb-6">{ar ? "بعتنا كود من 6 أرقام على " : "We sent a 6-digit code to "}<strong className="break-all">{email}</strong></p>
              <form onSubmit={verifyOtp} className="space-y-4">
                <div dir="ltr" className="flex justify-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg font-bold" />)}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <SubmitBtn loading={loading} disabled={otp.length !== 6}>{ar ? "تحقق" : "Verify"}</SubmitBtn>
                <button type="button" onClick={() => setStep("email")} className="w-full text-xs text-muted-foreground hover:text-primary font-semibold">
                  {ar ? "تغيير البريد أو إعادة الإرسال" : "Change email or resend"}
                </button>
              </form>
            </>
          )}

          {step === "password" && (
            <>
              <h1 className="text-2xl font-black mb-1">{ar ? "كلمة سر جديدة" : "New password"}</h1>
              <p className="text-sm text-muted-foreground mb-6">{ar ? "اختر كلمة سر قوية لحسابك." : "Choose a strong password for your account."}</p>
              <form onSubmit={updatePassword} className="space-y-4">
                <Field icon={Lock}>
                  <input required type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder={ar ? "كلمة السر الجديدة" : "New password"} className="w-full bg-transparent outline-none text-sm" />
                </Field>
                <Field icon={Lock}>
                  <input required type="password" minLength={6} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder={ar ? "تأكيد كلمة السر" : "Confirm password"} className="w-full bg-transparent outline-none text-sm" />
                </Field>
                <SubmitBtn loading={loading}>{ar ? "تحديث كلمة السر" : "Update password"}</SubmitBtn>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-14 h-14 mx-auto text-primary mb-4" />
              <h1 className="text-2xl font-black mb-2">{ar ? "تم بنجاح" : "All done!"}</h1>
              <p className="text-sm text-muted-foreground">{ar ? "جارِ تحويلك للوحة التحكم..." : "Redirecting to dashboard..."}</p>
            </div>
          )}

          {step !== "done" && (
            <Link to="/auth" className="block mt-5 text-center text-xs font-semibold text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-3 h-3 inline mr-1 rtl:rotate-180" /> {ar ? "العودة لتسجيل الدخول" : "Back to sign in"}
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const idx = step === "email" ? 0 : step === "otp" ? 1 : 2;
  const icons = [Mail, KeyRound, Lock];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {icons.map((Icon, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-smooth ${i <= idx ? "gradient-hero text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground"}`}>
            <Icon className="w-4 h-4" />
          </div>
          {i < 2 && <div className={`w-6 h-0.5 ${i < idx ? "bg-primary" : "bg-muted"}`} />}
        </div>
      ))}
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

function SubmitBtn({ loading, disabled, children }: { loading: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading || disabled} className="w-full py-3.5 rounded-xl gradient-hero text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:shadow-glow transition-smooth disabled:opacity-50">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}
