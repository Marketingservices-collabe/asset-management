"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, NAV_GROUPS } from "@/components/nav-items";
import { can } from "@/lib/authz";
import { cn } from "@/lib/utils";

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const visible = NAV.filter((i) => !i.perm || can(permissions, i.perm));

  return (
    <nav className="flex flex-col gap-5 p-3 text-sm">
      {NAV_GROUPS.map((group) => {
        const items = visible.filter((i) => i.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              {group}
            </div>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const active = pathname === i.href || pathname.startsWith(i.href + "/");
                const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors",
                        active
                          ? "bg-brand text-brand-fg shadow-[var(--shadow)]"
                          : "text-[var(--fg)]/80 hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                      )}
                    >
                      <Icon
                        size={16}
                        className={cn(
                          "shrink-0",
                          active ? "text-brand-fg" : "text-[var(--muted)] group-hover:text-[var(--fg)]",
                        )}
                      />
                      <span className="truncate">{i.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
