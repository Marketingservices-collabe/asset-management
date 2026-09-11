import Link from "next/link";
import { notFound } from "next/navigation";
import { Wrench, ShieldCheck } from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate, formatMoney } from "@/lib/utils";
import { monthsElapsed } from "@/lib/assets";
import { effectiveStatus } from "@/lib/maintenance";
import { PageHeader } from "@/components/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { DeleteButton } from "@/components/crud/delete-button";
import { StatusControl } from "./status-control";
import { AssetActions } from "./asset-actions";
import { deleteAsset } from "../actions";

const DEP_LABELS: Record<string, string> = {
  STRAIGHT_LINE: "Straight line",
  DECLINING_BALANCE_200: "Declining balance (200%)",
  DECLINING_BALANCE_150: "Declining balance (150%)",
  SUM_OF_YEARS_DIGITS: "Sum of years' digits",
  NONE: "None",
};

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;

  const asset = await db.asset.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      category: true,
      site: true,
      location: true,
      department: true,
      assignedPerson: true,
      supplier: true,
      fund: true,
      fieldValues: { include: { fieldDef: true } },
      events: { orderBy: { at: "desc" }, take: 50 },
      checkouts: {
        where: { checkedInAt: null },
        include: { person: { select: { name: true } } },
        orderBy: { checkedOutAt: "desc" },
        take: 1,
      },
      maintenance: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }, { completedAt: "desc" }],
        take: 6,
        include: { schedule: { select: { title: true } } },
      },
      warranties: { orderBy: { endAt: "asc" } },
      contractLinks: { include: { contract: { select: { id: true, name: true, type: true, endAt: true } } } },
      policyLinks: { include: { policy: { select: { id: true, provider: true, policyNo: true, endAt: true } } } },
    },
  });
  if (!asset) notFound();

  const canEdit = can(ctx.permissions, PERMISSIONS.ASSET_EDIT);
  const canDelete = can(ctx.permissions, PERMISSIONS.ASSET_DELETE);
  const canCustody = can(ctx.permissions, PERMISSIONS.CHECKOUT_MANAGE);
  const canDispose = can(ctx.permissions, PERMISSIONS.DISPOSAL_MANAGE);
  const canMaintain = can(ctx.permissions, PERMISSIONS.MAINTENANCE_MANAGE);
  const showFinancials = can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW) || canEdit;
  const canFinance = can(ctx.permissions, PERMISSIONS.FINANCIALS_MANAGE);
  const openCheckout = asset.checkouts[0];
  const showActions = canCustody || canEdit || canDispose;
  const hasCoverage =
    asset.warranties.length > 0 || asset.contractLinks.length > 0 || asset.policyLinks.length > 0 || !!asset.fund;

  const [people, sites, locations] = await Promise.all([
    db.person.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.site.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, siteId: true, site: { select: { name: true } } },
    }),
  ]);

  const details: [string, React.ReactNode][] = [
    ["Category", asset.category?.name ?? "—"],
    ["Serial number", asset.serialNo ?? "—"],
    ["Site", asset.site?.name ?? "—"],
    ["Location", asset.location?.name ?? "—"],
    ["Department", asset.department?.name ?? "—"],
    [
      "Assigned to",
      openCheckout?.person?.name
        ? `${openCheckout.person.name} (checked out)`
        : asset.assignedPerson?.name ?? "—",
    ],
  ];

  const financials: [string, React.ReactNode][] = [
    ["Purchase date", formatDate(asset.purchaseDate)],
    ["Purchase cost", formatMoney(asset.purchaseCost ? Number(asset.purchaseCost) : null)],
    ["PO number", asset.poNumber ?? "—"],
    ["Supplier", asset.supplier?.name ?? "—"],
    ["Fund / grant", asset.fund?.name ?? "—"],
    ["Depreciation", DEP_LABELS[asset.depreciationMethod] ?? asset.depreciationMethod],
    ["Useful life", asset.usefulLifeMonths ? `${asset.usefulLifeMonths} months` : "—"],
    [
      "Book value",
      asset.bookValue != null
        ? `${formatMoney(Number(asset.bookValue))} · ${monthsElapsed(asset.depreciationStart ?? asset.purchaseDate)} mo elapsed`
        : "—",
    ],
  ];

  return (
    <>
      <PageHeader
        title={asset.name}
        description={`Tag ${asset.tagId}`}
        back={{ label: "Assets", href: "/assets" }}
        action={canEdit ? { label: "Edit", href: `/assets/${asset.id}/edit` } : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0">Overview</SectionTitle>
              <div className="flex items-center gap-2">
                <StatusBadge status={asset.status} />
                {canEdit ? <StatusControl id={asset.id} status={asset.status} /> : null}
              </div>
            </div>
            {asset.description ? <p className="mb-3 text-sm text-[var(--muted)]">{asset.description}</p> : null}
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {details.map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4 text-sm">
                  <dt className="text-[var(--muted)]">{k}</dt>
                  <dd className="text-right">{val}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {showFinancials ? (
            <Card>
              <SectionTitle>Purchase &amp; depreciation</SectionTitle>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {financials.map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4 text-sm">
                    <dt className="text-[var(--muted)]">{k}</dt>
                    <dd className="text-right">{val}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          {asset.fieldValues.length > 0 ? (
            <Card>
              <SectionTitle>Custom fields</SectionTitle>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {asset.fieldValues.map((fv) => (
                  <div key={fv.id} className="flex justify-between gap-4 text-sm">
                    <dt className="text-[var(--muted)]">{fv.fieldDef.label}</dt>
                    <dd className="text-right">{renderFieldValue(fv)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0">Maintenance</SectionTitle>
              {canMaintain ? (
                <div className="flex gap-3 text-sm">
                  <Link href="/maintenance?form=schedule" className="text-brand hover:underline">
                    Schedule
                  </Link>
                  <Link href="/maintenance?form=log" className="text-brand hover:underline">
                    Log work
                  </Link>
                </div>
              ) : null}
            </div>
            {asset.maintenance.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No maintenance records.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {asset.maintenance.map((m) => {
                  const eff = effectiveStatus(m.status, m.dueAt);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <Wrench size={14} className="text-[var(--muted)]" />
                        {m.schedule?.title ?? m.workPerformed ?? "Maintenance"}
                      </span>
                      <span className="flex items-center gap-2 text-[var(--muted)]">
                        {m.completedAt ? formatDate(m.completedAt) : formatDate(m.dueAt)}
                        <StatusBadge status={eff} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {showFinancials && (hasCoverage || canFinance) ? (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle className="mb-0">Coverage</SectionTitle>
                {canFinance ? (
                  <div className="flex gap-3 text-sm">
                    <Link href="/warranties?form=1" className="text-brand hover:underline">
                      Warranty
                    </Link>
                    <Link href="/contracts?form=1" className="text-brand hover:underline">
                      Contract
                    </Link>
                    <Link href="/insurance?form=1" className="text-brand hover:underline">
                      Insurance
                    </Link>
                  </div>
                ) : null}
              </div>
              {!hasCoverage ? (
                <p className="text-sm text-[var(--muted)]">No warranty, contract, insurance or fund linked.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {asset.fund ? (
                    <li className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-[var(--muted)]" /> Fund · {asset.fund.name}
                      </span>
                    </li>
                  ) : null}
                  {asset.warranties.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-[var(--muted)]" />
                        Warranty{w.provider ? ` · ${w.provider}` : ""}
                      </span>
                      <span className="text-[var(--muted)]">expires {formatDate(w.endAt)}</span>
                    </li>
                  ))}
                  {asset.contractLinks.map((cl) => (
                    <li key={cl.contract.id} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-[var(--muted)]" />
                        {cl.contract.type[0] + cl.contract.type.slice(1).toLowerCase()} · {cl.contract.name}
                      </span>
                      <span className="text-[var(--muted)]">
                        {cl.contract.endAt ? `ends ${formatDate(cl.contract.endAt)}` : ""}
                      </span>
                    </li>
                  ))}
                  {asset.policyLinks.map((pl) => (
                    <li key={pl.policy.id} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-[var(--muted)]" />
                        Insurance · {pl.policy.provider}
                        {pl.policy.policyNo ? ` (${pl.policy.policyNo})` : ""}
                      </span>
                      <span className="text-[var(--muted)]">
                        {pl.policy.endAt ? `renews ${formatDate(pl.policy.endAt)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card>
            <SectionTitle>History</SectionTitle>
            {asset.events.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No events yet.</p>
            ) : (
              <ol className="space-y-2">
                {asset.events.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className="w-28 shrink-0 text-[var(--muted)]">{formatDate(e.at)}</span>
                    <span>{e.summary}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {showActions && asset.status !== "DISPOSED" && asset.status !== "LOST" ? (
            <AssetActions
              assetId={asset.id}
              status={asset.status}
              people={people.map((p) => ({ value: p.id, label: p.name }))}
              sites={sites.map((s) => ({ value: s.id, label: s.name }))}
              locations={locations.map((l) => ({ value: l.id, label: `${l.site.name} › ${l.name}`, siteId: l.siteId }))}
            />
          ) : null}

          <Card>
            <SectionTitle>Tag</SectionTitle>
            {asset.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={asset.photoUrl}
                alt={asset.name}
                className="mb-3 aspect-video w-full rounded-lg border border-[var(--border)] object-cover"
              />
            ) : null}
            <div className="grid place-items-center rounded-lg border border-[var(--border)] bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/barcode?kind=qr&text=${encodeURIComponent(asset.tagId)}`}
                alt={`QR for ${asset.tagId}`}
                className="h-36 w-36"
              />
            </div>
            <div className="mt-2 text-center font-mono text-sm">{asset.tagId}</div>
            <Link href={`/assets/labels?ids=${asset.id}`}>
              <Button variant="secondary" size="sm" className="mt-3 w-full">
                Print label
              </Button>
            </Link>
          </Card>

          {canDelete ? (
            <Card>
              <SectionTitle>Danger zone</SectionTitle>
              <p className="mb-2 text-xs text-[var(--muted)]">
                Deleting removes the asset and its history permanently. Prefer setting status to
                Disposed instead.
              </p>
              <DeleteButton
                id={asset.id}
                action={deleteAsset}
                label="Delete asset"
                confirmText={`Delete "${asset.name}" permanently?`}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function renderFieldValue(fv: {
  valueText: string | null;
  valueNumber: unknown;
  valueDate: Date | null;
  valueBool: boolean | null;
}): React.ReactNode {
  if (fv.valueText != null) return fv.valueText;
  if (fv.valueNumber != null) return String(fv.valueNumber);
  if (fv.valueDate != null) return formatDate(fv.valueDate);
  if (fv.valueBool != null) return fv.valueBool ? "Yes" : "No";
  return "—";
}
