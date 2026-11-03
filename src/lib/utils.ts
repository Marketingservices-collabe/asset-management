import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number | string | null | undefined, currency = "USD") {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Normalise a post-login redirect target to a single same-site path.
 * Guards against duplicated values ("/dashboard, /dashboard"), absolute or
 * protocol-relative URLs (open redirect) and the login page itself.
 */
export function safeCallbackUrl(raw: unknown, fallback = "/dashboard"): string {
  let v = String(raw ?? "").trim();
  try {
    v = decodeURIComponent(v);
  } catch {
    return fallback;
  }
  v = v.split(",")[0].trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  if (v === "/login" || v.startsWith("/login?") || v.startsWith("/api/auth")) return fallback;
  return v;
}
