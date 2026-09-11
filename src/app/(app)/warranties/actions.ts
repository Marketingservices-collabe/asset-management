"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { makeCrudActions } from "@/lib/crud";
import { writeAssetEvent } from "@/lib/activity";
import { zText, zOptionalText, zOptionalDate, zOptionalInt } from "@/lib/form";

const schema = z.object({
  assetId: zText,
  provider: zOptionalText,
  startAt: zOptionalDate,
  endAt: z
    .string()
    .trim()
    .transform((v) => new Date(v))
    .refine((v) => !Number.isNaN(v.getTime()), "Pick an expiry date"),
  terms: zOptionalText,
  leadDays: zOptionalInt,
});

async function assertAsset(orgId: string, assetId: string) {
  const a = await db.asset.findFirst({ where: { id: assetId, orgId }, select: { id: true } });
  if (!a) throw new Error("Asset not found.");
}

export const { createAction, updateAction, deleteAction } = makeCrudActions({
  permission: PERMISSIONS.FINANCIALS_MANAGE,
  basePath: "/warranties",
  entityType: "Warranty",
  schema,
  create: async (ctx, d) => {
    await assertAsset(ctx.orgId, d.assetId);
    const w = await db.warranty.create({
      data: {
        orgId: ctx.orgId,
        assetId: d.assetId,
        provider: d.provider ?? null,
        startAt: d.startAt ?? null,
        endAt: d.endAt,
        terms: d.terms ?? null,
        leadDays: d.leadDays ?? 30,
      },
    });
    await writeAssetEvent({
      assetId: d.assetId,
      type: "WARRANTY",
      actorId: ctx.userId,
      summary: `Warranty added${d.provider ? ` (${d.provider})` : ""}, expires ${d.endAt.toLocaleDateString()}`,
    });
    return w;
  },
  update: async (ctx, id, d) => {
    await assertAsset(ctx.orgId, d.assetId);
    return db.warranty.update({
      where: { id, orgId: ctx.orgId },
      data: {
        assetId: d.assetId,
        provider: d.provider ?? null,
        startAt: d.startAt ?? null,
        endAt: d.endAt,
        terms: d.terms ?? null,
        leadDays: d.leadDays ?? 30,
      },
    });
  },
  remove: (ctx, id) => db.warranty.delete({ where: { id, orgId: ctx.orgId } }),
});
