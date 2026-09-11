import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildSchedule, type DepMethod } from "@/lib/depreciation";
import { monthsElapsed } from "@/lib/assets";

/**
 * Month-close: for every depreciable asset, backfill missing DepreciationEntry rows
 * up to the current period and refresh Asset.bookValue. Idempotent.
 */
export async function runDepreciationClose(): Promise<{ assets: number; entries: number }> {
  const assets = await db.asset.findMany({
    where: {
      purchaseCost: { not: null },
      depreciationMethod: { not: "NONE" },
      usefulLifeMonths: { not: null },
    },
    select: {
      id: true,
      orgId: true,
      purchaseCost: true,
      salvageValue: true,
      usefulLifeMonths: true,
      depreciationMethod: true,
      depreciationStart: true,
      purchaseDate: true,
    },
  });

  let entries = 0;
  let touched = 0;

  for (const a of assets) {
    const base = a.depreciationStart ?? a.purchaseDate;
    if (!base) continue;
    const schedule = buildSchedule({
      cost: Number(a.purchaseCost),
      salvage: a.salvageValue ? Number(a.salvageValue) : 0,
      usefulLifeMonths: a.usefulLifeMonths!,
      method: a.depreciationMethod as DepMethod,
    });
    if (schedule.length === 0) continue;

    const elapsed = Math.min(monthsElapsed(base), schedule.length);
    if (elapsed <= 0) continue;

    const existing = await db.depreciationEntry.findMany({
      where: { assetId: a.id },
      select: { periodEnd: true },
    });
    const have = new Set(existing.map((e) => e.periodEnd.toISOString().slice(0, 7)));

    const toCreate: Prisma.DepreciationEntryCreateManyInput[] = [];
    for (let m = 1; m <= elapsed; m++) {
      const periodEnd = new Date(base.getFullYear(), base.getMonth() + m, 0);
      const key = periodEnd.toISOString().slice(0, 7);
      if (have.has(key)) continue;
      const row = schedule[m - 1];
      toCreate.push({
        orgId: a.orgId,
        assetId: a.id,
        periodEnd,
        amount: new Prisma.Decimal(row.expense),
        bookValue: new Prisma.Decimal(row.bookValue),
      });
    }

    if (toCreate.length > 0) {
      const res = await db.depreciationEntry.createMany({ data: toCreate, skipDuplicates: true });
      entries += res.count;
    }

    const currentBook = new Prisma.Decimal(schedule[elapsed - 1].bookValue);
    await db.asset.update({ where: { id: a.id }, data: { bookValue: currentBook } });
    touched++;
  }

  return { assets: touched, entries };
}
