import { Laptop, Monitor, Tablet, Headphones, Smartphone, Mouse, Keyboard, Cable, Printer, Package, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = { icon: LucideIcon; tone: string };

const KINDS: [RegExp, Kind][] = [
  [/laptop|macbook|notebook|thinkpad/i, { icon: Laptop, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" }],
  [/monitor|display|screen/i, { icon: Monitor, tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" }],
  [/ipad|tablet|tab\b/i, { icon: Tablet, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" }],
  [/head(set|phone)|earphone|audio/i, { icon: Headphones, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" }],
  [/phone|mobile|iphone/i, { icon: Smartphone, tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" }],
  [/mouse/i, { icon: Mouse, tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" }],
  [/keyboard/i, { icon: Keyboard, tone: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" }],
  [/peripheral|cable|connector|adapter|hub|dongle|charger/i, { icon: Cable, tone: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" }],
  [/printer|scanner/i, { icon: Printer, tone: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" }],
];

const FALLBACK: Kind = { icon: Package, tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" };

/** Pick an icon + colour from the device type (category), falling back to the asset name. */
export function deviceKind(...hints: (string | null | undefined)[]): Kind {
  for (const h of hints) {
    if (!h) continue;
    const hit = KINDS.find(([re]) => re.test(h));
    if (hit) return hit[1];
  }
  return FALLBACK;
}

export function AssetIcon({
  type,
  name,
  size = "md",
  className,
}: {
  type?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { icon: Icon, tone } = deviceKind(type, name);
  const box = size === "lg" ? "h-14 w-14 rounded-2xl" : size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  const px = size === "lg" ? 26 : size === "sm" ? 14 : 17;
  return (
    <span className={cn("grid shrink-0 place-items-center", box, tone, className)} aria-hidden="true">
      <Icon size={px} strokeWidth={1.9} />
    </span>
  );
}
