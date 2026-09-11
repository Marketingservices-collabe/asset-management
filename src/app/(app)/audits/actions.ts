"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity, writeAssetEvent } from "@/lib/activity";
import { parseForm, type FormState, zText, zOptionalText } from "@/lib/form";
import { type ScanResult } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  name: zText.max(200),
  siteId: zOptionalText,
  locationId: zOptionalText,
  categoryId: zOptionalText,
});

export async function createAudit(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.AUDIT_RUN);
  const parsed = parseForm(createSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  const audit = await db.audit.create({
    data: {
      orgId: ctx.orgId,
      name: d.name,
      siteId: d.siteId || null,
      locationId: d.locationId || null,
      categoryId: d.categoryId || null,
      status: "OPEN",
    },
  });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Audit", entityId: audit.id, action: "CREATE", after: d });
  revalidatePath("/audits");
  redirect(`/audits/${audit.id}`);
}

export type ScanState = {
  message?: string;
  tone?: "ok" | "warn" | "err";
  tag?: string;
};

export async function recordScan(_prev: ScanState, formData: FormData): Promise<ScanState> {
  const ctx = await requirePermission(PERMISSIONS.AUDIT_RUN);
  const auditId = String(formData.get("auditId") ?? "");
  const rawTag = String(formData.get("rawTag") ?? "").trim();
  const foundLocationId = String(formData.get("foundLocationId") ?? "").trim() || null;
  if (!auditId || !rawTag) return { message: "Enter a tag.", tone: "err" };

  const audit = await db.audit.findFirst({ where: { id: auditId, orgId: ctx.orgId } });
  if (!audit) return { message: "Audit not found.", tone: "err" };
  if (audit.status !== "OPEN") return { message: "Audit is closed.", tone: "err" };

  const asset = await db.asset.findFirst({
    where: { tagId: rawTag, orgId: ctx.orgId },
    select: { id: true, name: true, tagId: true, siteId: true, locationId: true, categoryId: true, status: true },
  });

  let result: ScanResult;
  let message: string;
  let tone: ScanState["tone"];

  if (!asset) {
    result = "UNEXPECTED";
    message = `Unknown tag "${rawTag}" — recorded as unexpected.`;
    tone = "warn";
  } else {
    const inScope =
      (!audit.siteId || asset.siteId === audit.siteId) &&
      (!audit.locationId || asset.locationId === audit.locationId) &&
      (!audit.categoryId || asset.categoryId === audit.categoryId) &&
      asset.status !== "DISPOSED" &&
      asset.status !== "LOST";
    if (!inScope) {
      result = "UNEXPECTED";
      message = `${asset.tagId} (${asset.name}) is outside this audit's scope.`;
      tone = "warn";
    } else if (foundLocationId && foundLocationId !== asset.locationId) {
      result = "MOVED";
      message = `${asset.tagId} (${asset.name}) found in a different location — flagged as moved.`;
      tone = "warn";
    } else {
      result = "FOUND";
      message = `${asset.tagId} (${asset.name}) accounted for.`;
      tone = "ok";
    }
  }

  const existing = asset
    ? await db.auditScan.findFirst({ where: { auditId, assetId: asset.id } })
    : await db.auditScan.findFirst({ where: { auditId, rawTag, assetId: null } });

  if (existing) {
    await db.auditScan.update({
      where: { id: existing.id },
      data: { rawTag, scannedAt: new Date(), foundLocationId, result },
    });
  } else {
    await db.auditScan.create({
      data: { auditId, assetId: asset?.id ?? null, rawTag, foundLocationId, result },
    });
  }

  revalidatePath(`/audits/${auditId}`);
  return { message, tone, tag: rawTag };
}

export async function closeAudit(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.AUDIT_RUN);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const audit = await db.audit.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!audit || audit.status !== "OPEN") return;
  await db.audit.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Audit", entityId: id, action: "CLOSE" });
  revalidatePath(`/audits/${id}`);
  revalidatePath("/audits");
}

export async function reopenAudit(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.AUDIT_RUN);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.audit.updateMany({ where: { id, orgId: ctx.orgId }, data: { status: "OPEN", closedAt: null } });
  revalidatePath(`/audits/${id}`);
  revalidatePath("/audits");
}

export async function applyMoves(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.ASSET_EDIT);
  const auditId = String(formData.get("id") ?? "");
  if (!auditId) return;
  const audit = await db.audit.findFirst({ where: { id: auditId, orgId: ctx.orgId } });
  if (!audit) return;

  const moved = await db.auditScan.findMany({
    where: { auditId, result: "MOVED", assetId: { not: null }, foundLocationId: { not: null } },
    include: { asset: { select: { id: true, tagId: true, siteId: true, locationId: true } } },
  });

  for (const scan of moved) {
    if (!scan.asset || !scan.foundLocationId) continue;
    const loc = await db.location.findFirst({
      where: { id: scan.foundLocationId, orgId: ctx.orgId },
      select: { siteId: true },
    });
    if (!loc) continue;
    await db.$transaction(async (tx) => {
      await tx.moveRecord.create({
        data: {
          orgId: ctx.orgId,
          assetId: scan.asset!.id,
          fromSiteId: scan.asset!.siteId,
          fromLocationId: scan.asset!.locationId,
          toSiteId: loc.siteId,
          toLocationId: scan.foundLocationId,
          byUserId: ctx.userId,
          notes: `Applied from audit "${audit.name}"`,
        },
      });
      await tx.asset.update({
        where: { id: scan.asset!.id },
        data: { siteId: loc.siteId, locationId: scan.foundLocationId },
      });
      await tx.auditScan.update({ where: { id: scan.id }, data: { result: "FOUND" } });
      await writeAssetEvent(
        { assetId: scan.asset!.id, type: "MOVED", actorId: ctx.userId, summary: `Location corrected during audit "${audit.name}"` },
        tx,
      );
    });
  }

  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Audit", entityId: auditId, action: "APPLY_MOVES", after: { count: moved.length } });
  revalidatePath(`/audits/${auditId}`);
  revalidatePath("/assets");
}

export async function deleteAudit(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.AUDIT_RUN);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const audit = await db.audit.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } });
  if (!audit) return;
  await db.audit.delete({ where: { id } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Audit", entityId: id, action: "DELETE" });
  revalidatePath("/audits");
  redirect("/audits");
}
