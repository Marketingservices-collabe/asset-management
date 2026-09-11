import Link from "next/link";
import { Download } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, Th, Td, EmptyRow } from "@/components/ui/table";

const PAGE_SIZE = 50;

const ENTITY_TYPES = [
  "Asset",
  "MaintenanceSchedule",
  "MaintenanceRecord",
  "Reservation",
  "Category",
  "Site",
  "Location",
  "Department",
  "Person",
  "Company",
  "CustomFieldDef",
];

type SP = { entity?: string; action?: string; page?: string };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.ACTIVITY_VIEW)) redirect("/dashboard");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ActivityLogWhereInput = { orgId: ctx.orgId };
  if (sp.entity) where.entityType = sp.entity;
  if (sp.action) where.action = { contains: sp.action, mode: "insensitive" };

  const [rows, count] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.activityLog.count({ where }),
  ]);

  const userIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean) as string[])];
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name ?? u.email]));

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const pageLink = (pg: number) => {
    const q = new URLSearchParams();
    if (sp.entity) q.set("entity", sp.entity);
    if (sp.action) q.set("action", sp.action);
    q.set("page", String(pg));
    return `/activity?${q}`;
  };

  return (
    <>
      <PageHeader title="Activity log" description={`${count} recorded action${count === 1 ? "" : "s"}`} />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <select
            name="entity"
            defaultValue={sp.entity ?? ""}
            className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <input
            name="action"
            defaultValue={sp.action ?? ""}
            placeholder="Action contains…"
            className="h-9 w-44 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
          />
          <Button type="submit" size="sm" variant="secondary">
            Filter
          </Button>
          {(sp.entity || sp.action) && (
            <Link href="/activity" className="text-sm text-[var(--muted)] hover:underline">
              Clear
            </Link>
          )}
        </form>
        <a href="/api/reports/activity-log" className="ml-auto">
          <Button size="sm" variant="secondary">
            <Download size={15} /> Export CSV
          </Button>
        </a>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Entity</Th>
            <Th>Action</Th>
            <Th>Reference</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={5}>No activity.</EmptyRow>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-[var(--muted)]">
                  {r.at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </Td>
                <Td>{r.actorId ? nameOf.get(r.actorId) ?? "—" : "System"}</Td>
                <Td>{r.entityType}</Td>
                <Td>
                  <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-xs">{r.action}</span>
                </Td>
                <Td className="font-mono text-xs text-[var(--muted)]">
                  {r.entityType === "Asset" ? (
                    <Link href={`/assets/${r.entityId}`} className="text-brand hover:underline">
                      {r.entityId}
                    </Link>
                  ) : (
                    r.entityId
                  )}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            {page > 1 ? (
              <Link href={pageLink(page - 1)} className="rounded-md border border-[var(--border)] px-2 py-1">
                ← Prev
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={pageLink(page + 1)} className="rounded-md border border-[var(--border)] px-2 py-1">
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
