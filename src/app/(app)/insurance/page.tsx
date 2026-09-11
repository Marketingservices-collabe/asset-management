import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate, formatMoney } from "@/lib/utils";
import { expiryState, daysUntil, EXPIRY_BADGE } from "@/lib/coverage";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { CoverageForm } from "@/components/coverage-form";
import { DeleteButton } from "@/components/crud/delete-button";
import { StatusBadge } from "@/components/status-badge";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import type { FieldSpec } from "@/components/crud/types";
import { createPolicy, updatePolicy, deletePolicy } from "./actions";

const BASE = "/insurance";

export default async function InsurancePage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; id?: string }>;
}) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW)) redirect("/dashboard");
  const canManage = can(ctx.permissions, PERMISSIONS.FINANCIALS_MANAGE);
  const sp = await searchParams;

  const [assets, policies] = await Promise.all([
    db.asset.findMany({
      where: { orgId: ctx.orgId, status: { notIn: ["DISPOSED", "LOST"] } },
      orderBy: { tagId: "asc" },
      select: { id: true, tagId: true, name: true },
    }),
    db.insurancePolicy.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { endAt: "asc" },
      include: { _count: { select: { assets: true } } },
    }),
  ]);

  const coreFields: FieldSpec[] = [
    { name: "provider", label: "Insurer", type: "text", required: true },
    { name: "policyNo", label: "Policy number", type: "text" },
    { name: "coverageAmount", label: "Coverage amount", type: "number" },
    { name: "startAt", label: "Start date", type: "date" },
    { name: "endAt", label: "Renewal / end date", type: "date" },
    { name: "leadDays", label: "Warn ahead (days)", type: "number", hint: "Default 30." },
  ];

  if (canManage && sp.form) {
    const editing = sp.id
      ? await db.insurancePolicy.findFirst({
          where: { id: sp.id, orgId: ctx.orgId },
          include: { assets: { select: { assetId: true } } },
        })
      : null;
    return (
      <>
        <PageHeader title={editing ? "Edit policy" : "New policy"} back={{ label: "Insurance", href: BASE }} />
        <Card className="max-w-2xl">
          <CoverageForm
            action={editing ? updatePolicy : createPolicy}
            coreFields={coreFields}
            assets={assets.map((a) => ({ value: a.id, label: `${a.tagId} — ${a.name}` }))}
            initial={editing ?? undefined}
            linkedAssetIds={editing?.assets.map((x) => x.assetId) ?? []}
            submitLabel={editing ? "Save changes" : "Create policy"}
            cancelHref={BASE}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Insurance policies"
        description="Coverage that applies to one or more assets."
        action={canManage ? { label: "New policy", href: `${BASE}?form=1` } : undefined}
      />
      <Table>
        <thead>
          <tr>
            <Th>Insurer</Th>
            <Th>Policy #</Th>
            <Th>Coverage</Th>
            <Th>Assets</Th>
            <Th>Renews</Th>
            <Th>Status</Th>
            {canManage ? <Th className="text-right">Actions</Th> : null}
          </tr>
        </thead>
        <tbody>
          {policies.length === 0 ? (
            <EmptyRow colSpan={canManage ? 7 : 6}>No policies.</EmptyRow>
          ) : (
            policies.map((p) => {
              const state = expiryState(p.endAt, p.leadDays);
              const d = daysUntil(p.endAt);
              return (
                <TrLink key={p.id}>
                  <Td>{p.provider}</Td>
                  <Td className="font-mono text-xs">{p.policyNo ?? "—"}</Td>
                  <Td>{formatMoney(p.coverageAmount ? Number(p.coverageAmount) : null)}</Td>
                  <Td>{p._count.assets}</Td>
                  <Td>
                    {formatDate(p.endAt)}
                    {d != null && d >= 0 ? <span className="ml-1 text-xs text-[var(--muted)]">({d}d)</span> : null}
                  </Td>
                  <Td>
                    <StatusBadge status={EXPIRY_BADGE[state]} />
                  </Td>
                  {canManage ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`${BASE}?form=1&id=${p.id}`} className="rounded-md px-2 py-1 text-sm hover:bg-[var(--surface-2)]">
                          Edit
                        </Link>
                        <DeleteButton id={p.id} action={deletePolicy} confirmText="Delete this policy?" />
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
