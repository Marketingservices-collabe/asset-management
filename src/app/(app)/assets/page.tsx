import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { STATUS_LABELS, ASSET_STATUSES } from "@/lib/assets";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Download } from "lucide-react";
import { SavedViews } from "./saved-views";

const PAGE_SIZE = 25;

type SP = {
  q?: string;
  category?: string;
  site?: string;
  status?: string;
  page?: string;
};

export default async function AssetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const canCreate = can(ctx.permissions, PERMISSIONS.ASSET_CREATE);
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.AssetWhereInput = { orgId: ctx.orgId };
  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { tagId: { contains: sp.q, mode: "insensitive" } },
      { serialNo: { contains: sp.q, mode: "insensitive" } },
    ];
  }
  if (sp.category) where.categoryId = sp.category;
  if (sp.site) where.siteId = sp.site;
  if (sp.status && ASSET_STATUSES.includes(sp.status as (typeof ASSET_STATUSES)[number]))
    where.status = sp.status as (typeof ASSET_STATUSES)[number];

  const [assets, count, categories, sites] = await Promise.all([
    db.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        site: { select: { name: true } },
        location: { select: { name: true } },
        assignedPerson: { select: { name: true } },
      },
    }),
    db.asset.count({ where }),
    db.category.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.site.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const savedViews = await db.savedView.findMany({
    where: { orgId: ctx.orgId, userId: ctx.userId, entity: "ASSET" },
    orderBy: { name: "asc" },
  });
  const currentQs = new URLSearchParams();
  for (const k of ["q", "category", "site", "status"] as const) if (sp[k]) currentQs.set(k, sp[k]!);
  const currentQuery = currentQs.toString();
  const activeView = savedViews.find((v) => new URLSearchParams(v.configJson as Record<string, string>).toString() === currentQuery);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.category) params.set("category", sp.category);
    if (sp.site) params.set("site", sp.site);
    if (sp.status) params.set("status", sp.status);
    params.set("page", String(p));
    return `/assets?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Assets"
        description={`${count} asset${count === 1 ? "" : "s"}`}
        action={canCreate ? { label: "Add asset", href: "/assets/new" } : undefined}
      />

      <SavedViews
        views={savedViews.map((v) => ({ id: v.id, name: v.name, config: v.configJson as Record<string, string> }))}
        currentQuery={currentQuery}
        activeName={activeView?.name}
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, tag, serial…"
          className="h-9 w-60 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm outline-none focus:ring-2 focus:ring-brand/30"
        />
        <select name="category" defaultValue={sp.category ?? ""} className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="site" defaultValue={sp.site ?? ""} className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm">
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm">
          <option value="">Any status</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary">
          Filter
        </Button>
        {(sp.q || sp.category || sp.site || sp.status) && (
          <Link href="/assets" className="text-sm text-[var(--muted)] hover:underline">
            Clear
          </Link>
        )}
      </form>

      <form method="get" action="/assets/labels">
        <Table>
          <thead>
            <tr>
              <Th className="w-8"></Th>
              <Th>Tag</Th>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Location</Th>
              <Th>Assigned</Th>
              <Th>Status</Th>
              <Th className="text-right">Book value</Th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <EmptyRow colSpan={8}>No assets match.</EmptyRow>
            ) : (
              assets.map((a) => (
                <TrLink key={a.id}>
                  <Td>
                    <input type="checkbox" name="ids" value={a.id} aria-label={`Select ${a.tagId}`} />
                  </Td>
                  <Td className="font-mono text-xs">
                    <Link href={`/assets/${a.id}`} className="text-brand hover:underline">
                      {a.tagId}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/assets/${a.id}`} className="hover:underline">
                      {a.name}
                    </Link>
                  </Td>
                  <Td>{a.category?.name ?? "—"}</Td>
                  <Td>{[a.site?.name, a.location?.name].filter(Boolean).join(" › ") || "—"}</Td>
                  <Td>{a.assignedPerson?.name ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(a.bookValue ? Number(a.bookValue) : null)}</Td>
                </TrLink>
              ))
            )}
          </tbody>
        </Table>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="secondary">
              Print selected labels
            </Button>
            <a
              href={`/api/reports/asset-register?${new URLSearchParams({
                ...(sp.category ? { categoryId: sp.category } : {}),
                ...(sp.site ? { siteId: sp.site } : {}),
                ...(sp.status ? { status: sp.status } : {}),
              }).toString()}`}
            >
              <Button type="button" size="sm" variant="secondary">
                <Download size={14} /> Export CSV
              </Button>
            </a>
          </div>
          <div className="flex items-center gap-3">
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
        </div>
      </form>
    </>
  );
}
