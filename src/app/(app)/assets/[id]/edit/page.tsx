import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { loadAssetFormOptions } from "@/lib/asset-options";
import { PageHeader } from "@/components/page-header";
import { AssetForm } from "../../asset-form";
import { updateAsset } from "../../actions";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.ASSET_EDIT)) redirect("/assets");
  const { id } = await params;

  const [asset, options] = await Promise.all([
    db.asset.findFirst({
      where: { id, orgId: ctx.orgId },
      include: { fieldValues: true },
    }),
    loadAssetFormOptions(ctx.orgId),
  ]);
  if (!asset) notFound();

  const customValues: Record<string, string> = {};
  for (const fv of asset.fieldValues) {
    if (fv.valueText != null) customValues[fv.fieldDefId] = fv.valueText;
    else if (fv.valueNumber != null) customValues[fv.fieldDefId] = String(fv.valueNumber);
    else if (fv.valueDate != null) customValues[fv.fieldDefId] = fv.valueDate.toISOString().slice(0, 10);
    else if (fv.valueBool != null) customValues[fv.fieldDefId] = fv.valueBool ? "on" : "";
  }

  const initial = {
    id: asset.id,
    tagId: asset.tagId,
    name: asset.name,
    description: asset.description,
    serialNo: asset.serialNo,
    photoUrl: asset.photoUrl,
    categoryId: asset.categoryId,
    siteId: asset.siteId,
    locationId: asset.locationId,
    departmentId: asset.departmentId,
    assignedPersonId: asset.assignedPersonId,
    supplierId: asset.supplierId,
    fundId: asset.fundId,
    purchaseDate: asset.purchaseDate,
    purchaseCost: asset.purchaseCost ? String(asset.purchaseCost) : "",
    poNumber: asset.poNumber,
    depreciationMethod: asset.depreciationMethod,
    salvageValue: asset.salvageValue ? String(asset.salvageValue) : "",
    usefulLifeMonths: asset.usefulLifeMonths ?? "",
    depreciationStart: asset.depreciationStart,
  };

  return (
    <>
      <PageHeader title={`Edit ${asset.name}`} back={{ label: asset.name, href: `/assets/${asset.id}` }} />
      <div className="max-w-3xl">
        <AssetForm
          action={updateAsset}
          options={options}
          initial={initial}
          customValues={customValues}
          submitLabel="Save changes"
        />
      </div>
    </>
  );
}
