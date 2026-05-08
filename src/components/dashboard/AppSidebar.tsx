import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Bot, Settings, LogOut, Mail, Bell, CloudSun, BatteryCharging, ArrowRightLeft, Activity, FileText, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast as sonner } from "sonner";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import logoMark from "@/assets/logo-mark.png";
import { fetchUnreadNotificationsCount } from "@/lib/notificationRequests";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function fetchTotalNotificationsCount(userId: string, token: string) {
  const params = new URLSearchParams({ select: "id", user_id: `eq.${userId}` });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${params}`, {
    method: "HEAD",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: "count=exact",
    },
  });
  if (!res.ok) return 0;
  return Number(res.headers.get("content-range")?.split("/").pop() || 0);
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut, user, session } = useAuth();
  const { t, lang } = useLanguage();
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notesTotal, setNotesTotal] = useState(0);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const [{ count: u }, { count: tt }] = await Promise.all([
        (supabase as any).from("contact_messages").select("id", { count: "exact", head: true }).eq("is_read", false),
        (supabase as any).from("contact_messages").select("id", { count: "exact", head: true }),
      ]);
      if (mounted) { setUnread(u || 0); setTotal(tt || 0); }
    };
    refresh();
    const channel = supabase
      .channel("sidebar_msg_count")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, (payload) => {
        refresh();
        if (payload.eventType === "INSERT") {
          const m: any = payload.new;
          sonner(lang === "ar" ? `رسالة جديدة من ${m.name}` : `New message from ${m.name}`);
        }
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [lang]);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const { count } = await (supabase as any).from("notes").select("id", { count: "exact", head: true });
      if (mounted) setNotesTotal(count || 0);
    };
    refresh();
    const ch = supabase
      .channel("sidebar_notes_count")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, refresh)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!user || !session?.access_token) return;
    let mounted = true;
    const token = session.access_token;
    const uid = user.id;
    const refresh = async () => {
      try {
        const [u, tt] = await Promise.all([
          fetchUnreadNotificationsCount(uid, token),
          fetchTotalNotificationsCount(uid, token),
        ]);
        if (mounted) { setNotifUnread(u); setNotifTotal(tt); }
      } catch (e) { console.error("[sidebar notif count]", e); }
    };
    refresh();
    supabase.realtime.setAuth(token);
    const ch = supabase.channel(`sidebar_notif_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user?.id, session?.access_token]);

  const items = [
    { titleKey: "dash.menu.overview", url: "/dashboard", icon: LayoutDashboard, end: true },
    { titleKey: "dash.menu.team", url: "/dashboard/team", icon: Users },
    { titleKey: "dash.menu.messages", url: "/dashboard/messages", icon: Mail, badge: total, hot: unread > 0 },
    { titleKey: "dash.menu.notifications", url: "/dashboard/notifications", icon: Bell, badge: notifTotal, hot: notifUnread > 0 },
    { titleKey: "dash.menu.weather", url: "/dashboard/weather", icon: CloudSun },
    { titleKey: "dash.menu.batteries", url: "/dashboard/batteries", icon: BatteryCharging },
    { titleKey: "dash.menu.inverters", url: "/dashboard/inverters", icon: ArrowRightLeft },
    { titleKey: "dash.menu.realtime", url: "/dashboard/realtime", icon: Activity },
    { titleKey: "dash.menu.reports", url: "/dashboard/reports", icon: FileText },
    { titleKey: "dash.menu.notes", url: "/dashboard/notes", icon: ClipboardList, badge: notesTotal, hot: notesTotal > 0 },
    { titleKey: "dash.menu.assistant", url: "/dashboard/assistant", icon: Bot },
    { titleKey: "dash.menu.settings", url: "/dashboard/settings", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" side={lang === "ar" ? "right" : "left"} className="border-sidebar-border">
      <SidebarHeader className={`border-b border-sidebar-border ${collapsed ? "p-3" : "p-4"}`}>
        <NavLink to="/" className={`flex items-center gap-3 group ${collapsed ? "justify-center" : ""}`}>
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-sidebar-primary/30 blur-lg group-hover:bg-sidebar-primary/50 transition-all" />
            <img src={logoMark} alt="Logo" className="relative h-10 w-10 object-contain drop-shadow-lg" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-black text-sidebar-foreground text-sm tracking-tight">{t("dash.brand")}</span>
              <span className="text-[9px] text-sidebar-foreground/60 uppercase tracking-[0.2em] font-bold">{t("dash.brand.sub")}</span>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className={`py-4 ${collapsed ? "px-2" : "px-2"}`}>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] font-bold text-sidebar-foreground/50 px-3 mb-2">{t("dash.workspace")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className={collapsed ? "gap-2 items-center" : "gap-1"}>
              {items.map(item => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}
                      className={`h-11 rounded-xl font-semibold text-sm transition-all ${collapsed ? "!p-0 !w-10 !h-10 mx-auto justify-center" : ""} ${active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-gold" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                      <NavLink to={item.url} end={item.end} className={`relative flex items-center ${collapsed ? "justify-center w-full h-full" : "gap-3 px-3"}`}>
                        <item.icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="flex-1">{t(item.titleKey)}</span>}
                        {!collapsed && "badge" in item && (item as any).badge > 0 && (
                          <span className={`ms-auto min-w-[20px] h-5 inline-flex items-center justify-center text-[10px] font-black px-1.5 rounded-full ring-2 ring-sidebar shadow-md ${(item as any).hot ? "bg-destructive text-destructive-foreground" : "bg-sidebar-accent text-sidebar-accent-foreground"}`}>
                            {(item as any).badge}
                          </span>
                        )}
                        {collapsed && "badge" in item && (item as any).badge > 0 && (
                          <span className={`absolute top-0.5 right-0.5 min-w-[14px] h-3.5 inline-flex items-center justify-center text-[8px] font-black px-1 rounded-full ring-1 ring-sidebar leading-none ${(item as any).hot ? "bg-destructive text-destructive-foreground" : "bg-sidebar-accent text-sidebar-accent-foreground"}`}>
                            {(item as any).badge}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border ${collapsed ? "p-2" : "p-2"}`}>
        <SidebarMenu className={collapsed ? "items-center" : ""}>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()} className={`h-11 rounded-xl text-sidebar-foreground/70 hover:bg-destructive/15 hover:text-destructive font-semibold ${collapsed ? "!p-0 !w-10 !h-10 mx-auto justify-center" : "px-3"}`}>
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>{t("dash.signout")}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
