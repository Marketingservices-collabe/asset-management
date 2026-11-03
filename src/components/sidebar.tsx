"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NAV, NAV_GROUPS, type NavItem } from "@/components/nav-items";
import { can } from "@/lib/authz";
import { cn } from "@/lib/utils";

/**
 * Everyday items sit at the top. Everything else (finance, maintenance, audits,
 * setup, admin) is folded under "More tools", which opens by itself when the
 * current page lives inside it.
 */
export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const visible = NAV.filter((i) => !i.perm || can(permissions, i.perm));
  const primary = visible.filter((i) => i.primary);
  const more = visible.filter((i) => !i.primary);
  const isActive = (i: NavItem) => pathname === i.href || pathname.startsWith(i.href + "/");
  const [open, setOpen] = useState(() => more.some(isActive));

  return (
    <nav className="flex flex-col gap-4 px-3 py-4 text-sm">
      <ul className="space-y-0.5">
        {primary.map((i) => (
          <NavLink key={i.href} item={i} active={isActive(i)} />
        ))}
      </ul>

      {more.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--fg)]"
          >
            <ChevronRight size={14} className={cn("transition-transform", open && "rotate-90")} />
            More tools
          </button>
          {open ? (
            <div className="mt-2 flex flex-col gap-4">
              {NAV_GROUPS.map((group) => {
                const items = more.filter((i) => i.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]/80">
                      {group}
                    </div>
                    <ul className="space-y-0.5">
                      {items.map((i) => (
                        <NavLink key={i.href} item={i} active={isActive(i)} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors",
          active
            ? "bg-brand/10 font-medium text-brand dark:bg-brand/15"
            : "text-[var(--fg)]/75 hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
        )}
      >
        <Icon
          size={17}
          strokeWidth={active ? 2.2 : 1.9}
          className={cn("shrink-0", active ? "text-brand" : "text-[var(--muted)] group-hover:text-[var(--fg)]")}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}
