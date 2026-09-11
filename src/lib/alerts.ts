import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";

const DAY = 86_400_000;

type Made = { type: string; entityId: string; message: string };

/**
 * Evaluate every org's AlertRules, upsert Notification rows (deduped by day),
 * and email a digest per configured recipient. Returns per-type counts.
 */
export async function runAlertScan(): Promise<Record<string, number>> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const counts: Record<string, number> = {};

  // Flip past-due scheduled maintenance to OVERDUE before evaluating rules.
  await db.maintenanceRecord.updateMany({
    where: { status: "SCHEDULED", dueAt: { lt: now } },
    data: { status: "OVERDUE" },
  });

  const rules = await db.alertRule.findMany({ where: { active: true } });
  const byOrg = new Map<string, typeof rules>();
  for (const r of rules) {
    if (!byOrg.has(r.orgId)) byOrg.set(r.orgId, []);
    byOrg.get(r.orgId)!.push(r);
  }

  for (const [orgId, orgRules] of byOrg) {
    const made: Made[] = [];

    for (const rule of orgRules) {
      const horizon = new Date(now.getTime() + rule.thresholdDays * DAY);

      if (rule.type === "CHECKOUT_OVERDUE") {
        const rows = await db.checkoutRecord.findMany({
          where: { orgId, checkedInAt: null, dueAt: { lt: now } },
          include: { asset: { select: { tagId: true, name: true } }, person: { select: { name: true } } },
        });
        for (const c of rows)
          made.push({
            type: rule.type,
            entityId: c.id,
            message: `${c.asset.tagId} (${c.asset.name}) is overdue — held by ${c.person?.name ?? "a location"} since ${c.checkedOutAt.toLocaleDateString()}`,
          });
      }

      if (rule.type === "MAINT_DUE") {
        const rows = await db.maintenanceRecord.findMany({
          where: { orgId, status: { in: ["SCHEDULED", "OVERDUE"] }, dueAt: { lte: horizon } },
          include: { asset: { select: { tagId: true, name: true } } },
        });
        for (const m of rows)
          made.push({
            type: rule.type,
            entityId: m.id,
            message: `Maintenance due for ${m.asset.tagId} (${m.asset.name})${m.dueAt ? ` on ${m.dueAt.toLocaleDateString()}` : ""}`,
          });
      }

      if (rule.type === "WARRANTY_EXPIRY") {
        const rows = await db.warranty.findMany({
          where: { orgId, endAt: { gte: now, lte: horizon } },
          include: { asset: { select: { tagId: true, name: true } } },
        });
        for (const w of rows)
          made.push({
            type: rule.type,
            entityId: w.id,
            message: `Warranty on ${w.asset.tagId} (${w.asset.name}) expires ${w.endAt.toLocaleDateString()}`,
          });
      }

      if (rule.type === "CONTRACT_EXPIRY") {
        const rows = await db.contract.findMany({
          where: { orgId, endAt: { gte: now, lte: horizon } },
        });
        for (const c of rows)
          made.push({
            type: rule.type,
            entityId: c.id,
            message: `Contract "${c.name}" expires ${c.endAt?.toLocaleDateString()}`,
          });
      }

      if (rule.type === "POLICY_EXPIRY") {
        const rows = await db.insurancePolicy.findMany({
          where: { orgId, endAt: { gte: now, lte: horizon } },
        });
        for (const p of rows)
          made.push({
            type: rule.type,
            entityId: p.id,
            message: `Insurance policy ${p.policyNo ?? p.provider} expires ${p.endAt?.toLocaleDateString()}`,
          });
      }

      if (rule.type === "LOW_STOCK") {
        const rows = await db.inventoryStock.findMany({
          where: { orgId, reorderPoint: { not: null } },
          include: { item: { select: { name: true, sku: true } } },
        });
        for (const s of rows) {
          if (s.reorderPoint != null && s.quantity <= s.reorderPoint)
            made.push({
              type: rule.type,
              entityId: s.id,
              message: `Low stock: ${s.item.sku} (${s.item.name}) at ${s.quantity}, reorder point ${s.reorderPoint}`,
            });
        }
      }
    }

    // upsert notifications (deduped per day)
    const fresh: Made[] = [];
    for (const m of made) {
      const existing = await db.notification.findUnique({
        where: { orgId_type_entityId_period: { orgId, type: m.type, entityId: m.entityId, period: today } },
      });
      if (existing) continue;
      await db.notification.create({
        data: { orgId, type: m.type, entityType: "alert", entityId: m.entityId, message: m.message, period: today },
      });
      fresh.push(m);
      counts[m.type] = (counts[m.type] ?? 0) + 1;
    }

    // email digest
    if (fresh.length > 0) {
      const recipients = new Set<string>();
      for (const rule of orgRules) {
        for (const r of (rule.recipients as unknown[]) ?? []) {
          if (typeof r === "string" && r.includes("@")) recipients.add(r);
        }
      }
      if (recipients.size > 0) {
        await sendMail({
          to: [...recipients],
          subject: `Asset Tracker — ${fresh.length} new alert${fresh.length === 1 ? "" : "s"}`,
          text: fresh.map((m) => `• ${m.message}`).join("\n"),
        });
        await db.notification.updateMany({
          where: { orgId, period: today, emailedAt: null },
          data: { emailedAt: now },
        });
      }
    }
  }

  return counts;
}
