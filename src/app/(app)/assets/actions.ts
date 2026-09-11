"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity, writeAssetEvent } from "@/lib/activity";
import { parseForm, type FormState } from "@/lib/form";
import {
  assetSchema,
  toAssetData,
  validateAssetRefs,
  parseCustomFields,
  ASSET_STATUSES,
} from "@/lib/assets";

async function relevantDefs(orgId: string, categoryId?: string | null) {
  return db.customFieldDef.findMany({
    where: { orgId, OR: [{ categoryId: null }, ...(categoryId ? [{ categoryId }] : [])] },
    orderBy: [{ order: "asc" }, { label: "asc" }],
    select: { id: true, type: true, required: true, label: true },
  });
}

export async function createAsset(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.ASSET_CREATE);
  const parsed = parseForm(assetSchema, formData);
  if (!parsed.success) return parsed.state;
  const input = parsed.data;

  const refErr = await validateAssetRefs(ctx.orgId, input);
  if (refErr) return { error: refErr, values: flat(formData) };

  const defs = await relevantDefs(ctx.orgId, input.categoryId);
  const cf = parseCustomFields(formData, defs);
  if (cf.error) return { error: cf.error, values: flat(formData) };

  let assetId: string;
  try {
    assetId = await db.$transaction(async (tx) => {
      const asset = await tx.asset.create({ data: toAssetData(input, ctx.orgId) });
      if (cf.values.length) {
        await tx.customFieldValue.createMany({
          data: cf.values.map((v) => ({ ...v, assetId: asset.id })),
        });
      }
      await writeAssetEvent(
        { assetId: asset.id, type: "CREATED", actorId: ctx.userId, summary: `Asset created` },
        tx,
      );
      await writeActivity(
        { orgId: ctx.orgId, actorId: ctx.userId, entityType: "Asset", entityId: asset.id, action: "CREATE", after: input },
        tx,
      );
      return asset.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Tag "${input.tagId}" is already used by another asset.`, values: flat(formData) };
    }
    throw e;
  }

  revalidatePath("/assets");
  redirect(`/assets/${assetId}`);
}

export async function updateAsset(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.ASSET_EDIT);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };

  const existing = await db.asset.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!existing) return { error: "Asset not found." };

  const parsed = parseForm(assetSchema, formData);
  if (!parsed.success) return parsed.state;
  const input = parsed.data;

  const refErr = await validateAssetRefs(ctx.orgId, input);
  if (refErr) return { error: refErr, values: flat(formData) };

  const defs = await relevantDefs(ctx.orgId, input.categoryId);
  const cf = parseCustomFields(formData, defs);
  if (cf.error) return { error: cf.error, values: flat(formData) };

  try {
    await db.$transaction(async (tx) => {
      await tx.asset.update({ where: { id }, data: toAssetData(input, ctx.orgId) });
      for (const v of cf.values) {
        await tx.customFieldValue.upsert({
          where: { assetId_fieldDefId: { assetId: id, fieldDefId: v.fieldDefId } },
          create: { ...v, assetId: id },
          update: { valueText: v.valueText, valueNumber: v.valueNumber, valueDate: v.valueDate, valueBool: v.valueBool },
        });
      }
      await writeAssetEvent(
        { assetId: id, type: "UPDATED", actorId: ctx.userId, summary: "Asset details updated" },
        tx,
      );
      await writeActivity(
        {
          orgId: ctx.orgId,
          actorId: ctx.userId,
          entityType: "Asset",
          entityId: id,
          action: "UPDATE",
          before: { name: existing.name, tagId: existing.tagId },
          after: input,
        },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: `Tag "${input.tagId}" is already used by another asset.`, values: flat(formData) };
    }
    throw e;
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  redirect(`/assets/${id}`);
}

export async function deleteAsset(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.ASSET_DELETE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const asset = await db.asset.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true, name: true } });
  if (!asset) return;

  await db.asset.delete({ where: { id } });
  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "Asset",
    entityId: id,
    action: "DELETE",
    before: { name: asset.name },
  });
  revalidatePath("/assets");
  redirect("/assets");
}

export async function setAssetStatus(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.ASSET_EDIT);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !ASSET_STATUSES.includes(status as (typeof ASSET_STATUSES)[number])) return;
  const asset = await db.asset.findFirst({ where: { id, orgId: ctx.orgId }, select: { status: true } });
  if (!asset) return;

  await db.$transaction(async (tx) => {
    await tx.asset.update({ where: { id }, data: { status: status as (typeof ASSET_STATUSES)[number] } });
    await writeAssetEvent(
      { assetId: id, type: "STATUS", actorId: ctx.userId, summary: `Status changed ${asset.status} → ${status}` },
      tx,
    );
    await writeActivity(
      {
        orgId: ctx.orgId,
        actorId: ctx.userId,
        entityType: "Asset",
        entityId: id,
        action: "STATUS",
        before: { status: asset.status },
        after: { status },
      },
      tx,
    );
  });
  revalidatePath(`/assets/${id}`);
  revalidatePath("/assets");
}

/* ── Custody: check-out / check-in ──────────────────────────── */

const OUT_BLOCKED = new Set(["CHECKED_OUT", "LEASED", "DISPOSED", "LOST"]);

export async function checkOutAsset(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.CHECKOUT_MANAGE);
  const assetId = String(formData.get("assetId") ?? "");
  const personId = String(formData.get("personId") ?? "") || null;
  const toLocationId = String(formData.get("toLocationId") ?? "") || null;
  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!assetId) return { error: "Pick an asset." };
  if (!personId && !toLocationId) return { error: "Choose a person or a location to check out to." };
  const dueAt = dueRaw ? new Date(dueRaw) : null;
  if (dueRaw && Number.isNaN(dueAt!.getTime())) return { error: "Invalid due date." };

  const asset = await db.asset.findFirst({ where: { id: assetId, orgId: ctx.orgId } });
  if (!asset) return { error: "Asset not found." };
  if (OUT_BLOCKED.has(asset.status)) return { error: `Asset is ${asset.status.toLowerCase()} and can't be checked out.` };

  if (personId) {
    const p = await db.person.findFirst({ where: { id: personId, orgId: ctx.orgId } });
    if (!p) return { error: "Person not found." };
  }
  if (toLocationId) {
    const l = await db.location.findFirst({ where: { id: toLocationId, orgId: ctx.orgId } });
    if (!l) return { error: "Location not found." };
  }

  const who = personId
    ? (await db.person.findUnique({ where: { id: personId }, select: { name: true } }))?.name
    : (await db.location.findUnique({ where: { id: toLocationId! }, select: { name: true } }))?.name;

  await db.$transaction(async (tx) => {
    await tx.checkoutRecord.create({
      data: { orgId: ctx.orgId, assetId, personId, toLocationId, dueAt, notes, outByUserId: ctx.userId },
    });
    await tx.asset.update({
      where: { id: assetId },
      data: {
        status: "CHECKED_OUT",
        assignedPersonId: personId ?? asset.assignedPersonId,
        locationId: toLocationId ?? asset.locationId,
      },
    });
    await writeAssetEvent(
      { assetId, type: "CHECKED_OUT", actorId: ctx.userId, summary: `Checked out to ${who ?? "—"}${dueAt ? `, due ${dueAt.toLocaleDateString()}` : ""}` },
      tx,
    );
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "Asset", entityId: assetId, action: "CHECK_OUT", after: { personId, toLocationId, dueAt } },
      tx,
    );
  });

  revalidatePath("/checkout");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function checkInAsset(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.CHECKOUT_MANAGE);
  const assetId = String(formData.get("assetId") ?? "");
  if (!assetId) return;

  const open = await db.checkoutRecord.findFirst({
    where: { assetId, orgId: ctx.orgId, checkedInAt: null },
    orderBy: { checkedOutAt: "desc" },
  });
  if (!open) return;

  await db.$transaction(async (tx) => {
    await tx.checkoutRecord.update({
      where: { id: open.id },
      data: { checkedInAt: new Date(), inByUserId: ctx.userId },
    });
    await tx.asset.update({ where: { id: assetId }, data: { status: "AVAILABLE" } });
    await writeAssetEvent({ assetId, type: "CHECKED_IN", actorId: ctx.userId, summary: "Checked in" }, tx);
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "Asset", entityId: assetId, action: "CHECK_IN" },
      tx,
    );
  });

  revalidatePath("/checkout");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/dashboard");
}

/* ── Move / transfer ───────────────────────────────────────── */

export async function moveAsset(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.ASSET_EDIT);
  const id = String(formData.get("id") ?? "");
  const toSiteId = String(formData.get("toSiteId") ?? "") || null;
  const toLocationId = String(formData.get("toLocationId") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id) return { error: "Missing asset." };
  if (!toSiteId && !toLocationId) return { error: "Choose a destination site or location." };

  const asset = await db.asset.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!asset) return { error: "Asset not found." };

  let siteId = toSiteId ?? asset.siteId;
  if (toLocationId) {
    const loc = await db.location.findFirst({ where: { id: toLocationId, orgId: ctx.orgId }, select: { siteId: true } });
    if (!loc) return { error: "Location not found." };
    siteId = loc.siteId;
  } else if (toSiteId) {
    const site = await db.site.findFirst({ where: { id: toSiteId, orgId: ctx.orgId }, select: { id: true } });
    if (!site) return { error: "Site not found." };
  }

  await db.$transaction(async (tx) => {
    await tx.moveRecord.create({
      data: {
        orgId: ctx.orgId,
        assetId: id,
        fromSiteId: asset.siteId,
        fromLocationId: asset.locationId,
        toSiteId: siteId,
        toLocationId,
        byUserId: ctx.userId,
        notes,
      },
    });
    await tx.asset.update({ where: { id }, data: { siteId, locationId: toLocationId } });
    await writeAssetEvent({ assetId: id, type: "MOVED", actorId: ctx.userId, summary: "Moved" }, tx);
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "Asset", entityId: id, action: "MOVE", before: { siteId: asset.siteId, locationId: asset.locationId }, after: { siteId, locationId: toLocationId } },
      tx,
    );
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { ok: true };
}

/* ── Disposal ──────────────────────────────────────────────── */

const DISPOSAL_METHODS = ["SOLD", "DONATED", "SCRAPPED", "LOST"] as const;

export async function disposeAsset(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.DISPOSAL_MANAGE);
  const id = String(formData.get("id") ?? "");
  const method = String(formData.get("method") ?? "");
  const proceedsRaw = String(formData.get("proceeds") ?? "").trim();
  const atRaw = String(formData.get("at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id) return { error: "Missing asset." };
  if (!DISPOSAL_METHODS.includes(method as (typeof DISPOSAL_METHODS)[number]))
    return { error: "Choose a disposal method." };
  if (proceedsRaw && Number.isNaN(Number(proceedsRaw))) return { error: "Proceeds must be a number." };
  const at = atRaw ? new Date(atRaw) : new Date();
  if (atRaw && Number.isNaN(at.getTime())) return { error: "Invalid date." };

  const asset = await db.asset.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true, disposal: true } });
  if (!asset) return { error: "Asset not found." };
  if (asset.disposal) return { error: "Asset is already disposed." };

  await db.$transaction(async (tx) => {
    await tx.disposalRecord.create({
      data: {
        orgId: ctx.orgId,
        assetId: id,
        method,
        at,
        proceeds: proceedsRaw ? new Prisma.Decimal(proceedsRaw) : null,
        notes,
        byUserId: ctx.userId,
      },
    });
    await tx.asset.update({ where: { id }, data: { status: method === "LOST" ? "LOST" : "DISPOSED" } });
    await tx.checkoutRecord.updateMany({
      where: { assetId: id, checkedInAt: null },
      data: { checkedInAt: at, inByUserId: ctx.userId },
    });
    await writeAssetEvent(
      { assetId: id, type: "DISPOSED", actorId: ctx.userId, summary: `Disposed (${method.toLowerCase()})` },
      tx,
    );
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "Asset", entityId: id, action: "DISPOSE", after: { method, at } },
      tx,
    );
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

function flat(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  }
  return out;
}
