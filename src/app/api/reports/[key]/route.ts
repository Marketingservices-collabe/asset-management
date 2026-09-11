import { NextRequest } from "next/server";
import { getContext } from "@/lib/session";
import { can } from "@/lib/authz";
import { getReport } from "@/lib/reports/registry";
import type { ReportParams } from "@/lib/reports/types";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await getContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const { key } = await params;
  const report = getReport(key);
  if (!report) return new Response("Not found", { status: 404 });
  if (!can(ctx.permissions, report.permission)) return new Response("Forbidden", { status: 403 });

  const p: ReportParams = {};
  for (const f of report.filters) {
    const v = req.nextUrl.searchParams.get(f);
    if (v) p[f] = v;
  }

  const result = await report.run(ctx.orgId, p);
  const csv = toCsv(
    result.columns.map((c) => c.label),
    result.rows.map((row) => result.columns.map((c) => row[c.key] ?? "")),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.key}-${stamp}.csv"`,
    },
  });
}
