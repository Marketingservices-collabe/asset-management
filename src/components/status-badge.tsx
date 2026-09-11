import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  CHECKED_OUT: "Checked out",
  LEASED: "Leased",
  RESERVED: "Reserved",
  UNDER_REPAIR: "Under repair",
  DISPOSED: "Disposed",
  LOST: "Lost",
  // maintenance
  SCHEDULED: "Scheduled",
  OVERDUE: "Overdue",
  DONE: "Done",
  SKIPPED: "Skipped",
  // reservation
  PENDING: "Pending",
  ACTIVE: "Active",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

const COLORS: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  CHECKED_OUT: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  LEASED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  RESERVED: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  UNDER_REPAIR: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  DISPOSED: "bg-slate-200 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
  LOST: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  SKIPPED: "bg-slate-200 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  RELEASED: "bg-slate-200 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
  CANCELLED: "bg-slate-200 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        COLORS[status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
