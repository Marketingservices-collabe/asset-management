import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { OrgForm } from "./org-form";

export default async function OrgSettingsPage() {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.ORG_SETTINGS)) redirect("/dashboard");

  const org = await db.organization.findUnique({ where: { id: ctx.orgId } });
  const settings = (org?.settings ?? {}) as Record<string, unknown>;

  return (
    <>
      <PageHeader title="Organization" description="Name and formatting defaults." />
      <Card className="max-w-2xl">
        <OrgForm
          initial={{
            name: org?.name ?? "",
            currency: typeof settings.currency === "string" ? settings.currency : "USD",
            dateFormat: typeof settings.dateFormat === "string" ? settings.dateFormat : "MMM d, yyyy",
            fiscalYearStartMonth:
              typeof settings.fiscalYearStartMonth === "number" ? settings.fiscalYearStartMonth : 1,
          }}
        />
      </Card>
    </>
  );
}
