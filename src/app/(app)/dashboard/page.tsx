import Link from "next/link";
import { Boxes, CircleCheck, ArrowLeftRight, TriangleAlert, IndianRupee } from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { Card, Stat, SectionTitle } from "@/components/ui/card";
import { Table, Th, Td } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/utils";

/**
 * Simple office-inventory overview: how many devices, who has them, how many
 * spares of each type, and what needs attention.
 */
export default async function DashboardPage() {
  const ctx = await requireContext();
  const orgId = ctx.orgId;
  const now = new Date();
  const canCreate = can(ctx.permissions, PERMISSIONS.ASSET_CREATE);
  const canCheckout = can(ctx.permissions, PERMISSIONS.CHECKOUT_MANAGE);
  const showMoney = can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW) || can(ctx.permissions, PERMISSIONS.ASSET_EDIT);

  const [byCatStatus, cats, valueAgg, overdue, recent] = await Promise.all([
    db.asset.groupBy({ by: ["categoryId", "status"], where: { orgId }, _count: true }),
    db.category.findMany({ where: { orgId }, select: { id: true, name: true } }),
    db.asset.aggregate({ where: { orgId, status: { notIn: ["DISPOSED", "LOST"] } }, _sum: { purchaseCost: true } }),
    db.checkoutRecord.count({ where: { orgId, checkedInAt: null, dueAt: { lt: now } } }),
    db.assetEvent.findMany({
      where: { asset: { orgId } },
      orderBy: { at: "desc" },
      take: 8,
      include: { asset: { select: { id: true, tagId: true, name: true } } },
    }),
  ]);

  const catName = new Map(cats.map((c) => [c.id, c.name]));
  type Row = { id: string; name: string; total: number; out: number; available: number; attention: number; gone: number };
  const rows = new Map<string, Row>();
  const totals = { total: 0, out: 0, available: 0, attention: 0, gone: 0 };
  for (const g of byCatStatus) {
    const key = g.categoryId ?? "";
    const row =
      rows.get(key) ??
      { id: key, name: g.categoryId ? catName.get(g.categoryId) ?? "—" : "Uncategorized", total: 0, out: 0, available: 0, attention: 0, gone: 0 };
    const n = g._count;
    if (g.status === "DISPOSED") {
      row.gone += n;
      totals.gone += n;
    } else {
      row.total += n;
      totals.total += n;
      const bucket =
        g.status === "CHECKED_OUT" || g.status === "LEASED"
          ? "out"
          : g.status === "AVAILABLE" || g.status === "RESERVED"
            ? "available"
            : "attention"; // LOST, UNDER_REPAIR
      row[bucket] += n;
      totals[bucket] += n;
    }
    rows.set(key, row);
  }
  const typeRows = [...rows.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const link = (categoryId: string, status?: string) => {
    const p = new URLSearchParams();
    if (categoryId) p.set("category", categoryId);
    if (status) p.set("status", status);
    return `/assets?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{ctx.orgName} office devices at a glance</p>
        </div>
        <div className="flex gap-2">
          {canCheckout ? (
            <Link
              href="/checkout"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--card)] px-3 text-sm font-medium hover:bg-[var(--surface-2)]"
            >
              <ArrowLeftRight size={15} /> Check out / in
            </Link>
          ) : null}
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

      <div className={`grid gap-3 sm:grid-cols-2 ${showMoney ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <Link href="/assets">
          <Stat label="Total devices" value={totals.total} icon={<Boxes size={16} />} />
        </Link>
        <Link href="/assets?status=CHECKED_OUT">
          <Stat label="With people" value={totals.out} icon={<ArrowLeftRight size={16} />} hint="Checked out" />
        </Link>
        <Link href="/assets?status=AVAILABLE">
          <Stat label="Spare (available)" value={totals.available} icon={<CircleCheck size={16} />} />
        </Link>
        <Stat
          label="Needs attention"
          value={totals.attention + overdue}
          icon={<TriangleAlert size={16} />}
          accent={totals.attention + overdue > 0}
          hint={overdue > 0 ? `Lost, in repair or ${overdue} overdue` : "Lost or in repair"}
        />
        {showMoney ? (
          <Stat label="Total value" value={formatMoney(Number(valueAgg._sum.purchaseCost ?? 0))} icon={<IndianRupee size={16} />} hint="Purchase cost of devices on hand" />
        ) : null}
      </div>

      <Card>
        <SectionTitle>Devices by type</SectionTitle>
        {typeRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">No assets yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">With people</Th>
                <Th className="text-right">Spare</Th>
                <Th className="text-right">Lost / repair</Th>
              </tr>
            </thead>
            <tbody>
              {typeRows.map((r) => (
                <tr key={r.id || "none"}>
                  <Td>
                    <Link href={link(r.id)} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                  </Td>
                  <Td className="text-right tabular-nums">{r.total}</Td>
                  <Td className="text-right tabular-nums">
                    <Link href={link(r.id, "CHECKED_OUT")} className="hover:underline">{r.out}</Link>
                  </Td>
                  <Td className="text-right tabular-nums">
                    <Link href={link(r.id, "AVAILABLE")} className={r.available > 0 ? "font-semibold text-emerald-600 hover:underline" : "hover:underline"}>
                      {r.available}
                    </Link>
                  </Td>
                  <Td className={`text-right tabular-nums ${r.attention > 0 ? "text-red-600" : ""}`}>{r.attention}</Td>
                </tr>
              ))}
              <tr className="font-semibold">
                <Td>All types</Td>
                <Td className="text-right tabular-nums">{totals.total}</Td>
                <Td className="text-right tabular-nums">{totals.out}</Td>
                <Td className="text-right tabular-nums">{totals.available}</Td>
                <Td className="text-right tabular-nums">{totals.attention}</Td>
              </tr>
            </tbody>
          </Table>
        )}
        {totals.gone > 0 ? (
          <p className="mt-2 text-xs text-[var(--muted)]">{totals.gone} disposed device(s) not counted.</p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Recent activity</SectionTitle>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <Link href={`/assets/${e.asset.id}`} className="font-medium hover:underline">
                    {e.asset.name}
                  </Link>
                  <span className="ml-1.5 font-mono text-xs text-[var(--muted)]">{e.asset.tagId}</span>
                  <span className="ml-2 text-[var(--muted)]">{e.summary}</span>
                </span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{formatDate(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
