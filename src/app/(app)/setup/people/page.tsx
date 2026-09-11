import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { CrudManager } from "@/components/crud/crud-manager";
import type { FieldSpec } from "@/components/crud/types";
import { createAction, updateAction, deleteAction } from "./actions";

const fields: FieldSpec[] = [
  { name: "name", label: "Name", type: "text", required: true, column: true },
  { name: "email", label: "Email", type: "email", column: true, hint: "Used for check-out due-date alerts." },
  { name: "phone", label: "Phone", type: "text", column: true },
];

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const rows = await db.person.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, phone: true },
  });

  return (
    <CrudManager
      title="People"
      description="Employees and contractors that assets can be checked out or assigned to."
      singular="person"
      basePath="/setup/people"
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
