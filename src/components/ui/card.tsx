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

export function Stat({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <CardTitle>{label}</CardTitle>
        {icon ? (
          <span className={cn("text-[var(--muted)]", accent && "text-brand")}>{icon}</span>
        ) : null}
      </div>
      <div className={cn("mt-1.5 text-2xl font-semibold tracking-tight", accent && "text-brand")}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
    </Card>
  );
}
