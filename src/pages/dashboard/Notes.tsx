import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, Plus, Trash2, Tag, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { CardSkeleton } from "@/components/ui/spinner";
import { emailNotifyAll } from "@/lib/emailNotifyAll";

type Note = {
  id: string;
  user_id: string;
  author_name: string | null;
  title: string;
  content: string;
  category: string;
  created_at: string;
};

const CATEGORIES = ["general", "maintenance", "incident", "task", "idea"] as const;
type Category = typeof CATEGORIES[number];

const catColor: Record<string, string> = {
  general: "bg-primary/15 text-primary border-primary/30",
  maintenance: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  incident: "bg-destructive/15 text-destructive border-destructive/30",
  task: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  idea: "bg-violet-500/15 text-violet-500 border-violet-500/30",
};

export default function Notes() {
  const { t, lang } = useLanguage();
  const { user, session, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => setAuthorName(data?.full_name || user.email || ""));
  }, [user]);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from("notes").select("*").order("created_at", { ascending: false });
    if (error) console.error("[notes] load", error);
    setNotes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading || !user || !session?.access_token) return;
    load();
    supabase.realtime.setAuth(session.access_token);
    const ch = supabase.channel("notes_page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes" }, (p) => {
        const n = p.new as Note;
        setNotes(prev => [n, ...prev.filter(x => x.id !== n.id)]);
        if (n.user_id !== user.id) {
          toast(lang === "ar" ? `ملاحظة جديدة من ${n.author_name || "زميل"}` : `New note from ${n.author_name || "teammate"}`, { description: n.title });
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notes" }, (p) => {
        setNotes(prev => prev.filter(x => x.id !== (p.old as Note).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, session?.access_token, authLoading, load, lang]);

  const submit = async () => {
    if (!user || !title.trim() || !content.trim()) {
      toast.error(lang === "ar" ? "اكتب عنوان ومحتوى" : "Title and content are required");
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from("notes").insert({
      user_id: user.id,
      author_name: authorName || user.email,
      title: title.trim(),
      content: content.trim(),
      category,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    emailNotifyAll({
      name: authorName || user.email || "Team member",
      email: user.email || undefined,
      title: title.trim(),
      body: content.trim(),
      kind: "note",
    });
    setTitle(""); setContent(""); setCategory("general");
    toast.success(lang === "ar" ? "تم نشر الملاحظة" : "Note published");
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("notes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const shown = filter === "all" ? notes : notes.filter(n => n.category === filter);

  const timeAgo = (iso: string) => {
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return lang === "ar" ? "الآن" : "just now";
    if (d < 3600) return `${Math.floor(d/60)}${lang === "ar" ? " د" : "m"}`;
    if (d < 86400) return `${Math.floor(d/3600)}${lang === "ar" ? " س" : "h"}`;
    return `${Math.floor(d/86400)}${lang === "ar" ? " ي" : "d"}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" /> {t("notes.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("notes.sub")}</p>
      </div>

      {/* Composer */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-border space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UserIcon className="w-3.5 h-3.5" /> <span className="font-bold text-foreground">{authorName || "—"}</span>
        </div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t("notes.title.ph")}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm font-bold focus:ring-2 focus:ring-ring focus:outline-none"
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={t("notes.content.ph")}
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:ring-2 focus:ring-ring focus:outline-none resize-y"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${category === c ? catColor[c] : "border-border text-muted-foreground hover:text-foreground"}`}>
                {t(`notes.cat.${c}`)}
              </button>
            ))}
          </div>
          <button onClick={submit} disabled={submitting}
            className="ms-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-hero text-primary-foreground font-bold text-sm hover:shadow-glow transition-smooth disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t("notes.publish")}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(["all", ...CATEGORIES] as const).map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all ${filter === k ? "gradient-hero text-primary-foreground shadow-glow" : "glass-card text-muted-foreground hover:text-foreground"}`}>
            {k === "all" ? t("notes.filter.all") : t(`notes.cat.${k}`)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : shown.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("notes.empty")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <AnimatePresence>
            {shown.map(n => (
              <motion.div key={n.id} layout
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl p-4 bg-card border-2 border-border hover:border-primary/40 hover:shadow-glow transition-all flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-sm truncate">{n.title}</h3>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <UserIcon className="w-3 h-3" /> {n.author_name || "—"} · {timeAgo(n.created_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catColor[n.category] || catColor.general} flex items-center gap-1`}>
                    <Tag className="w-2.5 h-2.5" /> {t(`notes.cat.${n.category}`)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words text-foreground/90">{n.content}</p>
                {user?.id === n.user_id && (
                  <button onClick={() => remove(n.id)}
                    className="self-end text-[11px] font-bold px-3 py-1.5 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all flex items-center gap-1.5">
                    <Trash2 className="w-3 h-3" /> {t("msg.delete")}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}