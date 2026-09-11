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

const schema = z.object({
  provider: zText,
  policyNo: zOptionalText,
  coverageAmount: zOptionalDecimal,
  startAt: zOptionalDate,
  endAt: zOptionalDate,
  leadDays: zOptionalInt,
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
    provider: d.provider,
    policyNo: d.policyNo ?? null,
    coverageAmount: d.coverageAmount != null ? new Prisma.Decimal(d.coverageAmount) : null,
    startAt: d.startAt ?? null,
    endAt: d.endAt ?? null,
    leadDays: d.leadDays ?? 30,
  };
}

export async function createPolicy(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.FINANCIALS_MANAGE);
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return parsed.state;
  const assetIds = await validAssetIds(ctx.orgId, parseAssetIds(formData));

  const policy = await db.insurancePolicy.create({
    data: {
      orgId: ctx.orgId,
      ...toData(parsed.data),
      assets: { create: assetIds.map((assetId) => ({ assetId })) },
    },
  });
  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "InsurancePolicy",
    entityId: policy.id,
    action: "CREATE",
    after: { ...parsed.data, assets: assetIds.length },
  });
  revalidatePath("/insurance");
  redirect("/insurance");
}

export async function updatePolicy(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.FINANCIALS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };
  const existing = await db.insurancePolicy.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!existing) return { error: "Policy not found." };

  const parsed = parseForm(schema, formData);
  if (!parsed.success) return parsed.state;
  const assetIds = await validAssetIds(ctx.orgId, parseAssetIds(formData));

  await db.$transaction([
    db.insurancePolicy.update({ where: { id }, data: toData(parsed.data) }),
    db.policyAsset.deleteMany({ where: { policyId: id } }),
    db.policyAsset.createMany({ data: assetIds.map((assetId) => ({ policyId: id, assetId })) }),
  ]);
  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "InsurancePolicy",
    entityId: id,
    action: "UPDATE",
    after: { ...parsed.data, assets: assetIds.length },
  });
  revalidatePath("/insurance");
  redirect("/insurance");
}

export async function deletePolicy(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.FINANCIALS_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const p = await db.insurancePolicy.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } });
  if (!p) return;
  await db.insurancePolicy.delete({ where: { id } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "InsurancePolicy", entityId: id, action: "DELETE" });
  revalidatePath("/insurance");
  redirect("/insurance");
}
