import Link from "next/link";
import {
  Boxes,
  DollarSign,
  TrendingDown,
  Landmark,
  CircleCheck,
  ArrowLeftRight,
  CalendarClock,
  TriangleAlert,
  Wrench,
  Coins,
  PackageSearch,
  ShieldAlert,
} from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { STATUS_LABELS } from "@/lib/assets";
import { Card, Stat, SectionTitle } from "@/components/ui/card";
import { Table, Th, Td } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { AreaChart } from "@/components/charts/area-chart";
import { STATUS_COLORS } from "@/components/charts/palette";
import { formatMoney, formatDate } from "@/lib/utils";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKeys(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: `${m.getFullYear()}-${m.getMonth()}`, label: MONTH[m.getMonth()] });
  }
  return out;
}

export default async function DashboardPage() {
  const ctx = await requireContext();
  const orgId = ctx.orgId;
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const days30 = new Date(now.getTime() - 30 * 86_400_000);
  const days90 = new Date(now.getTime() + 90 * 86_400_000);
  const canCreate = can(ctx.permissions, PERMISSIONS.ASSET_CREATE);
  const showFin = can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW) || can(ctx.permissions, PERMISSIONS.ASSET_EDIT);

  const [
    total,
    byStatus,
    valueAgg,
    ytdPurchases,
    overdueCheckouts,
    openMaint,
    maintSpend30,
    upcomingMaint,
    catGroups,
    siteGroups,
    purchaseDates,
    maintByMonthRows,
    stockRows,
    warrExp,
    contrExp,
    polExp,
  ] = await Promise.all([
    db.asset.count({ where: { orgId } }),
    db.asset.groupBy({ by: ["status"], where: { orgId }, _count: true }),
    db.asset.aggregate({ where: { orgId }, _sum: { purchaseCost: true, bookValue: true } }),
    db.asset.count({ where: { orgId, purchaseDate: { gte: yearStart } } }),
    db.checkoutRecord.count({ where: { orgId, checkedInAt: null, dueAt: { lt: now } } }),
    db.maintenanceRecord.count({ where: { orgId, status: { in: ["SCHEDULED", "OVERDUE"] } } }),
    db.maintenanceRecord.aggregate({
      where: { orgId, status: "DONE", completedAt: { gte: days30 } },
      _sum: { cost: true },
    }),
    db.maintenanceRecord.findMany({
      where: { orgId, status: { in: ["SCHEDULED", "OVERDUE"] } },
      orderBy: { dueAt: "asc" },
      take: 6,
      include: { asset: { select: { id: true, name: true, tagId: true } }, schedule: { select: { title: true } } },
    }),
    db.asset.groupBy({ by: ["categoryId"], where: { orgId }, _count: true }),
    db.asset.groupBy({ by: ["siteId"], where: { orgId }, _count: true }),
    db.asset.findMany({ where: { orgId, purchaseDate: { not: null } }, select: { purchaseDate: true } }),
    db.maintenanceRecord.findMany({
      where: { orgId, status: "DONE", completedAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
      select: { completedAt: true, cost: true },
    }),
    db.inventoryStock.findMany({ where: { orgId, reorderPoint: { not: null } }, select: { quantity: true, reorderPoint: true } }),
    db.warranty.count({ where: { orgId, endAt: { gte: now, lte: days90 } } }),
    db.contract.count({ where: { orgId, endAt: { gte: now, lte: days90 } } }),
    db.insurancePolicy.count({ where: { orgId, endAt: { gte: now, lte: days90 } } }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const purchaseValue = Number(valueAgg._sum.purchaseCost ?? 0);
  const bookValue = Number(valueAgg._sum.bookValue ?? 0);
  const lowStock = stockRows.filter((s) => s.reorderPoint != null && s.quantity <= s.reorderPoint).length;
  const coverageExpiring = warrExp + contrExp + polExp;

  // category / site names
  const [cats, sites] = await Promise.all([
    db.category.findMany({ where: { orgId }, select: { id: true, name: true } }),
    db.site.findMany({ where: { orgId }, select: { id: true, name: true } }),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  const categoryData = catGroups
    .map((g) => ({ label: g.categoryId ? catName.get(g.categoryId) ?? "—" : "Uncategorized", value: g._count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const siteData = siteGroups
    .map((g) => ({ label: g.siteId ? siteName.get(g.siteId) ?? "—" : "No site", value: g._count }))
    .sort((a, b) => b.value - a.value);

  const statusData = byStatus
    .map((s) => ({ label: STATUS_LABELS[s.status] ?? s.status, value: s._count, color: STATUS_COLORS[s.status] }))
    .sort((a, b) => b.value - a.value);

  // purchases per month (12)
  const pMonths = monthKeys(12);
  const pBucket = new Map(pMonths.map((m) => [m.key, 0]));
  for (const a of purchaseDates) {
    if (!a.purchaseDate) continue;
    const k = `${a.purchaseDate.getFullYear()}-${a.purchaseDate.getMonth()}`;
    if (pBucket.has(k)) pBucket.set(k, pBucket.get(k)! + 1);
  }
  const purchaseSeries = pMonths.map((m) => ({ label: m.label, value: pBucket.get(m.key) ?? 0 }));

  // maintenance spend per month (6)
  const mMonths = monthKeys(6);
  const mBucket = new Map(mMonths.map((m) => [m.key, 0]));
  for (const r of maintByMonthRows) {
    if (!r.completedAt) continue;
    const k = `${r.completedAt.getFullYear()}-${r.completedAt.getMonth()}`;
    if (mBucket.has(k)) mBucket.set(k, mBucket.get(k)! + Number(r.cost ?? 0));
  }
  const maintSeries = mMonths.map((m) => ({ label: m.label, value: Math.round(mBucket.get(m.key) ?? 0) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Overview of {ctx.orgName}&apos;s assets</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/checkout"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--card)] px-3 text-sm font-medium hover:bg-[var(--surface-2)]"
          >
            <ArrowLeftRight size={15} /> Check out
          </Link>
          {canCreate ? (
            <Link
              href="/assets/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg shadow-[var(--shadow)] hover:bg-brand-dark"
            >
              <Boxes size={15} /> Add asset
            </Link>
          ) : null}
        </div>
      </div>

      {/* KPI row 1 — value */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total assets" value={total} icon={<Boxes size={16} />} hint={`${ytdPurchases} added this year`} />
        <Stat label="Purchase value" value={formatMoney(purchaseValue)} icon={<DollarSign size={16} />} />
        <Stat label="Net book value" value={formatMoney(bookValue)} icon={<Landmark size={16} />} />
        <Stat
          label="Depreciation to date"
          value={formatMoney(Math.max(0, purchaseValue - bookValue))}
          icon={<TrendingDown size={16} />}
        />
      </div>

      {/* KPI row 2 — custody */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available" value={statusMap["AVAILABLE"] ?? 0} icon={<CircleCheck size={16} />} />
        <Stat label="Checked out" value={statusMap["CHECKED_OUT"] ?? 0} icon={<ArrowLeftRight size={16} />} />
        <Stat label="Reserved" value={statusMap["RESERVED"] ?? 0} icon={<CalendarClock size={16} />} />
        <Stat
          label="Overdue checkouts"
          value={overdueCheckouts}
          icon={<TriangleAlert size={16} />}
          accent={overdueCheckouts > 0}
          hint={overdueCheckouts > 0 ? "Needs attention" : "All returned on time"}
        />
      </div>

      {/* KPI row 3 — operations */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open maintenance" value={openMaint} icon={<Wrench size={16} />} />
        <Stat label="Maintenance spend (30d)" value={formatMoney(Number(maintSpend30._sum.cost ?? 0))} icon={<Coins size={16} />} />
        <Stat label="Low-stock items" value={lowStock} icon={<PackageSearch size={16} />} accent={lowStock > 0} />
        <Stat
          label="Coverage expiring (90d)"
          value={coverageExpiring}
          icon={<ShieldAlert size={16} />}
          accent={coverageExpiring > 0}
          hint="Warranties, contracts & policies"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Assets by status</SectionTitle>
          <DonutChart data={statusData} centerValue={total} centerLabel="assets" />
        </Card>
        <Card>
          <SectionTitle>Top categories</SectionTitle>
          <BarChart data={categoryData} emptyText="No categorized assets yet." />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>Assets acquired · last 12 months</SectionTitle>
          <AreaChart data={purchaseSeries} />
        </Card>
        {showFin ? (
          <Card>
            <SectionTitle>Maintenance spend · last 6 months</SectionTitle>
            <AreaChart data={maintSeries} color="#3b82f6" formatValue={(n) => formatMoney(n)} />
          </Card>
        ) : (
          <Card>
            <SectionTitle>Assets by site</SectionTitle>
            <BarChart data={siteData} emptyText="No sites yet." />
          </Card>
        )}
      </div>

      {showFin ? (
        <Card>
          <SectionTitle>Assets by site</SectionTitle>
          <BarChart data={siteData} emptyText="No sites yet." />
        </Card>
      ) : null}

      {/* Maintenance table */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle className="mb-0">Upcoming &amp; overdue maintenance</SectionTitle>
          <Link href="/maintenance" className="text-sm text-brand hover:underline">
            View all
          </Link>
        </div>
        {upcomingMaint.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">Nothing scheduled.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Asset</Th>
                <Th>Task</Th>
                <Th>Due</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {upcomingMaint.map((m) => (
                <tr key={m.id}>
                  <Td>
                    <Link href={`/assets/${m.asset.id}`} className="hover:underline">
                      {m.asset.name}
                    </Link>
                    <span className="ml-1.5 font-mono text-xs text-[var(--muted)]">{m.asset.tagId}</span>
                  </Td>
                  <Td>{m.schedule?.title ?? "Ad-hoc"}</Td>
                  <Td className={m.status === "OVERDUE" ? "text-red-600" : undefined}>{formatDate(m.dueAt)}</Td>
                  <Td>
                    <StatusBadge status={m.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
