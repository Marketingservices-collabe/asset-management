import Link from "next/link";
import { requireContext } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";

// Every authenticated page is per-request (session + tenant data). Never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const unread = await db.notification.count({ where: { orgId: ctx.orgId, readAt: null } });
  const initials = (ctx.name ?? ctx.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-4">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-bold text-brand-fg">
            A
          </span>
          <span className="font-semibold tracking-tight">Asset Tracker</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <Sidebar permissions={ctx.permissions} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6">
          <div className="text-sm font-medium">{ctx.orgName}</div>
          <div className="flex items-center gap-3">
            <NotificationBell count={unread} />
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-medium">{ctx.name ?? ctx.email}</div>
              <div className="text-[var(--muted)]">{ctx.roleName}</div>
            </div>
            <Link
              href="/account"
              className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
              title="Account"
            >
              {initials}
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
