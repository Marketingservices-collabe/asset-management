"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity, writeAssetEvent } from "@/lib/activity";
import { parseForm, type FormState } from "@/lib/form";
import { scheduleSchema, completeSchema, adHocSchema, addDays } from "@/lib/maintenance";

function revalidate(assetId?: string) {
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  if (assetId) revalidatePath(`/assets/${assetId}`);
}

/* ── Schedules ─────────────────────────────────────────────── */

export async function createSchedule(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  const parsed = parseForm(scheduleSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  const asset = await db.asset.findFirst({ where: { id: d.assetId, orgId: ctx.orgId }, select: { id: true, name: true } });
  if (!asset) return { error: "Asset not found." };
  if (d.assignedToPersonId) {
    const p = await db.person.findFirst({ where: { id: d.assignedToPersonId, orgId: ctx.orgId } });
    if (!p) return { error: "Assignee not found." };
  }

  await db.$transaction(async (tx) => {
    const schedule = await tx.maintenanceSchedule.create({
      data: {
        orgId: ctx.orgId,
        assetId: d.assetId,
        title: d.title,
        intervalDays: d.intervalDays,
        leadDays: d.leadDays ?? 7,
        assignedToPersonId: d.assignedToPersonId || null,
        active: d.active,
        nextDueAt: d.firstDueAt,
      },
    });
    await tx.maintenanceRecord.create({
      data: { orgId: ctx.orgId, assetId: d.assetId, scheduleId: schedule.id, dueAt: d.firstDueAt, status: "SCHEDULED" },
    });
    await writeAssetEvent(
      { assetId: d.assetId, type: "MAINTENANCE", actorId: ctx.userId, summary: `Maintenance scheduled: ${d.title} (every ${d.intervalDays}d)` },
      tx,
    );
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "MaintenanceSchedule", entityId: schedule.id, action: "CREATE", after: d },
      tx,
    );
  });

  revalidate(d.assetId);
  return { ok: true };
}

export async function toggleSchedule(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const s = await db.maintenanceSchedule.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!s) return;
  await db.maintenanceSchedule.update({ where: { id }, data: { active: !s.active } });
  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "MaintenanceSchedule",
    entityId: id,
    action: s.active ? "PAUSE" : "RESUME",
  });
  revalidate();
}

export async function deleteSchedule(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const s = await db.maintenanceSchedule.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!s) return;
  // keep completed history; drop only still-open records tied to this schedule
  await db.$transaction([
    db.maintenanceRecord.deleteMany({ where: { scheduleId: id, status: { in: ["SCHEDULED", "OVERDUE"] } } }),
    db.maintenanceRecord.updateMany({ where: { scheduleId: id }, data: { scheduleId: null } }),
    db.maintenanceSchedule.delete({ where: { id } }),
  ]);
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "MaintenanceSchedule", entityId: id, action: "DELETE" });
  revalidate();
}

/* ── Records: complete / skip / log ad-hoc ─────────────────── */

async function rollForward(
  tx: Prisma.TransactionClient,
  orgId: string,
  scheduleId: string,
  assetId: string,
  from: Date,
) {
  const schedule = await tx.maintenanceSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || !schedule.active || !schedule.intervalDays) return;
  const nextDue = addDays(from, schedule.intervalDays);
  await tx.maintenanceRecord.create({
    data: { orgId, assetId, scheduleId, dueAt: nextDue, status: "SCHEDULED" },
  });
  await tx.maintenanceSchedule.update({ where: { id: scheduleId }, data: { nextDueAt: nextDue } });
}

export async function completeRecord(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  const parsed = parseForm(completeSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  const rec = await db.maintenanceRecord.findFirst({ where: { id: d.recordId, orgId: ctx.orgId } });
  if (!rec) return { error: "Record not found." };
  if (rec.status === "DONE" || rec.status === "SKIPPED") return { error: "Already closed." };

  await db.$transaction(async (tx) => {
    await tx.maintenanceRecord.update({
      where: { id: rec.id },
      data: {
        status: "DONE",
        completedAt: d.completedAt,
        technician: d.technician ?? null,
        workPerformed: d.workPerformed ?? null,
        cost: d.cost != null ? new Prisma.Decimal(d.cost) : null,
      },
    });
    if (rec.scheduleId) await rollForward(tx, ctx.orgId, rec.scheduleId, rec.assetId, d.completedAt);
    await writeAssetEvent(
      { assetId: rec.assetId, type: "MAINTENANCE", actorId: ctx.userId, summary: `Maintenance completed${d.workPerformed ? `: ${d.workPerformed}` : ""}` },
      tx,
    );
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "MaintenanceRecord", entityId: rec.id, action: "COMPLETE", after: d },
      tx,
    );
  });

  revalidate(rec.assetId);
  return { ok: true };
}

export async function skipRecord(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const rec = await db.maintenanceRecord.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!rec || rec.status === "DONE" || rec.status === "SKIPPED") return;

  await db.$transaction(async (tx) => {
    await tx.maintenanceRecord.update({ where: { id }, data: { status: "SKIPPED" } });
    if (rec.scheduleId) await rollForward(tx, ctx.orgId, rec.scheduleId, rec.assetId, rec.dueAt ?? new Date());
    await writeAssetEvent({ assetId: rec.assetId, type: "MAINTENANCE", actorId: ctx.userId, summary: "Maintenance skipped" }, tx);
    await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "MaintenanceRecord", entityId: id, action: "SKIP" });
  });

  revalidate(rec.assetId);
}

export async function logAdHoc(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
  const parsed = parseForm(adHocSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  const asset = await db.asset.findFirst({ where: { id: d.assetId, orgId: ctx.orgId }, select: { id: true } });
  if (!asset) return { error: "Asset not found." };

  await db.$transaction(async (tx) => {
    const rec = await tx.maintenanceRecord.create({
      data: {
        orgId: ctx.orgId,
        assetId: d.assetId,
        status: "DONE",
        completedAt: d.completedAt,
        technician: d.technician ?? null,
        workPerformed: d.workPerformed,
        cost: d.cost != null ? new Prisma.Decimal(d.cost) : null,
      },
    });
    await writeAssetEvent(
      { assetId: d.assetId, type: "MAINTENANCE", actorId: ctx.userId, summary: `Maintenance logged: ${d.workPerformed}` },
      tx,
    );
    await writeActivity(
      { orgId: ctx.orgId, actorId: ctx.userId, entityType: "MaintenanceRecord", entityId: rec.id, action: "LOG", after: d },
      tx,
    );
  });

  revalidate(d.assetId);
  return { ok: true };
}
