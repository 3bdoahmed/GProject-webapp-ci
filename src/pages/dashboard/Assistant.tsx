import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

export default function Assistant() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: t("as.greeting") }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input };
    const next = [...messages, userMsg];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) })
      });
      if (!resp.ok || !resp.body) throw new Error("stream failed");
      const reader = resp.body.getReader(); const dec = new TextDecoder();
      let buf = ""; let acc = ""; let done = false;
      setMessages(p => [...p, { role: "assistant", content: "" }]);
      while (!done) {
        const { done: d, value } = await reader.read(); if (d) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) { acc += c; setMessages(prev => { const x = [...prev]; x[x.length - 1] = { role: "assistant", content: acc }; return x; }); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e: any) {
      setMessages(p => [...p, { role: "assistant", content: t("as.error") + " " + (e.message || "") }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-9rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-black mb-1 flex items-center gap-2"><Bot className="w-7 h-7 text-primary" /> {t("as.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("as.sub")}</p>
      </div>
      <div className="flex-1 glass rounded-2xl p-4 overflow-y-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-accent" : "gradient-hero"}`}>
              {m.role === "user" ? <User className="w-4 h-4 text-accent-foreground" /> : <Bot className="w-4 h-4 text-primary-foreground" />}
            </div>
            <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
              {m.content || <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-4 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder={t("as.placeholder")} disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl bg-background border border-border text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
        <button onClick={send} disabled={loading || !input.trim()}
          className="px-5 rounded-xl gradient-hero text-primary-foreground font-bold flex items-center gap-2 hover:shadow-glow transition-smooth disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
