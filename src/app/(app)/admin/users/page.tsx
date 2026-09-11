import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Table, Th, Td, EmptyRow } from "@/components/ui/table";
import { AddMemberForm } from "./add-member-form";
import { setMemberRole, setMemberStatus, removeMember } from "./actions";

export default async function UsersPage() {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.USER_MANAGE)) redirect("/dashboard");

  const [roles, memberships] = await Promise.all([
    db.role.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.membership.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { user: { email: "asc" } },
      include: { user: { select: { id: true, email: true, name: true, passwordHash: true, twoFactorSecret: true } } },
    }),
  ]);
  const roleOpts = roles.map((r) => ({ value: r.id, label: r.name }));

  return (
    <>
      <PageHeader title="Users" description="People with access to this organization." />

      <div className="mb-6">
        <AddMemberForm roles={roleOpts} />
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Email</Th>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Sign-in</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {memberships.length === 0 ? (
            <EmptyRow colSpan={6}>No members.</EmptyRow>
          ) : (
            memberships.map((m) => {
              const self = m.userId === ctx.userId;
              return (
                <tr key={m.id}>
                  <Td>
                    {m.user.email}
                    {self ? <span className="ml-1 text-xs text-[var(--muted)]">(you)</span> : null}
                  </Td>
                  <Td>{m.user.name ?? "—"}</Td>
                  <Td>
                    <form action={setMemberRole} className="inline">
                      <input type="hidden" name="id" value={m.id} />
                      <select
                        name="roleId"
                        defaultValue={m.roleId}
                        className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <button className="ml-1 text-xs text-brand hover:underline">set</button>
                    </form>
                  </Td>
                  <Td className="text-xs text-[var(--muted)]">
                    {[m.user.passwordHash ? "password" : null, m.user.twoFactorSecret ? "2FA" : null, "Google"]
                      .filter(Boolean)
                      .join(" · ")}
                  </Td>
                  <Td>
                    <StatusBadge status={m.status === "ACTIVE" ? "ACTIVE" : "SKIPPED"} />
                  </Td>
                  <Td className="text-right">
                    {self ? (
                      "—"
                    ) : (
                      <div className="flex justify-end gap-1">
                        <form action={setMemberStatus}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="status" value={m.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} />
                          <Button type="submit" size="sm" variant="ghost">
                            {m.status === "ACTIVE" ? "Disable" : "Enable"}
                          </Button>
                        </form>
                        <form action={removeMember}>
                          <input type="hidden" name="id" value={m.id} />
                          <Button type="submit" size="sm" variant="ghost" className="text-red-600">
                            Remove
                          </Button>
                        </form>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </>
  );
}
