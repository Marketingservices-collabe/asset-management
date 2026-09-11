import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate, formatMoney } from "@/lib/utils";
import { expiryState, daysUntil, EXPIRY_BADGE, CONTRACT_TYPES, CONTRACT_TYPE_LABELS } from "@/lib/coverage";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { CoverageForm } from "@/components/coverage-form";
import { DeleteButton } from "@/components/crud/delete-button";
import { StatusBadge } from "@/components/status-badge";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import type { FieldSpec } from "@/components/crud/types";
import { createContract, updateContract, deleteContract } from "./actions";

const BASE = "/contracts";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; id?: string }>;
}) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW)) redirect("/dashboard");
  const canManage = can(ctx.permissions, PERMISSIONS.FINANCIALS_MANAGE);
  const sp = await searchParams;

  const [assets, companies, contracts] = await Promise.all([
    db.asset.findMany({
      where: { orgId: ctx.orgId, status: { notIn: ["DISPOSED", "LOST"] } },
      orderBy: { tagId: "asc" },
      select: { id: true, tagId: true, name: true },
    }),
    db.company.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.contract.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { endAt: "asc" },
      include: { vendor: { select: { name: true } }, _count: { select: { assets: true } } },
    }),
  ]);

  const coreFields: FieldSpec[] = [
    { name: "name", label: "Name", type: "text", required: true },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: CONTRACT_TYPES.map((t) => ({ value: t, label: CONTRACT_TYPE_LABELS[t] })),
    },
    {
      name: "vendorCompanyId",
      label: "Vendor",
      type: "select",
      options: companies.map((c) => ({ value: c.id, label: c.name })),
    },
    { name: "value", label: "Contract value", type: "number" },
    { name: "startAt", label: "Start date", type: "date" },
    { name: "endAt", label: "End date", type: "date" },
    { name: "leadDays", label: "Warn ahead (days)", type: "number", hint: "Default 30." },
    { name: "autoRenew", label: "Auto-renews", type: "checkbox" },
  ];

  if (canManage && sp.form) {
    const editing = sp.id
      ? await db.contract.findFirst({
          where: { id: sp.id, orgId: ctx.orgId },
          include: { assets: { select: { assetId: true } } },
        })
      : null;
    return (
      <>
        <PageHeader title={editing ? "Edit contract" : "New contract"} back={{ label: "Contracts", href: BASE }} />
        <Card className="max-w-2xl">
          <CoverageForm
            action={editing ? updateContract : createContract}
            coreFields={coreFields}
            assets={assets.map((a) => ({ value: a.id, label: `${a.tagId} — ${a.name}` }))}
            initial={editing ?? undefined}
            linkedAssetIds={editing?.assets.map((x) => x.assetId) ?? []}
            submitLabel={editing ? "Save changes" : "Create contract"}
            cancelHref={BASE}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Contracts & leases"
        description="Service, lease and support agreements covering one or more assets."
        action={canManage ? { label: "New contract", href: `${BASE}?form=1` } : undefined}
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Vendor</Th>
            <Th>Assets</Th>
            <Th>Value</Th>
            <Th>Ends</Th>
            <Th>Status</Th>
            {canManage ? <Th className="text-right">Actions</Th> : null}
          </tr>
        </thead>
        <tbody>
          {contracts.length === 0 ? (
            <EmptyRow colSpan={canManage ? 8 : 7}>No contracts.</EmptyRow>
          ) : (
            contracts.map((c) => {
              const state = expiryState(c.endAt, c.leadDays);
              const d = daysUntil(c.endAt);
              return (
                <TrLink key={c.id}>
                  <Td>{c.name}</Td>
                  <Td>{CONTRACT_TYPE_LABELS[c.type] ?? c.type}</Td>
                  <Td>{c.vendor?.name ?? "—"}</Td>
                  <Td>{c._count.assets}</Td>
                  <Td>{formatMoney(c.value ? Number(c.value) : null)}</Td>
                  <Td>
                    {formatDate(c.endAt)}
                    {d != null && d >= 0 ? <span className="ml-1 text-xs text-[var(--muted)]">({d}d)</span> : null}
                    {c.autoRenew ? <span className="ml-1 text-xs text-[var(--muted)]">· auto</span> : null}
                  </Td>
                  <Td>
                    <StatusBadge status={EXPIRY_BADGE[state]} />
                  </Td>
                  {canManage ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`${BASE}?form=1&id=${c.id}`} className="rounded-md px-2 py-1 text-sm hover:bg-[var(--surface-2)]">
                          Edit
                        </Link>
                        <DeleteButton id={c.id} action={deleteContract} confirmText="Delete this contract?" />
                      </div>
                    </Td>
                  ) : null}
                </TrLink>
              );
            })
          )}
        </tbody>
      </Table>
    </>
  );
}
