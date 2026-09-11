import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { CrudManager } from "@/components/crud/crud-manager";
import type { FieldSpec } from "@/components/crud/types";
import { createAction, updateAction, deleteAction } from "./actions";

const METHOD_LABELS: Record<string, string> = {
  STRAIGHT_LINE: "Straight line",
  DECLINING_BALANCE_200: "Declining balance (200%)",
  DECLINING_BALANCE_150: "Declining balance (150%)",
  SUM_OF_YEARS_DIGITS: "Sum of years' digits",
  NONE: "No depreciation",
};

const fields: FieldSpec[] = [
  { name: "name", label: "Name", type: "text", required: true, column: true },
  {
    name: "depreciationMethod",
    label: "Default depreciation method",
    type: "select",
    required: true,
    column: true,
    options: Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label })),
    render: (r) => METHOD_LABELS[String(r.depreciationMethod)] ?? "—",
  },
  {
    name: "defaultUsefulLifeMo",
    label: "Default useful life (months)",
    type: "number",
    column: true,
    hint: "Used to pre-fill new assets in this category.",
  },
];

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const rows = await db.category.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, depreciationMethod: true, defaultUsefulLifeMo: true },
  });

  return (
    <CrudManager
      title="Categories"
      description="Asset types. Each can carry its own custom fields and depreciation defaults."
      singular="category"
      basePath="/setup/categories"
      fields={fields}
      rows={rows}
      canManage={can(ctx.permissions, PERMISSIONS.SETUP_MANAGE)}
      searchParams={sp}
      createAction={createAction}
      updateAction={updateAction}
      deleteAction={deleteAction}
    />
  );
}
