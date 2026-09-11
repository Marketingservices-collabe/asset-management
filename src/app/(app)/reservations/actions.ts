"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity, writeAssetEvent } from "@/lib/activity";
import { parseForm, type FormState, zText } from "@/lib/form";

const schema = z
  .object({
    assetId: zText,
    personId: zText,
    fromAt: zText,
    toAt: zText,
  })
  .refine((d) => !Number.isNaN(Date.parse(d.fromAt)) && !Number.isNaN(Date.parse(d.toAt)), {
    message: "Invalid dates",
    path: ["toAt"],
  })
  .refine((d) => new Date(d.fromAt) <= new Date(d.toAt), {
    message: "End date must be after start date",
    path: ["toAt"],
  });

export async function createReservation(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.RESERVATION_MANAGE);
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return parsed.state;
  const { assetId, personId } = parsed.data;
  const fromAt = new Date(parsed.data.fromAt);
  const toAt = new Date(parsed.data.toAt);

  const [asset, person] = await Promise.all([
    db.asset.findFirst({ where: { id: assetId, orgId: ctx.orgId } }),
    db.person.findFirst({ where: { id: personId, orgId: ctx.orgId }, select: { id: true, name: true } }),
  ]);
  if (!asset) return { error: "Asset not found." };
  if (!person) return { error: "Person not found." };
  if (["DISPOSED", "LOST"].includes(asset.status)) return { error: "Asset is disposed." };

  const overlap = await db.reservation.findFirst({
    where: {
      assetId,
      status: { in: ["PENDING", "ACTIVE"] },
      fromAt: { lte: toAt },
      toAt: { gte: fromAt },
    },
  });
  if (overlap) return { error: "That asset is already reserved for an overlapping period." };

  const now = new Date();
  const active = fromAt <= now && now <= toAt && asset.status === "AVAILABLE";

  await db.$transaction(async (tx) => {
    const r = await tx.reservation.create({
      data: { orgId: ctx.orgId, assetId, personId, fromAt, toAt, status: active ? "ACTIVE" : "PENDING" },
    });
    if (active) await tx.asset.update({ where: { id: assetId }, data: { status: "RESERVED" } });
    await writeAssetEvent(
      { assetId, type: "RESERVED", actorId: ctx.userId, summary: `Reserved for ${person.name} (${fromAt.toLocaleDateString()}–${toAt.toLocaleDateString()})` },
      tx,
    );
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "Reservation", entityId: r.id, action: "CREATE", after: { assetId, personId, fromAt, toAt } },
      tx,
    );
  });

  revalidatePath("/reservations");
  revalidatePath(`/assets/${assetId}`);
  return { ok: true };
}

export async function cancelReservation(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.RESERVATION_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const r = await db.reservation.findFirst({ where: { id, orgId: ctx.orgId }, include: { asset: true } });
  if (!r || r.status === "CANCELLED" || r.status === "RELEASED") return;

  await db.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id }, data: { status: "CANCELLED" } });
    if (r.status === "ACTIVE" && r.asset.status === "RESERVED") {
      await tx.asset.update({ where: { id: r.assetId }, data: { status: "AVAILABLE" } });
    }
    await writeAssetEvent({ assetId: r.assetId, type: "RESERVATION", actorId: ctx.userId, summary: "Reservation cancelled" }, tx);
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "Reservation", entityId: id, action: "CANCEL" },
      tx,
    );
  });

  revalidatePath("/reservations");
  revalidatePath(`/assets/${r.assetId}`);
}
