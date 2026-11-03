import Link from "next/link";
import { notFound } from "next/navigation";
import { Wrench, ShieldCheck, ChevronLeft, Pencil, UserRound, Building2, MapPin } from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate, formatMoney } from "@/lib/utils";
import { monthsElapsed } from "@/lib/assets";
import { effectiveStatus } from "@/lib/maintenance";
import { AssetIcon } from "@/components/asset-icon";
import { Avatar } from "@/components/avatar";
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


  // Only show purchase/finance rows that actually have something in them.
  const depreciates = asset.depreciationMethod !== "NONE" && !!asset.usefulLifeMonths;
  const financialRows: [string, React.ReactNode, boolean][] = [
    ["Purchase date", formatDate(asset.purchaseDate), !!asset.purchaseDate],
    ["Cost", formatMoney(asset.purchaseCost ? Number(asset.purchaseCost) : null), asset.purchaseCost != null],
    ["Bought from", asset.supplier?.name ?? "—", !!asset.supplier],
    ["PO number", asset.poNumber ?? "—", !!asset.poNumber],
    ["Fund / grant", asset.fund?.name ?? "—", !!asset.fund],
    ["Depreciation", DEP_LABELS[asset.depreciationMethod] ?? asset.depreciationMethod, depreciates],
    ["Useful life", asset.usefulLifeMonths ? `${asset.usefulLifeMonths} months` : "—", depreciates],
    [
      "Book value",
      asset.bookValue != null
        ? `${formatMoney(Number(asset.bookValue))} · ${monthsElapsed(asset.depreciationStart ?? asset.purchaseDate)} mo elapsed`
        : "—",
      depreciates,
    ],
  ];
  const financials = financialRows.filter(([, , show]) => show).map(([k, val]) => [k, val] as [string, React.ReactNode]);

  const holder = openCheckout?.person?.name ?? asset.assignedPerson?.name ?? null;
  const SPEC_KEYS = ["brand", "model", "processor", "ram", "storage", "screen_size", "condition"];
  const specChips = SPEC_KEYS.flatMap((k) => {
    const fv = asset.fieldValues.find((v) => v.fieldDef.key === k);
    const val = fv?.valueText;
    return val && val !== "Not Sure" ? [[fv!.fieldDef.label, val] as [string, string]] : [];
  });

  const otherFields = asset.fieldValues.filter(
    (fv) => !specChips.some(([label]) => label === fv.fieldDef.label) && renderFieldValue(fv) !== "—",
  );

  return (
    <div className="space-y-6">
      <Link
        href="/assets"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
      >
        <ChevronLeft size={15} /> All assets
      </Link>

      {/* Hero */}
      <Card className="relative overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/[0.06] via-transparent to-transparent" />
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <AssetIcon type={asset.category?.name} name={asset.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
              <StatusBadge status={asset.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
              <span className="font-mono">{asset.tagId}</span>
              {asset.serialNo ? <span>S/N {asset.serialNo}</span> : null}
              {asset.category ? <span>{asset.category.name}</span> : null}
            </div>
            {specChips.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {specChips.map(([label, value]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 px-2.5 py-1 text-xs"
                  >
                    <span className="text-[var(--muted)]">{label}</span>
                    <span className="font-medium">{value}</span>
                  </span>
                ))}
              </div>
            ) : null}
            {asset.description ? <p className="mt-4 text-sm text-[var(--muted)]">{asset.description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit ? <StatusControl id={asset.id} status={asset.status} /> : null}
            {canEdit ? (
              <Link
                href={`/assets/${asset.id}/edit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--card)] px-3 text-sm font-medium hover:bg-[var(--surface-2)]"
              >
                <Pencil size={14} /> Edit
              </Link>
            ) : null}
          </div>
        </div>

        {/* Holder strip */}
        <div className="grid border-t border-[var(--border)] sm:grid-cols-3">
          <div className="flex items-center gap-3 p-5 sm:col-span-1">
            {holder ? (
              <>
                <Avatar name={holder} size="lg" />
                <div className="min-w-0">
                  <div className="text-xs text-[var(--muted)]">{openCheckout ? "Checked out to" : "Assigned to"}</div>
                  <div className="truncate font-medium">{holder}</div>
                  {openCheckout ? (
                    <div className="text-xs text-[var(--muted)]">since {formatDate(openCheckout.checkedOutAt)}</div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <span className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-[var(--border-strong)] text-[var(--muted)]">
                  <UserRound size={18} />
                </span>
                <div>
                  <div className="text-xs text-[var(--muted)]">Assigned to</div>
                  <div className="font-medium">Nobody — spare</div>
                </div>
              </>
            )}
          </div>
          <InfoCell icon={<Building2 size={16} />} label="Department" value={asset.department?.name} />
          <InfoCell
            icon={<MapPin size={16} />}
            label="Location"
            value={[asset.site?.name, asset.location?.name].filter(Boolean).join(" › ") || undefined}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">

          {showFinancials && financials.length > 0 ? (
            <Card>
              <SectionTitle>Purchase</SectionTitle>
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

          {otherFields.length > 0 ? (
            <Card>
              <SectionTitle>Other details</SectionTitle>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {otherFields.map((fv) => (
                  <div key={fv.id} className="flex justify-between gap-4 text-sm">
                    <dt className="text-[var(--muted)]">{fv.fieldDef.label}</dt>
                    <dd className="text-right">{renderFieldValue(fv)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          {asset.maintenance.length > 0 ? (
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
          ) : null}

          {showFinancials && hasCoverage ? (
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
              <ol className="relative ml-3 border-l border-[var(--border)]">
                {asset.events.map((e) => (
                  <li key={e.id} className="relative mb-4 pl-5 text-sm last:mb-0">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-[var(--card)]" />
                    <div className="font-medium">{e.summary}</div>
                    <div className="text-xs text-[var(--muted)]">{formatDate(e.at)}</div>
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
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--border)] p-5 sm:border-l sm:border-t-0">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-[var(--muted)]">{label}</div>
        <div className="truncate font-medium">{value || "—"}</div>
      </div>
    </div>
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
