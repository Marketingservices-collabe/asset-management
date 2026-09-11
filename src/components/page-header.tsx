import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  back?: { label: string; href: string };
}) {
  return (
    <div className="mb-6">
      {back ? (
        <Link
          href={back.href}
          className="mb-1 inline-flex items-center gap-1 text-sm text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
        >
          <ChevronLeft size={14} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p> : null}
        </div>
        {action ? (
          <Link href={action.href}>
            <Button size="sm">{action.label}</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
