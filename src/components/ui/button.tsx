import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg shadow-[var(--shadow)] hover:bg-brand-dark active:translate-y-px",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--card)] hover:bg-[var(--surface-2)] active:translate-y-px",
  ghost: "hover:bg-[var(--surface-2)]",
  danger: "bg-red-600 text-white shadow-[var(--shadow)] hover:bg-red-700 active:translate-y-px",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]",
      "disabled:pointer-events-none disabled:opacity-50",
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";
