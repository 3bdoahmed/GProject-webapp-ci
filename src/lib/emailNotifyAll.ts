import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget: emails every approved dashboard member with the
 * notification details via the `notify-new-message` edge function.
 */
export function emailNotifyAll(opts: {
  name?: string;
  email?: string;
  title: string;
  body?: string | null;
  kind?: string;
}) {
  const message = `${opts.title}${opts.body ? `\n\n${opts.body}` : ""}`;
  supabase.functions
    .invoke("notify-new-message", {
      body: {
        name: opts.name || "Smart Solar System",
        email: opts.email || "system@smart-solar.local",
        message,
        kind: opts.kind || "notification",
      },
    })
    .catch(() => {});
}