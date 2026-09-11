import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  zText,
  zOptionalText,
  zOptionalUrl,
  zOptionalDate,
  zOptionalDecimal,
  zOptionalInt,
} from "@/lib/form";
import { bookValueAsOf, type DepMethod } from "@/lib/depreciation";

export const DEP_METHODS = [
  "STRAIGHT_LINE",
  "DECLINING_BALANCE_200",
  "DECLINING_BALANCE_150",
  "SUM_OF_YEARS_DIGITS",
  "NONE",
] as const;

export const ASSET_STATUSES = [
  "AVAILABLE",
  "CHECKED_OUT",
  "LEASED",
  "RESERVED",
  "UNDER_REPAIR",
  "DISPOSED",
  "LOST",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Checked out",
  LEASED: "Leased",
  RESERVED: "Reserved",
  UNDER_REPAIR: "Under repair",
  DISPOSED: "Disposed",
  LOST: "Lost",
};

export const assetSchema = z.object({
  tagId: zText.max(64),
  name: zText.max(200),
  description: zOptionalText,
  serialNo: zOptionalText,
  photoUrl: zOptionalUrl,
  categoryId: zOptionalText,
  siteId: zOptionalText,
  locationId: zOptionalText,
  departmentId: zOptionalText,
  assignedPersonId: zOptionalText,
  supplierId: zOptionalText,
  fundId: zOptionalText,
  purchaseDate: zOptionalDate,
  purchaseCost: zOptionalDecimal,
  poNumber: zOptionalText,
  depreciationMethod: z.enum(DEP_METHODS).default("NONE"),
  salvageValue: zOptionalDecimal,
  usefulLifeMonths: zOptionalInt,
  depreciationStart: zOptionalDate,
});

export type AssetInput = z.infer<typeof assetSchema>;

/** Months between a start date and now (never negative). */
export function monthsElapsed(start: Date | null | undefined): number {
  if (!start) return 0;
  const now = new Date();
  const m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, m);
}

export function computeBookValue(input: AssetInput): number | null {
  const cost = input.purchaseCost != null ? Number(input.purchaseCost) : null;
  if (cost == null) return null;
  if (input.depreciationMethod === "NONE" || !input.usefulLifeMonths) return cost;
  const start = input.depreciationStart ?? input.purchaseDate ?? null;
  return bookValueAsOf(
    {
      cost,
      salvage: input.salvageValue != null ? Number(input.salvageValue) : 0,
      usefulLifeMonths: input.usefulLifeMonths,
      method: input.depreciationMethod as DepMethod,
    },
    monthsElapsed(start),
  );
}

export function toAssetData(input: AssetInput, orgId: string) {
  return {
    orgId,
    tagId: input.tagId,
    name: input.name,
    description: input.description ?? null,
    serialNo: input.serialNo ?? null,
    photoUrl: input.photoUrl ?? null,
    categoryId: input.categoryId || null,
    siteId: input.siteId || null,
    locationId: input.locationId || null,
    departmentId: input.departmentId || null,
    assignedPersonId: input.assignedPersonId || null,
    supplierId: input.supplierId || null,
    fundId: input.fundId || null,
    purchaseDate: input.purchaseDate ?? null,
    purchaseCost: input.purchaseCost != null ? new Prisma.Decimal(input.purchaseCost) : null,
    poNumber: input.poNumber ?? null,
    depreciationMethod: input.depreciationMethod,
    salvageValue: input.salvageValue != null ? new Prisma.Decimal(input.salvageValue) : null,
    usefulLifeMonths: input.usefulLifeMonths ?? null,
    depreciationStart: input.depreciationStart ?? null,
    bookValue: (() => {
      const bv = computeBookValue(input);
      return bv != null ? new Prisma.Decimal(bv) : null;
    })(),
  };
}

/** Validate that all referenced FK ids belong to the org. Returns an error string or null. */
export async function validateAssetRefs(orgId: string, input: AssetInput): Promise<string | null> {
  const checks: Array<[string | undefined | null, () => Promise<unknown>]> = [
    [input.categoryId, () => db.category.findFirst({ where: { id: input.categoryId!, orgId } })],
    [input.siteId, () => db.site.findFirst({ where: { id: input.siteId!, orgId } })],
    [input.locationId, () => db.location.findFirst({ where: { id: input.locationId!, orgId } })],
    [input.departmentId, () => db.department.findFirst({ where: { id: input.departmentId!, orgId } })],
    [input.assignedPersonId, () => db.person.findFirst({ where: { id: input.assignedPersonId!, orgId } })],
    [input.supplierId, () => db.company.findFirst({ where: { id: input.supplierId!, orgId } })],
    [input.fundId, () => db.fund.findFirst({ where: { id: input.fundId!, orgId } })],
  ];
  for (const [id, run] of checks) {
    if (!id) continue;
    const found = await run();
    if (!found) return "One of the selected references is invalid.";
  }
  return null;
}

/** Parse cf_<fieldDefId> entries from a FormData into typed value rows. */
export function parseCustomFields(
  formData: FormData,
  defs: { id: string; type: string; required: boolean; label: string }[],
): { values: Array<{ fieldDefId: string; valueText: string | null; valueNumber: Prisma.Decimal | null; valueDate: Date | null; valueBool: boolean | null }>; error: string | null } {
  const values = [];
  for (const def of defs) {
    const raw = formData.get(`cf_${def.id}`);
    const str = raw == null ? "" : String(raw).trim();
    if (!str && def.required) return { values: [], error: `"${def.label}" is required.` };

    const row = {
      fieldDefId: def.id,
      valueText: null as string | null,
      valueNumber: null as Prisma.Decimal | null,
      valueDate: null as Date | null,
      valueBool: null as boolean | null,
    };
    if (str || def.type === "BOOL") {
      switch (def.type) {
        case "NUMBER":
          if (Number.isNaN(Number(str))) return { values: [], error: `"${def.label}" must be a number.` };
          row.valueNumber = new Prisma.Decimal(str);
          break;
        case "DATE": {
          const d = new Date(str);
          if (Number.isNaN(d.getTime())) return { values: [], error: `"${def.label}" is not a valid date.` };
          row.valueDate = d;
          break;
        }
        case "BOOL":
          row.valueBool = str === "on" || str === "true";
          break;
        default:
          row.valueText = str;
      }
    }
    values.push(row);
  }
  return { values, error: null };
}

/** Suggest the next sequential tag id like "AT-0042". */
export async function suggestNextTag(orgId: string): Promise<string> {
  const last = await db.asset.findFirst({
    where: { orgId, tagId: { startsWith: "AT-" } },
    orderBy: { tagId: "desc" },
    select: { tagId: true },
  });
  const n = last ? parseInt(last.tagId.replace("AT-", ""), 10) : 0;
  const next = Number.isNaN(n) ? 1 : n + 1;
  return `AT-${String(next).padStart(4, "0")}`;
}
