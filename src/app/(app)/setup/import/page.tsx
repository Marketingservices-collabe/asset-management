import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { can, PERMISSIONS } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.ASSET_CREATE)) redirect("/assets");

  return (
    <>
      <PageHeader
        title="Import assets"
        description="Upload a CSV or Excel export. Missing categories, sites, departments and people are created automatically."
        back={{ label: "Setup", href: "/setup/categories" }}
      />
      <ImportWizard />
    </>
  );
}
