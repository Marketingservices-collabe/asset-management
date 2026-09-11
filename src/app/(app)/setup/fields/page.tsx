import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { CrudManager } from "@/components/crud/crud-manager";
import type { FieldSpec } from "@/components/crud/types";
import { createAction, updateAction, deleteAction } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  BOOL: "Yes / No",
  SELECT: "Dropdown",
};

export default async function FieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const ctx = await requireContext();
  const sp = await searchParams;

  const [categories, defs] = await Promise.all([
    db.category.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.customFieldDef.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ order: "asc" }, { label: "asc" }],
      include: { category: { select: { name: true } } },
    }),
  ]);

  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const fields: FieldSpec[] = [
    { name: "label", label: "Label", type: "text", required: true, column: true },
    {
      name: "key",
      label: "Key",
      type: "text",
      required: true,
      hint: "Lowercase identifier used in exports & the API. Auto-slugified.",
    },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      column: true,
      options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
      render: (r) => TYPE_LABELS[String(r.type)] ?? String(r.type),
    },
    {
      name: "categoryId",
      label: "Applies to",
      type: "select",
      options: categories.map((c) => ({ value: c.id, label: c.name })),
      hint: "Leave blank to apply to every category.",
      column: true,
      render: (r) => (r.categoryId ? catName.get(String(r.categoryId)) ?? "—" : "All categories"),
    },
    {
      name: "options",
      label: "Dropdown options",
      type: "textarea",
      hint: "One per line (only used for the Dropdown type).",
    },
    { name: "required", label: "Required on the asset form", type: "checkbox" },
    { name: "order", label: "Sort order", type: "number" },
  ];

  const rows = defs.map((d) => ({
    ...d,
    options: d.options.join("\n"),
  }));

  return (
    <CrudManager
      title="Custom fields"
      description="Extra fields shown on the asset form, in reports and exports."
      singular="field"
      basePath="/setup/fields"
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
