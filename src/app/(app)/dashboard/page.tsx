import Link from "next/link";
import {
  Boxes,
  CircleCheck,
  ArrowLeftRight,
  TriangleAlert,
  IndianRupee,
  ArrowRight,
  Plus,
  LogIn,
  LogOut,
  PackagePlus,
  Pencil,
  Wrench,
  MoveRight,
  Trash2,
} from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { STATUS_LABELS } from "@/lib/assets";
import { Card, Stat } from "@/components/ui/card";
import { DonutChart } from "@/components/charts/donut-chart";
import { STATUS_COLORS } from "@/components/charts/palette";
import { AssetIcon } from "@/components/asset-icon";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Office-inventory overview: headline numbers, per-type breakdown, status mix,
 * spare devices ready to hand out, departments and recent activity.
 */
export default async function DashboardPage() {
  const ctx = await requireContext();
  const orgId = ctx.orgId;
  const now = new Date();
  const canCreate = can(ctx.permissions, PERMISSIONS.ASSET_CREATE);
  const canCheckout = can(ctx.permissions, PERMISSIONS.CHECKOUT_MANAGE);
  const showMoney = can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW) || can(ctx.permissions, PERMISSIONS.ASSET_EDIT);

  const [byCatStatus, cats, valueAgg, overdue, recent, spares, deptGroups, depts] = await Promise.all([
    db.asset.groupBy({ by: ["categoryId", "status"], where: { orgId }, _count: true }),
    db.category.findMany({ where: { orgId }, select: { id: true, name: true } }),
    db.asset.aggregate({ where: { orgId, status: { notIn: ["DISPOSED", "LOST"] } }, _sum: { purchaseCost: true } }),
    db.checkoutRecord.count({ where: { orgId, checkedInAt: null, dueAt: { lt: now } } }),
    db.assetEvent.findMany({
      where: { asset: { orgId } },
      orderBy: { at: "desc" },
      take: 7,
      include: { asset: { select: { id: true, tagId: true, name: true } } },
    }),
    db.asset.findMany({
      where: { orgId, status: "AVAILABLE" },
      orderBy: { tagId: "asc" },
      take: 6,
      select: {
        id: true,
        tagId: true,
        name: true,
        category: { select: { name: true } },
        fieldValues: {
          where: { fieldDef: { key: { in: ["brand", "model", "ram", "storage"] } } },
          select: { valueText: true, fieldDef: { select: { key: true } } },
        },
      },
    }),
    db.asset.groupBy({
      by: ["departmentId"],
      where: { orgId, status: { notIn: ["DISPOSED"] }, departmentId: { not: null } },
      _count: true,
      orderBy: { _count: { departmentId: "desc" } },
      take: 6,
    }),
    db.department.findMany({ where: { orgId }, select: { id: true, name: true } }),
  ]);

  /* ── aggregate by type ─────────────────────────────── */
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  type Row = { id: string; name: string; total: number; out: number; available: number; attention: number };
  const rows = new Map<string, Row>();
  const totals = { total: 0, out: 0, available: 0, attention: 0 };
  const statusCount: Record<string, number> = {};
  for (const g of byCatStatus) {
    statusCount[g.status] = (statusCount[g.status] ?? 0) + g._count;
    if (g.status === "DISPOSED") continue;
    const key = g.categoryId ?? "";
    const row = rows.get(key) ?? {
      id: key,
      name: g.categoryId ? catName.get(g.categoryId) ?? "—" : "Uncategorized",
      total: 0,
      out: 0,
      available: 0,
      attention: 0,
    };
    const bucket =
      g.status === "CHECKED_OUT" || g.status === "LEASED"
        ? "out"
        : g.status === "AVAILABLE" || g.status === "RESERVED"
          ? "available"
          : "attention"; // LOST, UNDER_REPAIR
    row[bucket] += g._count;
    row.total += g._count;
    totals[bucket] += g._count;
    totals.total += g._count;
    rows.set(key, row);
  }
  const typeRows = [...rows.values()].sort((a, b) => b.total - a.total);
  const utilisation = totals.total ? Math.round((totals.out / totals.total) * 100) : 0;
  const statusData = Object.entries(statusCount)
    .filter(([s]) => s !== "DISPOSED")
    .map(([s, n]) => ({ label: STATUS_LABELS[s] ?? s, value: n, color: STATUS_COLORS[s] }))
    .sort((a, b) => b.value - a.value);

  const deptName = new Map(depts.map((d) => [d.id, d.name]));
  const deptRows = deptGroups.map((g) => ({ id: g.departmentId!, name: deptName.get(g.departmentId!) ?? "—", n: g._count }));
  const deptMax = Math.max(1, ...deptRows.map((d) => d.n));

  const assetsLink = (categoryId: string, status?: string) => {
    const p = new URLSearchParams();
    if (categoryId) p.set("category", categoryId);
    if (status) p.set("status", status);
    return `/assets?${p.toString()}`;
  };

  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(now);
  const firstName = (ctx.name ?? ctx.email).split(/[\s@]/)[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {greeting}, {firstName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {totals.total} devices across {typeRows.length} types · {utilisation}% in use
          </p>
        </div>
        <div className="flex gap-2">
          {canCheckout ? (
            <Link
              href="/checkout"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-4 text-sm font-medium shadow-[var(--shadow)] transition hover:bg-[var(--surface-2)]"
            >
              <ArrowLeftRight size={16} /> Check out / in
            </Link>
          ) : null}
          {canCreate ? (
            <Link
              href="/assets/new"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-brand-fg shadow-[var(--shadow)] transition hover:bg-brand-dark sm:hidden"
            >
              <Plus size={16} /> Add
            </Link>
          ) : null}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Link href="/assets" className="block">
          <Stat
            label="Total devices"
            value={totals.total}
            icon={<Boxes size={18} />}
            tone="brand"
            hint={showMoney ? <>Worth {formatMoney(Number(valueAgg._sum.purchaseCost ?? 0))}</> : undefined}
          />
        </Link>
        <Link href="/assets?status=CHECKED_OUT" className="block">
          <Stat
            label="With people"
            value={totals.out}
            icon={<ArrowLeftRight size={18} />}
            tone="blue"
            progress={utilisation}
            hint={`${utilisation}% of devices in use`}
          />
        </Link>
        <Link href="/assets?status=AVAILABLE" className="block">
          <Stat
            label="Spare & ready"
            value={totals.available}
            icon={<CircleCheck size={18} />}
            tone="green"
            progress={totals.total ? (totals.available / totals.total) * 100 : 0}
            hint="Available to hand out"
          />
        </Link>
        <Link href="/assets?status=LOST" className="block">
          <Stat
            label="Needs attention"
            value={totals.attention + overdue}
            icon={<TriangleAlert size={18} />}
            tone={totals.attention + overdue > 0 ? "red" : "slate"}
            hint={
              <>
                {statusCount.LOST ?? 0} lost · {statusCount.UNDER_REPAIR ?? 0} in repair
                {overdue > 0 ? ` · ${overdue} overdue` : ""}
              </>
            }
          />
        </Link>
      </div>

      {/* Types + status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-2">
          <PanelHeader title="Devices by type" subtitle="Click a type or number to see those devices" />
          <div className="divide-y divide-[var(--border)]">
            {typeRows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">No assets yet.</p>
            ) : (
              typeRows.map((r) => (
                <div key={r.id || "none"} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[auto_9rem_1fr_12.5rem]">
                  <AssetIcon type={r.name} />
                  <Link href={assetsLink(r.id)} className="min-w-0 hover:underline">
                    <div className="truncate font-medium">{r.name}</div>
                    <div className="text-xs text-[var(--muted)]">{r.total} total</div>
                  </Link>
                  <div className="col-span-2 flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)] sm:col-span-1">
                    <Seg n={r.out} total={r.total} className="bg-sky-500" title="With people" />
                    <Seg n={r.available} total={r.total} className="bg-emerald-500" title="Spare" />
                    <Seg n={r.attention} total={r.total} className="bg-red-500" title="Lost / repair" />
                  </div>
                  <div className="col-span-2 flex gap-3 text-xs tabular-nums sm:col-span-1 sm:justify-end">
                    <Link href={assetsLink(r.id, "CHECKED_OUT")} className="text-sky-700 hover:underline dark:text-sky-300">
                      {r.out} in use
                    </Link>
                    <Link
                      href={assetsLink(r.id, "AVAILABLE")}
                      className={cn("hover:underline", r.available ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-[var(--muted)]")}
                    >
                      {r.available} spare
                    </Link>
                    {r.attention ? <span className="text-red-600 dark:text-red-400">{r.attention} issue</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-4 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">
            <Legend className="bg-sky-500">With people</Legend>
            <Legend className="bg-emerald-500">Spare</Legend>
            <Legend className="bg-red-500">Lost / in repair</Legend>
          </div>
        </Card>

        <Card className="p-0">
          <PanelHeader title="Status" subtitle="All devices on hand" />
          <div className="px-5 pb-5">
            <DonutChart data={statusData} centerValue={totals.total} centerLabel="devices" size={176} />
          </div>
        </Card>
      </div>

      {/* Spares, departments, activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-0">
          <PanelHeader
            title="Ready to hand out"
            subtitle={`${totals.available} spare device${totals.available === 1 ? "" : "s"}`}
            href="/assets?status=AVAILABLE"
          />
          {spares.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-[var(--muted)]">No spare devices right now.</p>
          ) : (
            <ul className="px-2 pb-2">
              {spares.map((a) => {
                const fv = (k: string) => a.fieldValues.find((v) => v.fieldDef.key === k)?.valueText;
                const spec = [fv("brand"), fv("ram"), fv("storage")].filter(Boolean).join(" · ");
                return (
                  <li key={a.id}>
                    <Link href={`/assets/${a.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--surface-2)]">
                      <AssetIcon type={a.category?.name} name={a.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.name}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">{spec || a.category?.name || "—"}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[var(--muted)]">{a.tagId}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-0">
          <PanelHeader title="Top departments" subtitle="Devices per team" />
          <ul className="space-y-3 px-5 pb-5">
            {deptRows.map((d) => (
              <li key={d.id}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{d.name}</span>
                  <span className="tabular-nums text-[var(--muted)]">{d.n}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full bg-brand/80" style={{ width: `${(d.n / deptMax) * 100}%` }} />
                </div>
              </li>
            ))}
            {deptRows.length === 0 ? <li className="text-sm text-[var(--muted)]">No departments yet.</li> : null}
          </ul>
        </Card>

        <Card className="p-0">
          <PanelHeader title="Recent activity" href={can(ctx.permissions, PERMISSIONS.ACTIVITY_VIEW) ? "/activity" : undefined} />
          {recent.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-[var(--muted)]">Nothing yet.</p>
          ) : (
            <ol className="relative mx-5 mb-5 border-l border-[var(--border)]">
              {recent.map((e) => {
                const { icon: Icon, tone } = eventStyle(e.type);
                return (
                  <li key={e.id} className="relative mb-4 pl-6 last:mb-0">
                    <span className={cn("absolute -left-[13px] top-0 grid h-6 w-6 place-items-center rounded-full ring-4 ring-[var(--card)]", tone)}>
                      <Icon size={12} />
                    </span>
                    <Link href={`/assets/${e.asset.id}`} className="text-sm font-medium hover:underline">
                      {e.asset.name} <span className="font-mono text-[11px] font-normal text-[var(--muted)]">{e.asset.tagId}</span>
                    </Link>
                    <div className="text-xs text-[var(--muted)]">
                      {e.summary} · {relativeTime(e.at, now)}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

function PanelHeader({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          View all <ArrowRight size={12} />
        </Link>
      ) : null}
    </div>
  );
}

function Seg({ n, total, className, title }: { n: number; total: number; className: string; title: string }) {
  if (!n || !total) return null;
  return <div className={cn("h-full first:rounded-l-full last:rounded-r-full", className)} style={{ width: `${(n / total) * 100}%` }} title={`${title}: ${n}`} />;
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", className)} />
      {children}
    </span>
  );
}

function eventStyle(type: string) {
  switch (type) {
    case "CHECKED_OUT":
      return { icon: LogOut, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" };
    case "CHECKED_IN":
      return { icon: LogIn, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" };
    case "CREATED":
      return { icon: PackagePlus, tone: "bg-brand/10 text-brand" };
    case "MOVED":
      return { icon: MoveRight, tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" };
    case "MAINTENANCE":
      return { icon: Wrench, tone: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" };
    case "DISPOSED":
      return { icon: Trash2, tone: "bg-slate-200 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" };
    default:
      return { icon: Pencil, tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" };
  }
}

function relativeTime(d: Date, now: Date): string {
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
