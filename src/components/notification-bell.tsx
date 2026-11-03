import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
      className="relative grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
    >
      <Bell size={18} />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-fg">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
