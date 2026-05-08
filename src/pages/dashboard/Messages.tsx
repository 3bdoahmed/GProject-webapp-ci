import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, MailOpen, Trash2, Check, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonner } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CardSkeleton } from "@/components/ui/spinner";

type Msg = {
  id: string; name: string; email: string; message: string;
  is_read: boolean; created_at: string;
};

export default function Messages() {
  const { t, lang } = useLanguage();
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Msg | null>(null);

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("contact_messages").select("*").order("created_at", { ascending: false });
    console.log("[Messages] load", { hasToken: !!session?.access_token, rows: data?.length, error: error?.message });
    setLoading(false);
    if (error) { console.error("[Messages] load error", error); return; }
    setItems(data || []);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    const channel = supabase
      .channel("contact_messages_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_messages" }, (payload) => {
        const m = payload.new as Msg;
        setItems((prev) => [m, ...prev]);
        sonner(lang === "ar" ? `رسالة جديدة من ${m.name}` : `New message from ${m.name}`, {
          description: m.message.slice(0, 80),
        });
        try { new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(()=>{}); } catch {}
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "contact_messages" }, (payload) => {
        setItems((prev) => prev.map((x) => x.id === (payload.new as Msg).id ? (payload.new as Msg) : x));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "contact_messages" }, (payload) => {
        setItems((prev) => prev.filter((x) => x.id !== (payload.old as Msg).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lang, user, authLoading, session?.access_token]);

  const markRead = async (id: string) => {
    await (supabase as any).from("contact_messages").update({ is_read: true }).eq("id", id);
  };
  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("contact_messages").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else if (open?.id === id) setOpen(null);
  };
  const openMsg = (m: Msg) => {
    setOpen(m);
    if (!m.is_read) markRead(m.id);
  };

  const unread = items.filter((m) => !m.is_read).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("msg.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("msg.sub")} · <span className="text-primary font-bold">{unread}</span> {t("msg.unread")}
        </p>
      </div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : items.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("msg.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {items.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`group rounded-2xl p-3 sm:p-5 border-2 bg-card transition-all hover:-translate-y-0.5 hover:shadow-glow ${m.is_read ? "border-border" : "border-primary shadow-glow ring-2 ring-primary/20"}`}
              >
                <div className="flex items-start gap-2 sm:gap-4">
                  <div className={`shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${m.is_read ? "bg-muted text-muted-foreground" : "gradient-hero text-primary-foreground shadow-glow"}`}>
                    {m.is_read ? <MailOpen className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                  </div>
                  <button onClick={() => openMsg(m)} className="flex-1 min-w-0 text-start">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-black text-sm truncate">{m.name}</h3>
                      {!m.is_read && <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground px-2 py-0.5 rounded-full gradient-hero">{t("msg.new")}</span>}
                      <span className="ms-auto text-[10px] sm:text-[11px] text-muted-foreground shrink-0">{new Date(m.created_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                    </div>
                    <span className="text-xs text-primary truncate block">{m.email}</span>
                    <p className="text-sm text-foreground/85 mt-2 line-clamp-2 break-words leading-relaxed">{m.message}</p>
                  </button>
                  <div className="flex flex-col gap-1.5 sm:gap-2 shrink-0">
                    <button onClick={() => openMsg(m)} title={t("msg.view")}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all">
                      <Eye className="h-4 w-4" />
                    </button>
                    {!m.is_read && (
                      <button onClick={() => markRead(m.id)} title={t("msg.markread")}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all">
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => remove(m.id)} title={t("msg.delete")}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border-2 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="glass-card max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-black">{open.name}</DialogTitle>
                <DialogDescription>
                  <a href={`mailto:${open.email}`} className="text-primary hover:underline">{open.email}</a>
                  <span className="block text-[11px] mt-1">{new Date(open.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm whitespace-pre-wrap break-words bg-muted/30 rounded-xl p-4 border border-border max-h-[50vh] overflow-auto">
                {open.message}
              </div>
              <DialogFooter className="gap-2">
                <a href={`mailto:${open.email}`} className="text-xs font-bold px-4 py-2 rounded-xl gradient-hero text-primary-foreground">
                  {t("msg.reply")}
                </a>
                <button onClick={() => remove(open.id)} className="text-xs font-bold px-4 py-2 rounded-xl glass-card hover:bg-destructive hover:text-destructive-foreground transition-all flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" /> {t("msg.delete")}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
