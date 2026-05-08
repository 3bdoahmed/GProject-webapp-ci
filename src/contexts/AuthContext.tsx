import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, meta?: Record<string, any>) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

const g = globalThis as any;
if (!g.__authCache) g.__authCache = { session: null as Session | null, hydrated: false };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(g.__authCache.session);
  const [user, setUser] = useState<User | null>(g.__authCache.session?.user ?? null);
  const [loading, setLoading] = useState(!g.__authCache.hydrated);
  const manualSignOutRef = useRef(false);

  useEffect(() => {
    let alive = true;

    const apply = (s: Session | null) => {
      if (!alive) return;
      g.__authCache.session = s;
      g.__authCache.hydrated = true;
      setSession(prev => {
        // Skip update if access_token unchanged to avoid re-renders / effect loops
        if (prev?.access_token === s?.access_token && prev?.user?.id === s?.user?.id) return prev;
        return s;
      });
      setUser(prev => {
        if (prev?.id === s?.user?.id) return prev;
        return s?.user ?? null;
      });
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        // Only honor explicit signout. Ignore spurious sign-outs from refresh failures / 429.
        if (manualSignOutRef.current) {
          manualSignOutRef.current = false;
          apply(null);
        }
        return;
      }
      // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION
      if (s) apply(s);
    });

    if (!g.__authCache.hydrated) {
      supabase.auth.getSession()
        .then(({ data: { session: s } }) => apply(s))
        .catch(() => { if (alive) setLoading(false); });
    } else {
      setLoading(false);
    }

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthCtx = {
    user, session, loading,
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (data.session) {
        g.__authCache.session = data.session;
        g.__authCache.hydrated = true;
        setSession(data.session);
        setUser(data.session.user);
        setLoading(false);
      }
      return { error };
    },
    signUp: async (email, password, meta) => {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: meta,
        },
      });
      return { error };
    },
    signOut: async () => {
      manualSignOutRef.current = true;
      await supabase.auth.signOut();
      g.__authCache.session = null;
      setSession(null);
      setUser(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
