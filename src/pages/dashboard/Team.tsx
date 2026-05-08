import { useEffect, useState } from "react";
import { Trash2, Mail, Phone, Briefcase, Building2, Globe, Crown, Shield, Wrench, UserPlus, Loader2, User, Lock, MapPin, X } from "lucide-react";
import { PageLoader } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Role = "owner" | "admin" | "engineer";
type Member = {
  id: string; full_name: string | null; email: string | null; avatar_url: string | null;
  position: string | null; department: string | null; phone: string | null;
  country: string | null; bio: string | null; created_at: string;
  role?: Role;
};

const roleMeta: Record<Role, { icon: any; label: { en: string; ar: string }; cls: string }> = {
  owner:    { icon: Crown,  label: { en: "Owner", ar: "المالك" },    cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  admin:    { icon: Shield, label: { en: "Admin", ar: "مشرف" },      cls: "bg-primary/15 text-primary border-primary/30" },
  engineer: { icon: Wrench, label: { en: "Engineer", ar: "مهندس" }, cls: "bg-muted text-muted-foreground border-border" },
};

export default function Team() {
  const { user, session } = useAuth();
  const { t, lang } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", phone: "",
    position: "", department: "", country: "", role: "engineer" as "engineer" | "admin",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      (supabase as any).from("profiles").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("user_roles").select("user_id, role"),
    ]);
    console.log("[Team] load", { hasToken: !!session?.access_token, profiles: profiles?.length, roles: roles?.length });
    if (!profiles || profiles.length === 0) { setLoading(false); return; }
    const map = new Map<string, Role>();
    (roles || []).forEach((r: any) => {
      const cur = map.get(r.user_id);
      const rank = (x: Role) => x === "owner" ? 1 : x === "admin" ? 2 : 3;
      if (!cur || rank(r.role) < rank(cur)) map.set(r.user_id, r.role);
    });
    setMembers((profiles || []).map((p: Member) => ({ ...p, role: map.get(p.id) || "engineer" })));
    setLoading(false);
    if (user) {
      // Use security-definer RPC so RLS can't hide our own role
      const { data: myRoleData } = await (supabase as any).rpc("get_user_role", { _user_id: user.id });
      const top = (myRoleData as Role) || map.get(user.id) || "engineer";
      setMyRole(top);
      console.log("[Team] myRole", top);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  const canAdd = myRole === "owner" || myRole === "admin";
  const canDelete = (target: Member) => {
    if (!myRole || target.id === user?.id) return false;
    const tRole = (target.role || "engineer") as Role;
    if (tRole === "owner") return false;
    if (myRole === "owner") return true;
    if (myRole === "admin") return tRole === "engineer";
    return false;
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { target_id: confirmDel.id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Failed");
      toast({ title: lang === "ar" ? "تم حذف العضو" : "Member deleted" });
      setConfirmDel(null);
      load();
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally { setDeleting(false); }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: form,
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Failed");
      toast({ title: lang === "ar" ? "تم إنشاء العضو" : "Member created" });
      setAddOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", position: "", department: "", country: "", role: "engineer" });
      load();
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally { setAdding(false); }
  };

  const ordered = [...members].sort((a, b) => {
    const rank = (x?: Role) => x === "owner" ? 1 : x === "admin" ? 2 : 3;
    return rank(a.role) - rank(b.role);
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black mb-1">{t("tp.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("tp.sub")} · <span className="text-primary font-bold">{members.length}</span>
          </p>
        </div>
        {canAdd && (
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-hero text-primary-foreground text-sm font-bold shadow-glow hover:shadow-elevated transition-all">
            <UserPlus className="w-4 h-4" /> {lang === "ar" ? "إضافة عضو" : "Add member"}
          </button>
        )}
      </div>

      {loading ? <PageLoader label={lang === "ar" ? "جاري التحميل" : "Loading team"} /> : (
        ordered.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground text-sm">{t("tp.empty")}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((m, i) => {
              const role = (m.role || "engineer") as Role;
              const meta = roleMeta[role];
              const Icon = meta.icon;
              const isMe = m.id === user?.id;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl p-5 relative group hover:shadow-glow hover:-translate-y-0.5 transition-all border-2 border-border bg-card"
                >
                  <div className="absolute inset-x-0 top-0 h-20 gradient-hero opacity-10 rounded-t-2xl" />
                  <div className="relative flex items-start gap-4">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.full_name || ""}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-background shadow-lg" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl gradient-hero flex items-center justify-center text-primary-foreground font-black text-xl shadow-lg">
                        {(m.full_name || m.email || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black truncate">{m.full_name || "—"}</p>
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border ${meta.cls}`} title={meta.label[lang as "en" | "ar"]}>
                          <Icon className="w-3 h-3" />
                        </span>
                        {isMe && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">{lang === "ar" ? "أنت" : "You"}</span>}
                      </div>
                      <p className="text-xs font-semibold text-primary mt-1 truncate">
                        {m.position || meta.label[lang as "en" | "ar"]}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs">
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors truncate">
                        <Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{m.email}</span>
                      </a>
                    )}
                    {m.phone && (
                      <a href={`tel:${m.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                        <Phone className="w-3.5 h-3.5 shrink-0" /> {m.phone}
                      </a>
                    )}
                    {m.position && (
                      <p className="flex items-center gap-2 text-muted-foreground"><Briefcase className="w-3.5 h-3.5 shrink-0" /> {m.position}</p>
                    )}
                    {m.department && (
                      <p className="flex items-center gap-2 text-muted-foreground"><Building2 className="w-3.5 h-3.5 shrink-0" /> {m.department}</p>
                    )}
                    {m.country && (
                      <p className="flex items-center gap-2 text-muted-foreground"><Globe className="w-3.5 h-3.5 shrink-0" /> {m.country}</p>
                    )}
                    {m.bio && (
                      <p className="text-muted-foreground/90 leading-relaxed pt-2 mt-2 border-t border-border/60 line-clamp-3 whitespace-pre-wrap break-words">
                        {m.bio}
                      </p>
                    )}
                  </div>

                  {canDelete(m) && (
                    <button onClick={() => setConfirmDel(m)}
                      className="absolute top-3 end-3 p-2 rounded-lg bg-destructive/10 hover:bg-destructive hover:text-destructive-foreground text-destructive transition-all sm:opacity-0 sm:group-hover:opacity-100"
                      title={lang === "ar" ? "حذف" : "Delete"}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="glass-card border-2 border-primary/20 p-0 max-w-lg w-[calc(100vw-1.5rem)] sm:w-full max-h-[92vh] overflow-hidden rounded-2xl sm:rounded-3xl">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-32 gradient-hero opacity-15 pointer-events-none" />
            <DialogHeader className="relative px-5 sm:px-7 pt-6 pb-3 text-start">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl gradient-hero flex items-center justify-center shadow-glow shrink-0">
                  <UserPlus className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="font-black text-lg sm:text-xl">
                    {lang === "ar" ? "إضافة عضو جديد" : "Add new member"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === "ar" ? "املأ البيانات لإنشاء حساب" : "Fill the details to create an account"}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={submitAdd} className="relative px-5 sm:px-7 pb-5 sm:pb-7 pt-2 space-y-3 text-sm overflow-y-auto max-h-[calc(92vh-9rem)]">
              <FormField icon={User} placeholder={lang === "ar" ? "الاسم الكامل" : "Full name"} required
                value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <FormField icon={Mail} type="email" placeholder={lang === "ar" ? "البريد الإلكتروني" : "Email"} required
                value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <FormField icon={Lock} type="password" placeholder={lang === "ar" ? "كلمة المرور (6+ أحرف)" : "Password (6+ chars)"} required minLength={6}
                value={form.password} onChange={(v) => setForm({ ...form, password: v })} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField icon={Phone} placeholder={lang === "ar" ? "الهاتف" : "Phone"}
                  value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <FormField icon={MapPin} placeholder={lang === "ar" ? "الدولة" : "Country"}
                  value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
                <FormField icon={Briefcase} placeholder={lang === "ar" ? "المنصب" : "Position"}
                  value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
                <FormField icon={Building2} placeholder={lang === "ar" ? "القسم" : "Department"}
                  value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
              </div>

              {myRole === "owner" && (
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    {lang === "ar" ? "الدور" : "Role"}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["engineer", "admin"] as const).map(r => {
                      const meta = roleMeta[r];
                      const Icon = meta.icon;
                      const active = form.role === r;
                      return (
                        <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                          className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${active ? "border-primary bg-primary/10 text-primary shadow-glow" : "border-border bg-background hover:border-primary/40"}`}>
                          <Icon className="w-3.5 h-3.5" /> {meta.label[lang as "en" | "ar"]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-3 flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2">
                <button type="button" onClick={() => setAddOpen(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-muted text-muted-foreground hover:bg-muted/70 text-xs font-bold transition-colors">
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button type="submit" disabled={adding}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl gradient-hero text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 shadow-glow hover:shadow-elevated transition-all">
                  {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {lang === "ar" ? "إنشاء العضو" : "Create member"}
                </button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent className="glass-card border-2 border-destructive/30 max-w-sm w-[calc(100vw-1.5rem)] rounded-2xl">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-destructive/15 flex items-center justify-center mb-2">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <AlertDialogTitle className="font-black">
              {lang === "ar" ? "حذف العضو؟" : "Delete member?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? `سيتم حذف "${confirmDel?.full_name || confirmDel?.email}" نهائياً. لا يمكن التراجع.`
                : `"${confirmDel?.full_name || confirmDel?.email}" will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl">
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} disabled={deleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2">
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {lang === "ar" ? "حذف نهائي" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormField({ icon: Icon, value, onChange, ...props }: any) {
  return (
    <div className="relative">
      <Icon className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input {...props} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full ps-10 pe-3 py-2.5 rounded-xl bg-background border-2 border-border outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm" />
    </div>
  );
}
