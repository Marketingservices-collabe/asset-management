import Link from "next/link";
import Image from "next/image";
import { LogOut, Plus, Search } from "lucide-react";
import { requireContext } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notification-bell";
import { Avatar } from "@/components/avatar";

// Every authenticated page is per-request (session + tenant data). Never prerender.
export const dynamic = "force-dynamic";

function Logo() {
  return (
    <Link href="/dashboard" aria-label="ZenTrades — go to dashboard" className="block">
      {/* Black letters + brand-red bar on a transparent background. In dark mode,
          invert + hue-rotate turns the letters light while keeping the bar red. */}
      <Image
        src="/zentrades-logo.webp"
        alt="ZenTrades"
        width={2000}
        height={280}
        priority
        className="h-[18px] w-auto dark:[filter:invert(1)_hue-rotate(180deg)]"
      />
    </Link>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const unread = await db.notification.count({ where: { orgId: ctx.orgId, readAt: null } });
  const displayName = ctx.name ?? ctx.email;
  const canSearch = can(ctx.permissions, PERMISSIONS.ASSET_VIEW);
  const canCreate = can(ctx.permissions, PERMISSIONS.ASSET_CREATE);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-16 shrink-0 items-center px-6">
          <Logo />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Sidebar permissions={ctx.permissions} />
        </div>
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--surface-2)]">
            <Link href="/account" className="flex min-w-0 flex-1 items-center gap-3" title="Account settings">
              <Avatar name={displayName} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-medium">{displayName}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{ctx.roleName}</span>
              </span>
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/80 px-4 backdrop-blur sm:px-6">
          <MobileNav permissions={ctx.permissions} logo={<Logo />} />
          <div className="hidden sm:block lg:hidden">
            <Logo />
          </div>

          {canSearch ? (
            <form action="/assets" method="get" role="search" className="relative ml-auto w-full max-w-md lg:ml-0">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                name="q"
                type="search"
                placeholder="Search devices, people, serial numbers…"
                aria-label="Search assets"
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] pl-9 pr-3 text-sm outline-none transition placeholder:text-[var(--muted)] focus:border-brand/40 focus:bg-[var(--surface)] focus:ring-4 focus:ring-brand/10"
              />
            </form>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {canCreate ? (
              <Link
                href="/assets/new"
                className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-fg shadow-[var(--shadow)] transition hover:bg-brand-dark sm:inline-flex"
              >
                <Plus size={16} /> Add asset
              </Link>
            ) : null}
            <NotificationBell count={unread} />
            <Link href="/account" className="lg:hidden" title="Account" aria-label="Account">
              <Avatar name={displayName} size="sm" />
            </Link>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl animate-fade-up p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
