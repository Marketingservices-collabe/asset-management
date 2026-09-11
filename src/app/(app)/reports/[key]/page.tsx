import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can } from "@/lib/authz";
import { getReport } from "@/lib/reports/registry";
import type { ReportFilterKey, ReportParams } from "@/lib/reports/types";
import { ASSET_STATUSES, STATUS_LABELS } from "@/lib/assets";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, Th, Td, EmptyRow } from "@/components/ui/table";
import { PrintButton } from "@/components/print-button";

const MONEY_KEYS = new Set(["cost", "book", "salvage", "accum", "proceeds", "purchase value", "value"]);

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const ctx = await requireContext();
  const { key } = await params;
  const report = getReport(key);
  if (!report) notFound();
  if (!can(ctx.permissions, report.permission)) redirect("/reports");

  const sp = await searchParams;
  const p: ReportParams = {};
  for (const f of report.filters) if (sp[f]) p[f] = sp[f];

  const needsCats = report.filters.includes("categoryId");
  const needsSites = report.filters.includes("siteId");
  const needsPeople = report.filters.includes("personId");
  const [categories, sites, people] = await Promise.all([
    needsCats ? db.category.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    needsSites ? db.site.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    needsPeople ? db.person.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
  ]);

  const result = await report.run(ctx.orgId, p);

  const qs = new URLSearchParams(p as Record<string, string>).toString();
  const csvHref = `/api/reports/${report.key}${qs ? `?${qs}` : ""}`;

  return (
    <>
      <PageHeader
        title={report.name}
        description={report.description}
        back={{ label: "Reports", href: "/reports" }}
      />

      {report.filters.length > 0 ? (
        <form method="get" className="mb-4 flex flex-wrap items-end gap-2 print:hidden">
          {report.filters.map((f) => (
            <FilterInput
              key={f}
              f={f}
              value={sp[f] ?? ""}
              categories={categories}
              sites={sites}
              people={people}
            />
          ))}
          <Button type="submit" size="sm" variant="secondary">
            Run
          </Button>
          {report.filters.some((f) => sp[f]) ? (
            <Link href={`/reports/${report.key}`} className="text-sm text-[var(--muted)] hover:underline">
              Clear
            </Link>
          ) : null}
        </form>
      ) : null}

      <div className="mb-3 flex items-center justify-between print:hidden">
        <div className="text-sm text-[var(--muted)]">
          {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
        </div>
        <div className="flex gap-2">
          <a href={csvHref}>
            <Button size="sm" variant="secondary">
              <Download size={15} /> CSV
            </Button>
          </a>
          <PrintButton>Print / PDF</PrintButton>
        </div>
      </div>

      <div className="hidden print:mb-3 print:block">
        <h1 className="text-lg font-semibold">{report.name}</h1>
        <p className="text-sm text-[var(--muted)]">
          {ctx.orgName} · generated {new Date().toLocaleString("en-US")}
        </p>
      </div>

      <Table>
        <thead>
          <tr>
            {result.columns.map((c) => (
              <Th key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                {c.label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <EmptyRow colSpan={result.columns.length}>No data for these filters.</EmptyRow>
          ) : (
            result.rows.map((row, i) => (
              <tr key={i}>
                {result.columns.map((c) => {
                  const v = row[c.key];
                  const money = c.align === "right" && MONEY_KEYS.has(c.key);
                  return (
                    <Td key={c.key} className={c.align === "right" ? "text-right tabular-nums" : undefined}>
                      {v == null || v === ""
                        ? "—"
                        : money && typeof v === "number"
                          ? formatMoney(v)
                          : typeof v === "number"
                            ? v.toLocaleString("en-US")
                            : v}
                    </Td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {result.note ? <p className="mt-3 text-sm text-[var(--muted)]">{result.note}</p> : null}
    </>
  );
}

function FilterInput({
  f,
  value,
  categories,
  sites,
  people,
}: {
  f: ReportFilterKey;
  value: string;
  categories: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  people: { id: string; name: string }[];
}) {
  const cls = "h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm";
  if (f === "dateFrom" || f === "dateTo")
    return (
      <label className="text-sm">
        <span className="mb-1 block text-xs text-[var(--muted)]">{f === "dateFrom" ? "From" : "To"}</span>
        <input type="date" name={f} defaultValue={value} className={cls} />
      </label>
    );
  if (f === "categoryId")
    return (
      <select name={f} defaultValue={value} className={cls}>
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    );
  if (f === "siteId")
    return (
      <select name={f} defaultValue={value} className={cls}>
        <option value="">All sites</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    );
  if (f === "personId")
    return (
      <select name={f} defaultValue={value} className={cls}>
        <option value="">Anyone</option>
        {people.map((pp) => (
          <option key={pp.id} value={pp.id}>
            {pp.name}
          </option>
        ))}
      </select>
    );
  if (f === "status")
    return (
      <select name={f} defaultValue={value} className={cls}>
        <option value="">Any status</option>
        {ASSET_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    );
  return null;
}
