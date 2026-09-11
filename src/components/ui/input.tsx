import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm outline-none transition-shadow placeholder:text-[var(--muted)] focus:border-brand focus:ring-2 focus:ring-brand/30",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium", className)} {...props} />;
}
