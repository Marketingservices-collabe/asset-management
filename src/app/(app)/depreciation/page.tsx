import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatMoney, formatDate } from "@/lib/utils";
import { monthsElapsed } from "@/lib/assets";
import { buildSchedule, type DepMethod } from "@/lib/depreciation";
import { PageHeader } from "@/components/page-header";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { runCloseNow } from "./actions";

const METHOD_LABELS: Record<string, string> = {
  STRAIGHT_LINE: "Straight line",
  DECLINING_BALANCE_200: "Declining 200%",
  DECLINING_BALANCE_150: "Declining 150%",
  SUM_OF_YEARS_DIGITS: "Sum of years",
  NONE: "None",
};

export default async function DepreciationPage() {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW)) redirect("/dashboard");
  const canManage = can(ctx.permissions, PERMISSIONS.FINANCIALS_MANAGE);

  const [assets, recentEntries] = await Promise.all([
    db.asset.findMany({
      where: { orgId: ctx.orgId, purchaseCost: { not: null } },
      orderBy: { tagId: "asc" },
      select: {
        id: true,
        tagId: true,
        name: true,
        purchaseCost: true,
        salvageValue: true,
        usefulLifeMonths: true,
        depreciationMethod: true,
        depreciationStart: true,
        purchaseDate: true,
        bookValue: true,
      },
    }),
    db.depreciationEntry.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { periodEnd: "desc" },
      take: 20,
      include: { asset: { select: { id: true, tagId: true, name: true } } },
    }),
  ]);

  let totalCost = 0;
  let totalBook = 0;
  const rows = assets.map((a) => {
    const cost = Number(a.purchaseCost);
    totalCost += cost;
    const depreciable = a.depreciationMethod !== "NONE" && a.usefulLifeMonths;
    let book = cost;
    let accum = 0;
    let elapsed = 0;
    if (depreciable) {
      const schedule = buildSchedule({
        cost,
        salvage: a.salvageValue ? Number(a.salvageValue) : 0,
        usefulLifeMonths: a.usefulLifeMonths!,
        method: a.depreciationMethod as DepMethod,
      });
      elapsed = monthsElapsed(a.depreciationStart ?? a.purchaseDate);
      if (schedule.length > 0 && elapsed > 0) {
        const r = schedule[Math.min(elapsed, schedule.length) - 1];
        book = r.bookValue;
        accum = r.accumulated;
      }
    }
    totalBook += book;
    return { a, book, accum, elapsed, depreciable: !!depreciable };
  });

  const totalAccum = totalCost - totalBook;

  return (
    <>
      <PageHeader title="Depreciation" description="Net book value and monthly close." />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total cost" value={formatMoney(totalCost)} />
        <Stat label="Accumulated depreciation" value={formatMoney(totalAccum)} />
        <Stat label="Net book value" value={formatMoney(totalBook)} />
      </div>

      {canManage ? (
        <form action={runCloseNow} className="mb-6">
          <Button size="sm">Run month-close now</Button>
          <span className="ml-2 text-xs text-[var(--muted)]">
            Backfills missing periods and refreshes book values. Also runs from{" "}
            <code>/api/cron/depreciation</code> monthly.
          </span>
        </form>
      ) : null}

      <SectionTitle>Assets</SectionTitle>
      <Table>
        <thead>
          <tr>
            <Th>Tag</Th>
            <Th>Name</Th>
            <Th>Method</Th>
            <Th className="text-right">Cost</Th>
            <Th className="text-right">Life (mo)</Th>
            <Th className="text-right">Elapsed</Th>
            <Th className="text-right">Accum.</Th>
            <Th className="text-right">Book value</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8}>No assets with a purchase cost yet.</EmptyRow>
          ) : (
            rows.map(({ a, book, accum, elapsed, depreciable }) => (
              <TrLink key={a.id}>
                <Td className="font-mono text-xs">
                  <Link href={`/assets/${a.id}`} className="text-brand hover:underline">
                    {a.tagId}
                  </Link>
                </Td>
                <Td>{a.name}</Td>
                <Td>{METHOD_LABELS[a.depreciationMethod] ?? a.depreciationMethod}</Td>
                <Td className="text-right tabular-nums">{formatMoney(Number(a.purchaseCost))}</Td>
                <Td className="text-right tabular-nums">{a.usefulLifeMonths ?? "—"}</Td>
                <Td className="text-right tabular-nums">{depreciable ? elapsed : "—"}</Td>
                <Td className="text-right tabular-nums">{depreciable ? formatMoney(accum) : "—"}</Td>
                <Td className="text-right tabular-nums">{formatMoney(book)}</Td>
              </TrLink>
            ))
          )}
        </tbody>
      </Table>

      <div className="mt-8">
        <SectionTitle>Recent close entries</SectionTitle>
        <Table>
          <thead>
            <tr>
              <Th>Period</Th>
              <Th>Asset</Th>
              <Th className="text-right">Depreciation</Th>
              <Th className="text-right">Book value</Th>
            </tr>
          </thead>
          <tbody>
            {recentEntries.length === 0 ? (
              <EmptyRow colSpan={4}>No close has run yet.</EmptyRow>
            ) : (
              recentEntries.map((e) => (
                <TrLink key={e.id}>
                  <Td>{formatDate(e.periodEnd)}</Td>
                  <Td>
                    <Link href={`/assets/${e.asset.id}`} className="hover:underline">
                      {e.asset.name}
                    </Link>
                    <span className="ml-1.5 font-mono text-xs text-[var(--muted)]">{e.asset.tagId}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(Number(e.amount))}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(Number(e.bookValue))}</Td>
                </TrLink>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </>
  );
}
