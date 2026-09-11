import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { notifMeta } from "@/lib/notifications";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateRule } from "./actions";

const THRESHOLD_HELP: Record<string, string> = {
  CHECKOUT_OVERDUE: "Not used — overdue is always past the due date.",
  MAINT_DUE: "Warn this many days before a maintenance is due.",
  WARRANTY_EXPIRY: "Warn this many days before a warranty expires.",
  CONTRACT_EXPIRY: "Warn this many days before a contract ends.",
  POLICY_EXPIRY: "Warn this many days before a policy renews.",
  LOW_STOCK: "Not used — triggers at or below the reorder point.",
};

export default async function AlertRulesPage() {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.ORG_SETTINGS)) redirect("/dashboard");

  const rules = await db.alertRule.findMany({ where: { orgId: ctx.orgId }, orderBy: { type: "asc" } });

  return (
    <>
      <PageHeader
        title="Alert rules"
        description="What the daily scan checks and who gets emailed. Run manually with POST /api/cron/alerts."
      />
      <div className="space-y-3">
        {rules.map((r) => {
          const meta = notifMeta(r.type);
          return (
            <Card key={r.id}>
              <form action={updateRule} className="space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <div className="flex items-center justify-between">
                  <div className="font-medium">{meta.label}</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={r.active} /> Active
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-[8rem_10rem_1fr]">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-[var(--muted)]">Threshold (days)</span>
                    <input
                      name="thresholdDays"
                      type="number"
                      min={0}
                      defaultValue={r.thresholdDays}
                      className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-[var(--muted)]">Cadence</span>
                    <select
                      name="cadence"
                      defaultValue={r.cadence}
                      className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
                    >
                      <option value="DAILY">Daily digest</option>
                      <option value="IMMEDIATE">Immediate</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs text-[var(--muted)]">Recipients (comma-separated emails)</span>
                    <input
                      name="recipients"
                      defaultValue={(r.recipients as string[]).join(", ")}
                      className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--muted)]">{THRESHOLD_HELP[r.type]}</p>
                  <Button type="submit" size="sm" variant="secondary">
                    Save
                  </Button>
                </div>
              </form>
            </Card>
          );
        })}
      </div>
    </>
  );
}
