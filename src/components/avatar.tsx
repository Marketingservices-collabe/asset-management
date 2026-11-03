import { cn } from "@/lib/utils";

const TONES = [
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200",
];

export function initials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

/** Initials avatar; the colour is stable per name so the same person always looks the same. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const dims =
    size === "lg" ? "h-11 w-11 text-sm" : size === "md" ? "h-8 w-8 text-xs" : size === "sm" ? "h-7 w-7 text-[11px]" : "h-6 w-6 text-[10px]";
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold", dims, TONES[h % TONES.length], className)}
      aria-hidden="true"
    >
      {initials(name) || "?"}
    </span>
  );
}
