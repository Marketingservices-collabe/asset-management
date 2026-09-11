import Link from "next/link";
import { NAV } from "@/components/nav-items";
import { Card } from "@/components/ui/card";

/**
 * Placeholder for routes that are planned in the sidebar but not built yet (M1+).
 * Real pages under (app)/<section>/page.tsx take precedence over this catch-all.
 */
export default async function ComingSoon({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const href = "/" + slug.join("/");
  const item = NAV.find((n) => n.href === href);
  const title = item?.label ?? slug.join(" / ");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      <Card>
        <p className="text-sm text-[var(--muted)]">
          This section isn&apos;t built yet. The scaffold (M0) ships the dashboard and the
          navigation shell; <span className="font-medium">{title}</span> lands in an upcoming
          milestone (see <code>ARCHITECTURE.md</code> → milestone plan).
        </p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-brand underline">
          ← Back to dashboard
        </Link>
      </Card>
    </div>
  );
}
