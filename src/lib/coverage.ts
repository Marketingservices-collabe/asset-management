/** Shared helpers for warranty / contract / insurance expiry state. */

export type ExpiryState = "ok" | "soon" | "expired" | "none";

export function expiryState(endAt: Date | null | undefined, leadDays = 30): ExpiryState {
  if (!endAt) return "none";
  const now = Date.now();
  const end = endAt.getTime();
  if (end < now) return "expired";
  if (end - now <= leadDays * 86_400_000) return "soon";
  return "ok";
}

export function daysUntil(endAt: Date | null | undefined): number | null {
  if (!endAt) return null;
  return Math.ceil((endAt.getTime() - Date.now()) / 86_400_000);
}

export const EXPIRY_BADGE: Record<ExpiryState, string> = {
  ok: "ACTIVE",
  soon: "PENDING",
  expired: "OVERDUE",
  none: "SKIPPED",
};

export const CONTRACT_TYPES = ["SERVICE", "LEASE", "SUPPORT"] as const;
export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SERVICE: "Service",
  LEASE: "Lease",
  SUPPORT: "Support",
};
