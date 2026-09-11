import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { CrudManager } from "@/components/crud/crud-manager";
import type { FieldSpec } from "@/components/crud/types";
import { createAction, updateAction, deleteAction } from "./actions";

const fields: FieldSpec[] = [
  { name: "name", label: "Name", type: "text", required: true, column: true },
];

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const rows = await db.department.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <CrudManager
      title="Departments"
      description="Organizational units assets can belong to."
      singular="department"
      basePath="/setup/departments"
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
