import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate } from "@/lib/utils";
import { expiryState, daysUntil, EXPIRY_BADGE } from "@/lib/coverage";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { CrudForm } from "@/components/crud/crud-form";
import { DeleteButton } from "@/components/crud/delete-button";
import { StatusBadge } from "@/components/status-badge";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { FieldSpec } from "@/components/crud/types";
import { createAction, updateAction, deleteAction } from "./actions";

const BASE = "/warranties";

export default async function WarrantiesPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; id?: string }>;
}) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW)) redirect("/dashboard");
  const canManage = can(ctx.permissions, PERMISSIONS.FINANCIALS_MANAGE);
  const sp = await searchParams;

  const [assets, warranties] = await Promise.all([
    db.asset.findMany({
      where: { orgId: ctx.orgId, status: { notIn: ["DISPOSED", "LOST"] } },
      orderBy: { tagId: "asc" },
      select: { id: true, tagId: true, name: true },
    }),
    db.warranty.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { endAt: "asc" },
      include: { asset: { select: { id: true, tagId: true, name: true } } },
    }),
  ]);

  const fields: FieldSpec[] = [
    {
      name: "assetId",
      label: "Asset",
      type: "select",
      required: true,
      options: assets.map((a) => ({ value: a.id, label: `${a.tagId} — ${a.name}` })),
    },
    { name: "provider", label: "Provider", type: "text", placeholder: "Manufacturer, dealer, third party…" },
    { name: "startAt", label: "Start date", type: "date" },
    { name: "endAt", label: "Expiry date", type: "date", required: true },
    { name: "leadDays", label: "Warn ahead (days)", type: "number", hint: "Default 30." },
    { name: "terms", label: "Terms / coverage", type: "textarea" },
  ];

  if (canManage && sp.form) {
    const editing = sp.id ? warranties.find((w) => w.id === sp.id) : null;
    return (
      <>
        <PageHeader title={editing ? "Edit warranty" : "New warranty"} back={{ label: "Warranties", href: BASE }} />
        <Card className="max-w-2xl">
          <CrudForm
            fields={fields}
            action={editing ? updateAction : createAction}
            initial={editing}
            submitLabel={editing ? "Save changes" : "Add warranty"}
            cancelHref={BASE}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Warranties"
        description="Manufacturer and third-party coverage per asset."
        action={canManage ? { label: "Add warranty", href: `${BASE}?form=1` } : undefined}
      />
      <Table>
        <thead>
          <tr>
            <Th>Asset</Th>
            <Th>Provider</Th>
            <Th>Start</Th>
            <Th>Expires</Th>
            <Th>Status</Th>
            {canManage ? <Th className="text-right">Actions</Th> : null}
          </tr>
        </thead>
        <tbody>
          {warranties.length === 0 ? (
            <EmptyRow colSpan={canManage ? 6 : 5}>No warranties recorded.</EmptyRow>
          ) : (
            warranties.map((w) => {
              const state = expiryState(w.endAt, w.leadDays);
              const d = daysUntil(w.endAt);
              return (
                <TrLink key={w.id}>
                  <Td>
                    <Link href={`/assets/${w.asset.id}`} className="hover:underline">
                      {w.asset.name}
                    </Link>
                    <span className="ml-1.5 font-mono text-xs text-[var(--muted)]">{w.asset.tagId}</span>
                  </Td>
                  <Td>{w.provider ?? "—"}</Td>
                  <Td>{formatDate(w.startAt)}</Td>
                  <Td>
                    {formatDate(w.endAt)}
                    {d != null && d >= 0 ? <span className="ml-1 text-xs text-[var(--muted)]">({d}d)</span> : null}
                  </Td>
                  <Td>
                    <StatusBadge status={EXPIRY_BADGE[state]} />
                  </Td>
                  {canManage ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`${BASE}?form=1&id=${w.id}`}
                          className="rounded-md px-2 py-1 text-sm hover:bg-[var(--surface-2)]"
                        >
                          Edit
                        </Link>
                        <DeleteButton id={w.id} action={deleteAction} confirmText="Delete this warranty?" />
                      </div>
                    </Td>
                  ) : null}
                </TrLink>
              );
            })
          )}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-[var(--muted)]">
        <StatusBadge status="PENDING" /> = expiring within the warn-ahead window ·{" "}
        <StatusBadge status="OVERDUE" /> = expired. Alerts fire on the daily scan.
      </p>
      {warranties.length === 0 && canManage ? (
        <Link href={`${BASE}?form=1`} className="mt-2 inline-block">
          <Button size="sm">Add the first warranty</Button>
        </Link>
      ) : null}
    </>
  );
}
