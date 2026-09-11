"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { parseForm, type FormState } from "@/lib/form";
import { itemSchema, receiveSchema, issueSchema, adjustSchema, transferSchema } from "@/lib/inventory";

/* ── Item CRUD ─────────────────────────────────────────────── */

export async function createItem(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const parsed = parseForm(itemSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  if (d.categoryId) {
    const c = await db.category.findFirst({ where: { id: d.categoryId, orgId: ctx.orgId } });
    if (!c) return { error: "Category not found." };
  }
  let id: string;
  try {
    const item = await db.inventoryItem.create({
      data: {
        orgId: ctx.orgId,
        sku: d.sku,
        name: d.name,
        unit: d.unit,
        categoryId: d.categoryId || null,
        defaultReorderPoint: d.defaultReorderPoint ?? null,
      },
    });
    id = item.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: `SKU "${d.sku}" already exists.` };
    throw e;
  }
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "InventoryItem", entityId: id, action: "CREATE", after: d });
  revalidatePath("/inventory");
  redirect(`/inventory/${id}`);
}

export async function updateItem(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };
  const parsed = parseForm(itemSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  try {
    await db.inventoryItem.update({
      where: { id, orgId: ctx.orgId },
      data: {
        sku: d.sku,
        name: d.name,
        unit: d.unit,
        categoryId: d.categoryId || null,
        defaultReorderPoint: d.defaultReorderPoint ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: `SKU "${d.sku}" already exists.` };
    throw e;
  }
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "InventoryItem", entityId: id, action: "UPDATE", after: d });
  revalidatePath("/inventory");
  redirect(`/inventory/${id}`);
}

export async function deleteItem(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const item = await db.inventoryItem.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } });
  if (!item) return;
  await db.inventoryItem.delete({ where: { id } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "InventoryItem", entityId: id, action: "DELETE" });
  revalidatePath("/inventory");
  redirect("/inventory");
}

/* ── Stock movements ───────────────────────────────────────── */

async function moveStock(
  orgId: string,
  userId: string,
  itemId: string,
  locationId: string,
  delta: number,
  type: string,
  reason: string | null,
) {
  await db.$transaction(async (tx) => {
    const stock = await tx.inventoryStock.findUnique({ where: { itemId_locationId: { itemId, locationId } } });
    const current = stock?.quantity ?? 0;
    const next = current + delta;
    if (next < 0) throw new Error("Not enough stock at that location.");
    await tx.inventoryStock.upsert({
      where: { itemId_locationId: { itemId, locationId } },
      create: { orgId, itemId, locationId, quantity: next },
      update: { quantity: next },
    });
    await tx.inventoryTxn.create({ data: { orgId, itemId, locationId, delta, type, reason, byUserId: userId } });
  });
}

async function resolveRefs(orgId: string, itemId: string, locationIds: string[]): Promise<string | null> {
  const item = await db.inventoryItem.findFirst({ where: { id: itemId, orgId }, select: { id: true } });
  if (!item) return "Item not found.";
  const locs = await db.location.findMany({ where: { id: { in: locationIds }, orgId }, select: { id: true } });
  if (locs.length !== new Set(locationIds).size) return "Location not found.";
  return null;
}

export async function receiveStock(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const parsed = parseForm(receiveSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const err = await resolveRefs(ctx.orgId, d.itemId, [d.locationId]);
  if (err) return { error: err };
  await moveStock(ctx.orgId, ctx.userId, d.itemId, d.locationId, d.quantity, "RECEIVE", d.reason ?? null);
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "InventoryItem", entityId: d.itemId, action: "RECEIVE", after: d });
  revalidatePath(`/inventory/${d.itemId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function issueStock(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const parsed = parseForm(issueSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const err = await resolveRefs(ctx.orgId, d.itemId, [d.locationId]);
  if (err) return { error: err };
  try {
    await moveStock(ctx.orgId, ctx.userId, d.itemId, d.locationId, -d.quantity, "ISSUE", d.reason ?? null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed." };
  }
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "InventoryItem", entityId: d.itemId, action: "ISSUE", after: d });
  revalidatePath(`/inventory/${d.itemId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function adjustStock(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const parsed = parseForm(adjustSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const err = await resolveRefs(ctx.orgId, d.itemId, [d.locationId]);
  if (err) return { error: err };
  const stock = await db.inventoryStock.findUnique({
    where: { itemId_locationId: { itemId: d.itemId, locationId: d.locationId } },
  });
  const delta = d.newCount - (stock?.quantity ?? 0);
  if (delta !== 0)
    await moveStock(ctx.orgId, ctx.userId, d.itemId, d.locationId, delta, "ADJUST", d.reason ?? "Count adjustment");
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "InventoryItem", entityId: d.itemId, action: "ADJUST", after: d });
  revalidatePath(`/inventory/${d.itemId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function transferStock(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const parsed = parseForm(transferSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const err = await resolveRefs(ctx.orgId, d.itemId, [d.fromLocationId, d.toLocationId]);
  if (err) return { error: err };
  try {
    await moveStock(ctx.orgId, ctx.userId, d.itemId, d.fromLocationId, -d.quantity, "TRANSFER_OUT", d.reason ?? null);
    await moveStock(ctx.orgId, ctx.userId, d.itemId, d.toLocationId, d.quantity, "TRANSFER_IN", d.reason ?? null);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed." };
  }
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "InventoryItem", entityId: d.itemId, action: "TRANSFER", after: d });
  revalidatePath(`/inventory/${d.itemId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

/* ── Reorder point per location ────────────────────────────── */

export async function setReorderPoint(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const itemId = String(formData.get("itemId") ?? "");
  const locationId = String(formData.get("locationId") ?? "");
  const raw = String(formData.get("reorderPoint") ?? "").trim();
  if (!itemId || !locationId) return;
  const reorderPoint = raw === "" ? null : Number(raw);
  if (reorderPoint != null && (!Number.isInteger(reorderPoint) || reorderPoint < 0)) return;
  await db.inventoryStock.upsert({
    where: { itemId_locationId: { itemId, locationId } },
    create: { orgId: ctx.orgId, itemId, locationId, quantity: 0, reorderPoint },
    update: { reorderPoint },
  });
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/inventory");
}
