"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { parseForm, type FormState, zText, zOptionalText, zOptionalDate, zOptionalDecimal, zOptionalInt } from "@/lib/form";
import { CONTRACT_TYPES } from "@/lib/coverage";

const schema = z.object({
  name: zText,
  type: z.enum(CONTRACT_TYPES).default("SERVICE"),
  vendorCompanyId: zOptionalText,
  startAt: zOptionalDate,
  endAt: zOptionalDate,
  value: zOptionalDecimal,
  leadDays: zOptionalInt,
  autoRenew: z
    .union([z.literal("on"), z.literal("true"), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});

function parseAssetIds(formData: FormData): string[] {
  try {
    const arr = JSON.parse(String(formData.get("assetIds") ?? "[]"));
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function validAssetIds(orgId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const found = await db.asset.findMany({ where: { id: { in: ids }, orgId }, select: { id: true } });
  return found.map((a) => a.id);
}

function toData(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    type: d.type,
    vendorCompanyId: d.vendorCompanyId || null,
    startAt: d.startAt ?? null,
    endAt: d.endAt ?? null,
    value: d.value != null ? new Prisma.Decimal(d.value) : null,
    leadDays: d.leadDays ?? 30,
    autoRenew: d.autoRenew,
  };
}

export async function createContract(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.FINANCIALS_MANAGE);
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return parsed.state;
  const assetIds = await validAssetIds(ctx.orgId, parseAssetIds(formData));

  const contract = await db.contract.create({
    data: {
      orgId: ctx.orgId,
      ...toData(parsed.data),
      assets: { create: assetIds.map((assetId) => ({ assetId })) },
    },
  });
  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "Contract",
    entityId: contract.id,
    action: "CREATE",
    after: { ...parsed.data, assets: assetIds.length },
  });
  revalidatePath("/contracts");
  redirect("/contracts");
}

export async function updateContract(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.FINANCIALS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };
  const existing = await db.contract.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!existing) return { error: "Contract not found." };

  const parsed = parseForm(schema, formData);
  if (!parsed.success) return parsed.state;
  const assetIds = await validAssetIds(ctx.orgId, parseAssetIds(formData));

  await db.$transaction([
    db.contract.update({ where: { id }, data: toData(parsed.data) }),
    db.contractAsset.deleteMany({ where: { contractId: id } }),
    db.contractAsset.createMany({ data: assetIds.map((assetId) => ({ contractId: id, assetId })) }),
  ]);
  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "Contract",
    entityId: id,
    action: "UPDATE",
    after: { ...parsed.data, assets: assetIds.length },
  });
  revalidatePath("/contracts");
  redirect("/contracts");
}

export async function deleteContract(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.FINANCIALS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const c = await db.contract.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } });
  if (!c) return;
  await db.contract.delete({ where: { id } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Contract", entityId: id, action: "DELETE" });
  revalidatePath("/contracts");
  redirect("/contracts");
}
