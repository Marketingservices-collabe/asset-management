import Link from "next/link";
import { Check, Bell } from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { notifMeta } from "@/lib/notifications";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { markRead, markAllRead } from "./actions";

export default async function NotificationsPage() {
  const ctx = await requireContext();
  const notifications = await db.notification.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up"}
      />

      {unread > 0 ? (
        <form action={markAllRead} className="mb-4">
          <Button size="sm" variant="secondary">
            <Check size={15} /> Mark all read
          </Button>
        </form>
      ) : null}

      {notifications.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center text-sm text-[var(--muted)]">
          <Bell size={22} />
          No notifications yet. Alerts appear here after the daily scan.
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const meta = notifMeta(n.type);
            return (
              <Card
                key={n.id}
                className={`flex items-start justify-between gap-3 p-4 ${n.readAt ? "opacity-60" : ""}`}
              >
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <StatusBadge status={n.readAt ? "SKIPPED" : "OVERDUE"} />
                    <Link href={meta.href} className="text-sm font-medium text-brand hover:underline">
                      {meta.label}
                    </Link>
                    <span className="text-xs text-[var(--muted)]">
                      {n.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{n.message}</p>
                </div>
                {!n.readAt ? (
                  <form action={markRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <Button type="submit" size="sm" variant="ghost" title="Mark read">
                      <Check size={15} />
                    </Button>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
