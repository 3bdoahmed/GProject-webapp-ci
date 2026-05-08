import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast as sonner } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadNotificationsCount } from "@/lib/notificationRequests";

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { user, session } = useAuth();
  const userId = user?.id;
  const token = session?.access_token;

  useEffect(() => {
    if (!userId || !token) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const nextCount = await fetchUnreadNotificationsCount(userId, token);
        if (mounted) setCount(nextCount);
      } catch (error) {
        console.error("[notifications] count error", error);
      }
    };
    refresh();
    supabase.realtime.setAuth(token);
    const ch = supabase.channel(`notif_bell_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        refresh();
        if (payload.eventType === "INSERT") {
          const m = payload.new as { title: string; body?: string | null };
          sonner(`🔔 ${m.title}`, {
            description: m.body?.slice(0, 80),
            action: { label: lang === "ar" ? "عرض" : "View", onClick: () => navigate("/dashboard/notifications") },
          });
        }
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [lang, navigate, userId, token]);

  return (
    <button onClick={() => navigate("/dashboard/notifications")}
      className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
      aria-label="Notifications">
      <Bell className="w-4 h-4" />
      {count > 0 && (
        <>
          <span className="absolute -top-0.5 -right-0.5 rtl:right-auto rtl:-left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
          <span className="absolute -top-0.5 -right-0.5 rtl:right-auto rtl:-left-0.5 w-[18px] h-[18px] rounded-full bg-destructive/40 animate-ping" />
        </>
      )}
    </button>
  );
}
