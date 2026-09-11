import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { CrudManager } from "@/components/crud/crud-manager";
import type { FieldSpec } from "@/components/crud/types";
import { createAction, updateAction, deleteAction } from "./actions";

const fields: FieldSpec[] = [
  { name: "name", label: "Name", type: "text", required: true, column: true },
  {
    name: "roles",
    label: "Roles",
    type: "text",
    column: true,
    displayOnly: true,
    render: (r) => {
      const tags = [
        r.isVendor && "Vendor",
        r.isManufacturer && "Manufacturer",
        r.isCustomer && "Customer",
      ].filter(Boolean);
      return tags.length ? tags.join(", ") : "—";
    },
  },
  { name: "isVendor", label: "Vendor / supplier", type: "checkbox" },
  { name: "isManufacturer", label: "Manufacturer", type: "checkbox" },
  { name: "isCustomer", label: "Customer (for leases)", type: "checkbox" },
  { name: "contactName", label: "Contact name", type: "text" },
  { name: "email", label: "Email", type: "email", column: true },
  { name: "phone", label: "Phone", type: "text" },
  { name: "address", label: "Address", type: "textarea" },
];

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const rows = await db.company.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: "asc" },
  });

  return (
    <CrudManager
      title="Companies"
      description="Vendors, manufacturers and customers referenced by assets, contracts and leases."
      singular="company"
      basePath="/setup/companies"
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
