import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mail, Check, CheckCheck, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CardSkeleton } from "@/components/ui/spinner";
import {
  DashboardNotification,
  deleteNotification,
  fetchNotifications,
  markNotificationRead,
  markNotificationsRead,
} from "@/lib/notificationRequests";

type Notif = DashboardNotification;

export default function Notifications() {
  const { t, lang } = useLanguage();
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [open, setOpen] = useState<Notif | null>(null);

  const load = useCallback(async () => {
    if (!user || !session?.access_token) return;
    try {
      const data = await fetchNotifications(user.id, session.access_token);
      setItems(data || []);
    } catch (error) {
      console.error("[notifications] load error", error);
    } finally {
      setLoading(false);
    }
  }, [user, session?.access_token]);

  useEffect(() => {
    if (authLoading || !user || !session?.access_token) return;
    const uid = user.id;
    load();
    supabase.realtime.setAuth(session.access_token);
    const ch = supabase.channel(`notif_page_${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        setItems(prev => [p.new as Notif, ...prev.filter(x => x.id !== (p.new as Notif).id)]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        setItems(prev => prev.map(x => x.id === (p.new as Notif).id ? (p.new as Notif) : x));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        setItems(prev => prev.filter(x => x.id !== (p.old as Notif).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, session?.access_token, authLoading, load]);

  const markAll = async () => {
    if (!user || !session?.access_token) return;
    await markNotificationsRead(user.id, session.access_token);
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
  };
  const markOne = async (id: string) => {
    if (!session?.access_token) return;
    await markNotificationRead(id, session.access_token);
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };
  const removeOne = async (id: string) => {
    if (!session?.access_token) return;
    await deleteNotification(id, session.access_token);
    setItems(prev => prev.filter(n => n.id !== id));
    if (open?.id === id) setOpen(null);
  };
  const openOne = (n: Notif) => { setOpen(n); if (!n.is_read) markOne(n.id); };
  const goLink = (n: Notif) => { if (n.link) navigate(n.link); setOpen(null); };

  const shown = filter === "unread" ? items.filter(x => !x.is_read) : items;
  const unread = items.filter(x => !x.is_read).length;

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return lang === "ar" ? "الآن" : "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}${lang === "ar" ? " د" : "m"}`;
    if (diff < 86400) return `${Math.floor(diff/3600)}${lang === "ar" ? " س" : "h"}`;
    return `${Math.floor(diff/86400)}${lang === "ar" ? " ي" : "d"}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            {t("notif.title")}
            {unread > 0 && (
              <span className="relative inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-destructive text-destructive-foreground text-xs font-black">
                {unread > 9 ? "9+" : unread}
                <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="text-primary font-bold">{unread}</span> {t("notif.unread")}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAll}
            className="text-xs font-bold px-3 sm:px-4 py-2 rounded-xl glass-card hover:gradient-hero hover:text-primary-foreground transition-all flex items-center gap-2">
            <CheckCheck className="w-4 h-4" /> <span className="hidden sm:inline">{t("notif.markall")}</span>
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {(["all", "unread"] as const).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all ${filter === k ? "gradient-hero text-primary-foreground shadow-glow" : "glass-card text-muted-foreground hover:text-foreground"}`}>
            {t(`notif.filter.${k}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <CardSkeleton count={4} />
      ) : shown.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("notif.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {shown.map(n => (
              <motion.div key={n.id} layout
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className={`group rounded-2xl p-3 sm:p-4 flex gap-2 sm:gap-3 items-start bg-card border-2 transition-all hover:-translate-y-0.5 hover:shadow-glow ${!n.is_read ? "border-primary ring-2 ring-primary/20 shadow-glow" : "border-border"}`}>
                <div className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${!n.is_read ? "gradient-hero text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Mail className="w-4 h-4" />
                </div>
                <button onClick={() => openOne(n)} className="flex-1 min-w-0 text-start">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-bold text-sm truncate flex-1 min-w-0">{n.title}</p>
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground line-clamp-2 break-words">{n.body}</p>}
                </button>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => openOne(n)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all" title={t("msg.view")}>
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  {!n.is_read && (
                    <button onClick={() => markOne(n.id)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all" title={t("msg.markread")}>
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                  <button onClick={() => removeOne(n.id)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border-2 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-all" title={t("msg.delete")}>
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
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
                <DialogTitle className="font-black flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" /> {open.title}
                </DialogTitle>
                <DialogDescription>
                  <span className="block text-[11px] mt-1">{new Date(open.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}</span>
                </DialogDescription>
              </DialogHeader>
              {open.body && (
                <div className="text-sm whitespace-pre-wrap break-words bg-muted/30 rounded-xl p-4 border border-border max-h-[50vh] overflow-auto">
                  {open.body}
                </div>
              )}
              <DialogFooter className="gap-2">
                {open.link && (
                  <button onClick={() => goLink(open)} className="text-xs font-bold px-4 py-2 rounded-xl gradient-hero text-primary-foreground">
                    {lang === "ar" ? "فتح" : "Open"}
                  </button>
                )}
                <button onClick={() => removeOne(open.id)} className="text-xs font-bold px-4 py-2 rounded-xl glass-card hover:bg-destructive hover:text-destructive-foreground transition-all flex items-center gap-2">
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
