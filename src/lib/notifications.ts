/** Map an alert notification type to a page and label. */
export const NOTIF_META: Record<string, { href: string; label: string }> = {
  CHECKOUT_OVERDUE: { href: "/checkout", label: "Overdue check-out" },
  MAINT_DUE: { href: "/maintenance", label: "Maintenance due" },
  WARRANTY_EXPIRY: { href: "/warranties", label: "Warranty expiring" },
  CONTRACT_EXPIRY: { href: "/contracts", label: "Contract expiring" },
  POLICY_EXPIRY: { href: "/insurance", label: "Policy expiring" },
  LOW_STOCK: { href: "/inventory", label: "Low stock" },
};

export function notifMeta(type: string) {
  return NOTIF_META[type] ?? { href: "/dashboard", label: type };
}
