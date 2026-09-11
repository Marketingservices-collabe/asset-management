import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { DeleteButton } from "@/components/crud/delete-button";
import { RoleForm } from "./role-form";
import { createRole, updateRole, deleteRole } from "./actions";

const BASE = "/admin/roles";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.USER_MANAGE)) redirect("/dashboard");
  const sp = await searchParams;

  const roles = await db.role.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { memberships: true } } },
  });

  if (sp.new !== undefined) {
    return (
      <>
        <PageHeader title="New role" back={{ label: "Roles", href: BASE }} />
        <Card className="max-w-2xl">
          <RoleForm action={createRole} submitLabel="Create role" />
        </Card>
      </>
    );
  }

  if (sp.edit) {
    const role = roles.find((r) => r.id === sp.edit);
    if (!role) redirect(BASE);
    return (
      <>
        <PageHeader title={`Edit ${role.name}`} back={{ label: "Roles", href: BASE }} />
        <Card className="max-w-2xl">
          <RoleForm
            action={updateRole}
            initial={{ id: role.id, name: role.name, permissions: role.permissions, isSystem: role.isSystem }}
            submitLabel="Save role"
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Roles"
        description="Permission sets. System roles can be re-permissioned but not renamed or deleted."
        action={{ label: "New role", href: `${BASE}?new` }}
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Kind</Th>
            <Th className="text-right">Permissions</Th>
            <Th className="text-right">Members</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {roles.length === 0 ? (
            <EmptyRow colSpan={5}>No roles.</EmptyRow>
          ) : (
            roles.map((r) => (
              <TrLink key={r.id}>
                <Td>
                  <Link href={`${BASE}?edit=${r.id}`} className="font-medium text-brand hover:underline">
                    {r.name}
                  </Link>
                </Td>
                <Td>
                  <StatusBadge status={r.isSystem ? "ACTIVE" : "PENDING"} />{" "}
                  <span className="text-xs text-[var(--muted)]">{r.isSystem ? "System" : "Custom"}</span>
                </Td>
                <Td className="text-right tabular-nums">{r.permissions.length}</Td>
                <Td className="text-right tabular-nums">{r._count.memberships}</Td>
                <Td className="text-right">
                  {!r.isSystem && r._count.memberships === 0 ? (
                    <DeleteButton id={r.id} action={deleteRole} confirmText={`Delete role "${r.name}"?`} />
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </Td>
              </TrLink>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
