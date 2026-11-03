import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-xs font-medium uppercase tracking-wide text-[var(--muted)]", className)}
      {...props}
    />
  );
}

export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("mb-3 text-sm font-semibold", className)} {...props} />;
}

const TILE: Record<string, string> = {
  brand: "bg-brand/10 text-brand",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

const BAR: Record<string, string> = {
  brand: "bg-brand",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
};

/** KPI card: coloured icon tile, big number, optional hint and progress bar (0–100). */
export function Stat({
  label,
  value,
  hint,
  icon,
  accent,
  tone = "slate",
  progress,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
  tone?: keyof typeof TILE;
  progress?: number;
}) {
  const t = accent ? "red" : tone;
  return (
    <Card className="group relative h-full overflow-hidden p-4 transition-shadow hover:shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-3">
        {icon ? <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TILE[t])}>{icon}</span> : null}
        <div className="min-w-0 text-[13px] font-medium text-[var(--muted)]">{label}</div>
      </div>
      <div className={cn("mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums", accent && "text-red-600 dark:text-red-400")}>
        {value}
      </div>
      {progress != null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div className={cn("h-full rounded-full", BAR[t])} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
      {hint ? <div className="mt-2 text-xs text-[var(--muted)]">{hint}</div> : null}
    </Card>
  );
}
