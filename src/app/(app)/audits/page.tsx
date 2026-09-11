import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate } from "@/lib/utils";
import { scopeLabel } from "@/lib/audit";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { AuditForm } from "./audit-form";

const BASE = "/audits";

export default async function AuditsPage({ searchParams }: { searchParams: Promise<{ form?: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.AUDIT_RUN)) redirect("/dashboard");
  const sp = await searchParams;

  const [sites, locations, categories, audits] = await Promise.all([
    db.site.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, site: { select: { name: true } } },
    }),
    db.category.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.audit.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { startedAt: "desc" },
      include: { _count: { select: { scans: true } } },
    }),
  ]);

  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const locFullName = new Map(locations.map((l) => [l.id, l.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  if (sp.form) {
    return (
      <>
        <PageHeader title="New audit" back={{ label: "Audits", href: BASE }} />
        <Card className="max-w-2xl">
          <AuditForm
            sites={sites.map((s) => ({ value: s.id, label: s.name }))}
            locations={locations.map((l) => ({ value: l.id, label: `${l.site.name} › ${l.name}` }))}
            categories={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Audits"
        description="Walk the floor, scan tags, reconcile what's found against what's on record."
        action={{ label: "New audit", href: `${BASE}?form=1` }}
      />
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Scope</Th>
            <Th className="text-right">Scans</Th>
            <Th>Started</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {audits.length === 0 ? (
            <EmptyRow colSpan={5}>No audits yet.</EmptyRow>
          ) : (
            audits.map((a) => (
              <TrLink key={a.id}>
                <Td>
                  <Link href={`${BASE}/${a.id}`} className="font-medium text-brand hover:underline">
                    {a.name}
                  </Link>
                </Td>
                <Td className="text-[var(--muted)]">
                  {scopeLabel(a, {
                    site: a.siteId ? siteName.get(a.siteId) : undefined,
                    location: a.locationId ? locFullName.get(a.locationId) : undefined,
                    category: a.categoryId ? catName.get(a.categoryId) : undefined,
                  })}
                </Td>
                <Td className="text-right tabular-nums">{a._count.scans}</Td>
                <Td>{formatDate(a.startedAt)}</Td>
                <Td>
                  <StatusBadge status={a.status === "OPEN" ? "ACTIVE" : "SKIPPED"} />
                </Td>
              </TrLink>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
