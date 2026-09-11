import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireContext } from "@/lib/session";
import { can } from "@/lib/authz";
import { REPORTS } from "@/lib/reports/registry";
import type { ReportGroup } from "@/lib/reports/types";
import { PageHeader } from "@/components/page-header";
import { Card, SectionTitle } from "@/components/ui/card";

const GROUPS: ReportGroup[] = ["Assets", "Custody", "Maintenance", "Finance", "Inventory"];

export default async function ReportsPage() {
  const ctx = await requireContext();
  const visible = REPORTS.filter((r) => can(ctx.permissions, r.permission));

  return (
    <>
      <PageHeader title="Reports" description="Parameterized reports. Export any result to CSV or print to PDF." />

      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = visible.filter((r) => r.group === g);
          if (items.length === 0) return null;
          return (
            <div key={g}>
              <SectionTitle>{g}</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r) => (
                  <Link key={r.key} href={`/reports/${r.key}`}>
                    <Card className="group h-full transition-colors hover:border-[var(--border-strong)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{r.name}</div>
                        <ArrowRight
                          size={16}
                          className="mt-0.5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5"
                        />
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">{r.description}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
