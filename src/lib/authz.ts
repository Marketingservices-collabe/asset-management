/**
 * Permission catalogue. A Role stores a string[] of these keys.
 * `can()` is the single guard used at the top of every Server Action and in the UI.
 */

export const PERMISSIONS = {
  // assets & reference data
  ASSET_VIEW: "asset.view",
  ASSET_CREATE: "asset.create",
  ASSET_EDIT: "asset.edit",
  ASSET_DELETE: "asset.delete",
  SETUP_MANAGE: "setup.manage", // sites, locations, categories, departments, persons, companies, custom fields

  // custody
  CHECKOUT_MANAGE: "checkout.manage",
  RESERVATION_MANAGE: "reservation.manage",
  DISPOSAL_MANAGE: "disposal.manage",

  // maintenance
  MAINTENANCE_VIEW: "maintenance.view",
  MAINTENANCE_MANAGE: "maintenance.manage",

  // finance / coverage
  FINANCIALS_VIEW: "financials.view",
  FINANCIALS_MANAGE: "financials.manage", // warranty, contracts, insurance, funds, depreciation

  // inventory
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MANAGE: "inventory.manage",

  // audit
  AUDIT_RUN: "audit.run",

  // reporting
  REPORT_VIEW: "report.view",

  // administration
  USER_MANAGE: "user.manage",
  ORG_SETTINGS: "org.settings",
  ACTIVITY_VIEW: "activity.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** System roles seeded per org. */
export const SYSTEM_ROLES: Record<string, { description: string; permissions: Permission[] }> = {
  Admin: {
    description: "Full access to everything.",
    permissions: ALL_PERMISSIONS,
  },
  Manager: {
    description: "Everything except user management and org settings.",
    permissions: ALL_PERMISSIONS.filter(
      (p) => p !== PERMISSIONS.USER_MANAGE && p !== PERMISSIONS.ORG_SETTINGS,
    ),
  },
  Staff: {
    description: "Day-to-day: view assets, check in/out, log maintenance.",
    permissions: [
      PERMISSIONS.ASSET_VIEW,
      PERMISSIONS.ASSET_CREATE,
      PERMISSIONS.ASSET_EDIT,
      PERMISSIONS.CHECKOUT_MANAGE,
      PERMISSIONS.RESERVATION_MANAGE,
      PERMISSIONS.MAINTENANCE_VIEW,
      PERMISSIONS.MAINTENANCE_MANAGE,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.REPORT_VIEW,
    ],
  },
  Auditor: {
    description: "Read-only plus the ability to run audits.",
    permissions: [
      PERMISSIONS.ASSET_VIEW,
      PERMISSIONS.MAINTENANCE_VIEW,
      PERMISSIONS.FINANCIALS_VIEW,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.AUDIT_RUN,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.ACTIVITY_VIEW,
    ],
  },
  "Read-only": {
    description: "View assets and reports only.",
    permissions: [PERMISSIONS.ASSET_VIEW, PERMISSIONS.MAINTENANCE_VIEW, PERMISSIONS.REPORT_VIEW],
  },
};

export function can(permissions: string[] | undefined | null, required: Permission): boolean {
  if (!permissions) return false;
  return permissions.includes(required);
}

export function canAny(permissions: string[] | undefined | null, required: Permission[]): boolean {
  if (!permissions) return false;
  return required.some((r) => permissions.includes(r));
}
