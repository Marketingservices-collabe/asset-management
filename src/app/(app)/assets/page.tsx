import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, Download, Printer, Plus, Search, X } from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { ASSET_STATUSES } from "@/lib/assets";
import { StatusBadge } from "@/components/status-badge";
import { AssetIcon } from "@/components/asset-icon";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { SavedViews } from "./saved-views";

const PAGE_SIZE = 25;

type SP = { q?: string; category?: string; site?: string; status?: string; department?: string; page?: string };

/** Status tabs across the top of the list; "LOST" and "UNDER_REPAIR" get their own tabs. */
const TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "CHECKED_OUT", label: "With people" },
  { key: "AVAILABLE", label: "Spare" },
  { key: "UNDER_REPAIR", label: "In repair" },
  { key: "LOST", label: "Lost" },
];

export default async function AssetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const canCreate = can(ctx.permissions, PERMISSIONS.ASSET_CREATE);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status && ASSET_STATUSES.includes(sp.status as (typeof ASSET_STATUSES)[number]) ? sp.status : "";

  // Filters other than status — the tab counts respect these.
  const base: Prisma.AssetWhereInput = { orgId: ctx.orgId };
  if (sp.q) {
    base.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { tagId: { contains: sp.q, mode: "insensitive" } },
      { serialNo: { contains: sp.q, mode: "insensitive" } },
      { assignedPerson: { name: { contains: sp.q, mode: "insensitive" } } },
      { fieldValues: { some: { valueText: { contains: sp.q, mode: "insensitive" } } } },
    ];
  }
  if (sp.category) base.categoryId = sp.category;
  if (sp.site) base.siteId = sp.site;
  if (sp.department) base.departmentId = sp.department;
  const where: Prisma.AssetWhereInput = status ? { ...base, status: status as (typeof ASSET_STATUSES)[number] } : base;

  const [assets, count, statusCounts, categories, catCounts, departments, sites, savedViews] = await Promise.all([
    db.asset.findMany({
      where,
      orderBy: [{ tagId: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        location: { select: { name: true } },
        assignedPerson: { select: { name: true } },
        department: { select: { name: true } },
        fieldValues: {
          where: { fieldDef: { key: { in: ["brand", "model", "ram", "storage"] } } },
          select: { valueText: true, fieldDef: { select: { key: true } } },
        },
      },
    }),
    db.asset.count({ where }),
    db.asset.groupBy({ by: ["status"], where: base, _count: true }),
    db.category.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.asset.groupBy({ by: ["categoryId"], where: { orgId: ctx.orgId }, _count: true }),
    db.department.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.site.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.savedView.findMany({ where: { orgId: ctx.orgId, userId: ctx.userId, entity: "ASSET" }, orderBy: { name: "asc" } }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]));
  const allCount = statusCounts.reduce((n, s) => n + s._count, 0);
  const perCat = new Map(catCounts.map((c) => [c.categoryId, c._count]));

  const currentQs = new URLSearchParams();
  for (const k of ["q", "category", "site", "status", "department"] as const) if (sp[k]) currentQs.set(k, sp[k]!);
  const currentQuery = currentQs.toString();
  const activeView = savedViews.find((v) => new URLSearchParams(v.configJson as Record<string, string>).toString() === currentQuery);
  const hasFilters = !!(sp.q || sp.category || sp.site || sp.department || status);

  /** Link to this page with some params changed (and page reset unless given). */
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams(currentQs);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!("page" in patch)) p.delete("page");
    const s = p.toString();
    return s ? `/assets?${s}` : "/assets";
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const from = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(count, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {allCount} device{allCount === 1 ? "" : "s"}
            {hasFilters ? " match your filters" : " in total"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/reports/asset-register?${new URLSearchParams({
              ...(sp.category ? { categoryId: sp.category } : {}),
              ...(sp.site ? { siteId: sp.site } : {}),
              ...(status ? { status } : {}),
            }).toString()}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-4 text-sm font-medium shadow-[var(--shadow)] transition hover:bg-[var(--surface-2)]"
          >
            <Download size={16} /> Export
          </a>
          {canCreate ? (
            <Link
              href="/assets/new"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-brand-fg shadow-[var(--shadow)] transition hover:bg-brand-dark sm:hidden"
            >
              <Plus size={16} /> Add asset
            </Link>
          ) : null}
        </div>
      </div>

      {/* Type chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip href={href({ category: "" })} active={!sp.category}>
          All types <span className="text-[var(--muted)]">{[...perCat.values()].reduce((a, b) => a + b, 0)}</span>
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} href={href({ category: c.id })} active={sp.category === c.id}>
            <AssetIcon type={c.name} size="sm" className="-ml-1 h-6 w-6 rounded-md" />
            {c.name} <span className="text-[var(--muted)]">{perCat.get(c.id) ?? 0}</span>
          </Chip>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 pt-2">
          {TABS.map((t) => {
            const n = t.key ? byStatus[t.key] ?? 0 : allCount;
            const active = status === t.key;
            return (
              <Link
                key={t.key || "all"}
                href={href({ status: t.key })}
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-2 px-3 pb-3 pt-2 text-sm font-medium transition-colors",
                  active ? "text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                    active ? "bg-brand text-brand-fg" : "bg-[var(--surface-2)] text-[var(--muted)]",
                  )}
                >
                  {n}
                </span>
                {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" /> : null}
              </Link>
            );
          })}
        </div>

        {/* Search + filters */}
        <form method="get" className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
          <div className="relative min-w-[14rem] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search tag, name, serial, person, brand…"
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <select
            name="department"
            defaultValue={sp.department ?? ""}
            className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:ring-4 focus:ring-brand/10"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {sites.length > 1 ? (
            <select
              name="site"
              defaultValue={sp.site ?? ""}
              className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:ring-4 focus:ring-brand/10"
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="submit"
            className="h-10 rounded-xl bg-[var(--fg)] px-4 text-sm font-medium text-[var(--bg)] transition hover:opacity-90"
          >
            Search
          </button>
          {hasFilters ? (
            <Link href="/assets" className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]">
              <X size={14} /> Clear
            </Link>
          ) : null}
        </form>

        {savedViews.length > 0 || hasFilters ? (
          <div className="border-b border-[var(--border)] px-4 pt-3">
            <SavedViews
              views={savedViews.map((v) => ({ id: v.id, name: v.name, config: v.configJson as Record<string, string> }))}
              currentQuery={currentQuery}
              activeName={activeView?.name}
            />
          </div>
        ) : null}

        {/* Rows */}
        <form method="get" action="/assets/labels">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-[var(--muted)]">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-3 py-3 font-medium">Device</th>
                  <th className="px-3 py-3 font-medium">Assigned to</th>
                  <th className="hidden px-3 py-3 font-medium md:table-cell">Tag</th>
                  <th className="hidden px-3 py-3 font-medium xl:table-cell">Location</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="w-8 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="mx-auto max-w-xs">
                        <div className="text-base font-medium">No devices found</div>
                        <p className="mt-1 text-sm text-[var(--muted)]">Try a different search or clear the filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  assets.map((a) => {
                    const fv = (k: string) => a.fieldValues.find((v) => v.fieldDef.key === k)?.valueText ?? "";
                    const model = fv("model") === "Not Sure" || fv("model") === fv("brand") ? "" : fv("model");
                    const spec = [fv("brand"), model, fv("ram"), fv("storage")].filter(Boolean).join(" · ");
                    return (
                      <tr key={a.id} className="group border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/60">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            name="ids"
                            value={a.id}
                            aria-label={`Select ${a.tagId}`}
                            className="h-4 w-4 rounded border-[var(--border-strong)] accent-[#ee5566]"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/assets/${a.id}`} className="flex items-center gap-3">
                            <AssetIcon type={a.category?.name} name={a.name} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium group-hover:text-brand">{a.name}</span>
                              <span className="block max-w-[22rem] truncate text-xs text-[var(--muted)]">
                                {spec || a.category?.name || "—"}
                                <span className="md:hidden"> · {a.tagId}</span>
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          {a.assignedPerson ? (
                            <span className="flex items-center gap-2.5">
                              <Avatar name={a.assignedPerson.name} size="sm" />
                              <span className="min-w-0">
                                <span className="block truncate">{a.assignedPerson.name}</span>
                                <span className="block truncate text-xs text-[var(--muted)]">{a.department?.name ?? ""}</span>
                              </span>
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">
                              Unassigned
                              {a.department ? <span className="block text-xs">{a.department.name}</span> : null}
                            </span>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-3 font-mono text-xs text-[var(--muted)] md:table-cell">{a.tagId}</td>
                        <td className="hidden whitespace-nowrap px-3 py-3 text-[var(--muted)] xl:table-cell">{a.location?.name ?? "—"}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-3 py-3 text-[var(--muted)]">
                          <Link href={`/assets/${a.id}`} aria-label={`Open ${a.tagId}`}>
                            <ChevronRight size={16} className="transition group-hover:translate-x-0.5 group-hover:text-[var(--fg)]" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-sm">
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--card)] px-3 text-[13px] font-medium hover:bg-[var(--surface-2)]"
            >
              <Printer size={15} /> Print labels for selected
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[var(--muted)]">
                {from}–{to} of {count}
              </span>
              <div className="flex gap-1">
                <PageBtn href={page > 1 ? href({ page: String(page - 1) }) : undefined} label="Previous page">
                  <ChevronLeft size={16} />
                </PageBtn>
                <span className="grid h-9 min-w-9 place-items-center rounded-lg px-2 text-[13px] tabular-nums text-[var(--muted)]">
                  {page} / {totalPages}
                </span>
                <PageBtn href={page < totalPages ? href({ page: String(page + 1) }) : undefined} label="Next page">
                  <ChevronRight size={16} />
                </PageBtn>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition",
        active
          ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)] [&_span]:text-[var(--bg)]/70"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]",
      )}
    >
      {children}
    </Link>
  );
}

function PageBtn({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  const cls = "grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)]";
  return href ? (
    <Link href={href} aria-label={label} className={cn(cls, "hover:bg-[var(--surface-2)]")}>
      {children}
    </Link>
  ) : (
    <span aria-disabled="true" className={cn(cls, "opacity-40")}>
      {children}
    </span>
  );
}
