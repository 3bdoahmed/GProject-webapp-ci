import { cn } from "@/lib/utils";

export function Spinner({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <span className={cn("relative inline-flex", className)} style={{ width: size, height: size }} aria-label="loading">
      <span className="absolute inset-0 rounded-full border-2 border-primary/15" />
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary animate-spin" />
      <span className="absolute inset-1 rounded-full bg-primary/10 blur-sm animate-pulse" />
    </span>
  );
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Spinner size={44} />
      {label && <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</p>}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-5 border border-border/40 overflow-hidden relative">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-primary/5 to-transparent" />
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-muted/60" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-muted/60" />
              <div className="h-2.5 w-1/4 rounded bg-muted/40" />
              <div className="h-2.5 w-full rounded bg-muted/30 mt-3" />
              <div className="h-2.5 w-2/3 rounded bg-muted/30" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
