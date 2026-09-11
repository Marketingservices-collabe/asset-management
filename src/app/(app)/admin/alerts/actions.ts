"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";

export async function updateRule(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.ORG_SETTINGS);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const rule = await db.alertRule.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!rule) return;

  const active = formData.get("active") === "on";
  const thresholdDays = Math.max(0, Math.min(3650, Number(formData.get("thresholdDays")) || rule.thresholdDays));
  const cadence = String(formData.get("cadence")) === "IMMEDIATE" ? "IMMEDIATE" : "DAILY";
  const recipients = String(formData.get("recipients") ?? "")
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));

  await db.alertRule.update({
    where: { id },
    data: { active, thresholdDays, cadence, recipients },
  });
  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "AlertRule",
    entityId: id,
    action: "UPDATE",
    after: { type: rule.type, active, thresholdDays, cadence, recipients },
  });
  revalidatePath("/admin/alerts");
}
