import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)]">
      <table
        className={cn("w-full text-sm [&_tbody_tr:last-child_td]:border-0", className)}
        {...props}
      />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b border-[var(--border)] px-3 py-2.5 align-middle", className)}
      {...props}
    />
  );
}

export function TrLink({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors hover:bg-[var(--surface-2)]/60", className)}
      {...props}
    />
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-sm text-[var(--muted)]">
        {children}
      </td>
    </tr>
  );
}
