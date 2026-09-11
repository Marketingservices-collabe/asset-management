import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate } from "@/lib/utils";
import { scopeWhere, scopeLabel } from "@/lib/audit";
import { PageHeader } from "@/components/page-header";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { DeleteButton } from "@/components/crud/delete-button";
import { Table, Th, Td, EmptyRow } from "@/components/ui/table";
import { ScanBox } from "./scan-box";
import { closeAudit, reopenAudit, applyMoves, deleteAudit } from "../actions";

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.AUDIT_RUN)) redirect("/dashboard");
  const { id } = await params;

  const audit = await db.audit.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      scans: {
        orderBy: { scannedAt: "desc" },
        include: { asset: { select: { id: true, tagId: true, name: true, location: { select: { name: true } } } } },
      },
    },
  });
  if (!audit) notFound();

  const open = audit.status === "OPEN";
  const canEdit = can(ctx.permissions, PERMISSIONS.ASSET_EDIT);

  const [inScope, locations] = await Promise.all([
    db.asset.findMany({
      where: scopeWhere(ctx.orgId, audit),
      select: { id: true, tagId: true, name: true, location: { select: { name: true } } },
      orderBy: { tagId: "asc" },
    }),
    db.location.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, site: { select: { name: true } } },
    }),
  ]);

  const locName = new Map(locations.map((l) => [l.id, `${l.site.name} › ${l.name}`]));

  const [scopeSite, scopeCategory] = await Promise.all([
    audit.siteId ? db.site.findUnique({ where: { id: audit.siteId }, select: { name: true } }) : null,
    audit.categoryId ? db.category.findUnique({ where: { id: audit.categoryId }, select: { name: true } }) : null,
  ]);
  const scopeNames = {
    site: scopeSite?.name,
    location: audit.locationId ? locations.find((l) => l.id === audit.locationId)?.name : undefined,
    category: scopeCategory?.name,
  };
  const scannedIds = new Set(audit.scans.filter((s) => s.assetId).map((s) => s.assetId!));

  const found = audit.scans.filter((s) => s.result === "FOUND");
  const moved = audit.scans.filter((s) => s.result === "MOVED");
  const unexpected = audit.scans.filter((s) => s.result === "UNEXPECTED");
  const missing = inScope.filter((a) => !scannedIds.has(a.id));

  return (
    <>
      <PageHeader
        title={audit.name}
        description={scopeLabel(audit, scopeNames)}
        back={{ label: "Audits", href: "/audits" }}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={open ? "ACTIVE" : "SKIPPED"} />
        <span className="text-sm text-[var(--muted)]">
          Started {formatDate(audit.startedAt)}
          {audit.closedAt ? ` · closed ${formatDate(audit.closedAt)}` : ""}
        </span>
        <div className="ml-auto flex gap-2 print:hidden">
          {open ? (
            <form action={closeAudit}>
              <input type="hidden" name="id" value={audit.id} />
              <Button size="sm" type="submit">
                Close audit
              </Button>
            </form>
          ) : (
            <form action={reopenAudit}>
              <input type="hidden" name="id" value={audit.id} />
              <Button size="sm" type="submit" variant="secondary">
                Reopen
              </Button>
            </form>
          )}
          {moved.length > 0 && canEdit ? (
            <form action={applyMoves}>
              <input type="hidden" name="id" value={audit.id} />
              <Button size="sm" type="submit" variant="secondary">
                Apply {moved.length} move{moved.length === 1 ? "" : "s"}
              </Button>
            </form>
          ) : null}
          <DeleteButton id={audit.id} action={deleteAudit} label="Delete" confirmText="Delete this audit and its scans?" />
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="In scope" value={inScope.length} />
        <Stat label="Accounted for" value={found.length + moved.length} />
        <Stat label="Missing" value={missing.length} accent={missing.length > 0} />
        <Stat label="Unexpected" value={unexpected.length} accent={unexpected.length > 0} />
      </div>

      {open ? (
        <div className="mb-6 max-w-xl">
          <ScanBox
            auditId={audit.id}
            locations={locations.map((l) => ({ value: l.id, label: `${l.site.name} › ${l.name}` }))}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ReconTable title={`Missing (${missing.length})`} empty="Nothing missing.">
          {missing.map((a) => (
            <tr key={a.id}>
              <Td className="font-mono text-xs">
                <Link href={`/assets/${a.id}`} className="text-brand hover:underline">
                  {a.tagId}
                </Link>
              </Td>
              <Td>{a.name}</Td>
              <Td className="text-[var(--muted)]">{a.location?.name ?? "—"}</Td>
            </tr>
          ))}
        </ReconTable>

        <ReconTable title={`Moved (${moved.length})`} empty="No location mismatches.">
          {moved.map((s) => (
            <tr key={s.id}>
              <Td className="font-mono text-xs">{s.asset?.tagId ?? s.rawTag}</Td>
              <Td>{s.asset?.name ?? "—"}</Td>
              <Td className="text-[var(--muted)]">
                {s.asset?.location?.name ?? "—"} → {s.foundLocationId ? locName.get(s.foundLocationId) : "?"}
              </Td>
            </tr>
          ))}
        </ReconTable>

        <ReconTable title={`Unexpected (${unexpected.length})`} empty="No surprises.">
          {unexpected.map((s) => (
            <tr key={s.id}>
              <Td className="font-mono text-xs">{s.rawTag}</Td>
              <Td>{s.asset?.name ?? "Unknown tag"}</Td>
              <Td className="text-[var(--muted)]">{formatDate(s.scannedAt)}</Td>
            </tr>
          ))}
        </ReconTable>

        <ReconTable title={`Accounted for (${found.length})`} empty="Nothing scanned yet.">
          {found.map((s) => (
            <tr key={s.id}>
              <Td className="font-mono text-xs">{s.asset?.tagId ?? s.rawTag}</Td>
              <Td>{s.asset?.name ?? "—"}</Td>
              <Td className="text-[var(--muted)]">{formatDate(s.scannedAt)}</Td>
            </tr>
          ))}
        </ReconTable>
      </div>
    </>
  );
}

function ReconTable({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children : [children];
  const hasRows = rows.some((r) => r);
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {!hasRows ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Tag</Th>
              <Th>Asset</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </Table>
      )}
    </Card>
  );
}
