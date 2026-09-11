export type SeriesPoint = { label: string; value: number };

/** Area + line chart for a monthly time series. Pure SVG, server-renderable. */
export function AreaChart({
  data,
  formatValue = (n) => n.toLocaleString("en-US"),
  height = 160,
  color = "#ee5566",
}: {
  data: SeriesPoint[];
  formatValue?: (n: number) => string;
  height?: number;
  color?: string;
}) {
  const w = 640;
  const h = height;
  const padX = 8;
  const padY = 16;
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;

  const x = (i: number) => padX + (i / Math.max(1, n - 1)) * (w - padX * 2);
  const y = (v: number) => h - padY - (v / max) * (h - padY * 2);

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(n - 1).toFixed(1)} ${h - padY} L ${x(0).toFixed(1)} ${h - padY} Z`;
  const gid = `area-${color.replace("#", "")}`;

  const peak = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="var(--border)" strokeWidth={1} />
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {n > 0 ? <circle cx={x(peak)} cy={y(data[peak].value)} r={3} fill={color} /> : null}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]">
        {data.map((d, i) => (
          <span key={i} className={i % 2 === 0 || n <= 6 ? "" : "opacity-0"}>
            {d.label}
          </span>
        ))}
      </div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">
        Peak {data[peak]?.label}: <span className="font-medium text-[var(--fg)]">{formatValue(data[peak]?.value ?? 0)}</span>
      </div>
    </div>
  );
}
