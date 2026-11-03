import { Loader2 } from "lucide-react";

/**
 * Shown instantly while any page inside the app is loading (Next.js streams it
 * in place of the page). The sidebar and header stay visible; only the content
 * area shows a spinner and placeholder blocks.
 */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Loader2 size={16} className="animate-spin text-brand" />
        Loading…
      </div>

      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-md bg-[var(--surface-2)]" />
          <div className="h-4 w-72 rounded-md bg-[var(--surface-2)]" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 h-4 w-40 rounded-md bg-[var(--surface-2)]" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 rounded-md bg-[var(--surface-2)]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
