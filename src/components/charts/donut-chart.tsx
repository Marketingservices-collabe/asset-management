import { colorAt } from "./palette";

export type DonutDatum = { label: string; value: number; color?: string };

/** Donut chart with legend. Pure SVG, server-renderable. */
export function DonutChart({
  data,
  centerValue,
  centerLabel,
  size = 168,
}: {
  data: DonutDatum[];
  centerValue?: string | number;
  centerLabel?: string;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;

  let offset = 0;
  const segments = total
    ? data
        .filter((d) => d.value > 0)
        .map((d, i) => {
          const frac = d.value / total;
          const seg = { d, color: d.color ?? colorAt(i), dash: frac * c, offset };
          offset += frac * c;
          return seg;
        })
    : [];

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${c - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cx})`}
            strokeLinecap="butt"
          />
        ))}
        {centerValue !== undefined ? (
          <text x={cx} y={cx - 2} textAnchor="middle" className="fill-[var(--fg)]" style={{ fontSize: 22, fontWeight: 600 }}>
            {centerValue}
          </text>
        ) : null}
        {centerLabel ? (
          <text x={cx} y={cx + 16} textAnchor="middle" className="fill-[var(--muted)]" style={{ fontSize: 11 }}>
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color ?? colorAt(i) }} />
            <span className="text-[var(--muted)]">{d.label}</span>
            <span className="ml-auto tabular-nums font-medium">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
