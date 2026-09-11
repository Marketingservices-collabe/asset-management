"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveView, deleteView } from "./views-actions";

type View = { id: string; name: string; config: Record<string, string> };

export function SavedViews({
  views,
  currentQuery,
  activeName,
}: {
  views: View[];
  currentQuery: string;
  activeName?: string;
}) {
  const [saving, setSaving] = useState(false);
  const hasFilters = currentQuery.length > 0;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
      <Bookmark size={14} className="text-[var(--muted)]" />
      <Link
        href="/assets"
        className={`rounded-md px-2 py-0.5 ${!activeName && !hasFilters ? "bg-brand text-brand-fg" : "hover:bg-[var(--surface-2)]"}`}
      >
        All assets
      </Link>
      {views.map((v) => {
        const qs = new URLSearchParams(v.config).toString();
        return (
          <span key={v.id} className="inline-flex items-center gap-0.5">
            <Link
              href={`/assets?${qs}`}
              className={`rounded-md px-2 py-0.5 ${activeName === v.name ? "bg-brand text-brand-fg" : "hover:bg-[var(--surface-2)]"}`}
            >
              {v.name}
            </Link>
            <form action={deleteView}>
              <input type="hidden" name="id" value={v.id} />
              <button className="text-[var(--muted)] hover:text-red-600" title="Delete view" aria-label="Delete view">
                <X size={11} />
              </button>
            </form>
          </span>
        );
      })}
      {hasFilters && !activeName ? (
        saving ? (
          <form action={saveView} className="inline-flex items-center gap-1">
            <input type="hidden" name="query" value={currentQuery} />
            <input
              name="name"
              autoFocus
              placeholder="View name"
              className="h-7 w-28 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
            />
            <Button type="submit" size="sm" variant="secondary">
              Save
            </Button>
          </form>
        ) : (
          <button onClick={() => setSaving(true)} className="rounded-md px-2 py-0.5 text-brand hover:bg-[var(--surface-2)]">
            + Save current filters
          </button>
        )
      ) : null}
    </div>
  );
}
