import { colorAt } from "./palette";

export type BarDatum = { label: string; value: number; color?: string; href?: string };

/** Horizontal bar chart — pure SVG-free markup (flex bars), server-renderable. */
export function BarChart({
  data,
  formatValue = (n) => n.toLocaleString("en-US"),
  emptyText = "No data",
}: {
  data: BarDatum[];
  formatValue?: (n: number) => string;
  emptyText?: string;
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--muted)]">{emptyText}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = Math.max(2, (d.value / max) * 100);
        return (
          <div key={d.label} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-[var(--muted)]" title={d.label}>
              {d.label}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${pct}%`, background: d.color ?? colorAt(i) }}
              />
            </span>
            <span className="tabular-nums font-medium">{formatValue(d.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
