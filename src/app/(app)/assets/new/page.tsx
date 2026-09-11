import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { can, PERMISSIONS } from "@/lib/authz";
import { loadAssetFormOptions } from "@/lib/asset-options";
import { suggestNextTag } from "@/lib/assets";
import { PageHeader } from "@/components/page-header";
import { AssetForm } from "../asset-form";
import { createAsset } from "../actions";

export default async function NewAssetPage() {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.ASSET_CREATE)) redirect("/assets");

  const [options, tag] = await Promise.all([
    loadAssetFormOptions(ctx.orgId),
    suggestNextTag(ctx.orgId),
  ]);

  return (
    <>
      <PageHeader title="New asset" back={{ label: "Assets", href: "/assets" }} />
      <div className="max-w-3xl">
        <AssetForm
          action={createAsset}
          options={options}
          initial={{ tagId: tag, depreciationMethod: "NONE" }}
          submitLabel="Create asset"
        />
      </div>
    </>
  );
}
