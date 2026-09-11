import { PERMISSIONS, type Permission } from "@/lib/authz";

export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.ASSET_VIEW]: "View assets",
  [PERMISSIONS.ASSET_CREATE]: "Create assets",
  [PERMISSIONS.ASSET_EDIT]: "Edit assets",
  [PERMISSIONS.ASSET_DELETE]: "Delete assets",
  [PERMISSIONS.SETUP_MANAGE]: "Manage setup data (sites, categories, people…)",
  [PERMISSIONS.CHECKOUT_MANAGE]: "Check assets in / out",
  [PERMISSIONS.RESERVATION_MANAGE]: "Manage reservations",
  [PERMISSIONS.DISPOSAL_MANAGE]: "Dispose assets",
  [PERMISSIONS.MAINTENANCE_VIEW]: "View maintenance",
  [PERMISSIONS.MAINTENANCE_MANAGE]: "Manage maintenance",
  [PERMISSIONS.FINANCIALS_VIEW]: "View financials & coverage",
  [PERMISSIONS.FINANCIALS_MANAGE]: "Manage warranties, contracts, insurance, funds",
  [PERMISSIONS.INVENTORY_VIEW]: "View inventory",
  [PERMISSIONS.INVENTORY_MANAGE]: "Manage inventory & stock",
  [PERMISSIONS.AUDIT_RUN]: "Run audits",
  [PERMISSIONS.REPORT_VIEW]: "View & export reports",
  [PERMISSIONS.USER_MANAGE]: "Manage users & roles",
  [PERMISSIONS.ORG_SETTINGS]: "Change organization settings & alerts",
  [PERMISSIONS.ACTIVITY_VIEW]: "View the activity log",
};

export const PERMISSION_GROUPS: { title: string; perms: Permission[] }[] = [
  { title: "Assets", perms: [PERMISSIONS.ASSET_VIEW, PERMISSIONS.ASSET_CREATE, PERMISSIONS.ASSET_EDIT, PERMISSIONS.ASSET_DELETE, PERMISSIONS.SETUP_MANAGE] },
  { title: "Custody", perms: [PERMISSIONS.CHECKOUT_MANAGE, PERMISSIONS.RESERVATION_MANAGE, PERMISSIONS.DISPOSAL_MANAGE] },
  { title: "Maintenance", perms: [PERMISSIONS.MAINTENANCE_VIEW, PERMISSIONS.MAINTENANCE_MANAGE] },
  { title: "Finance", perms: [PERMISSIONS.FINANCIALS_VIEW, PERMISSIONS.FINANCIALS_MANAGE] },
  { title: "Inventory", perms: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE] },
  { title: "Operations", perms: [PERMISSIONS.AUDIT_RUN, PERMISSIONS.REPORT_VIEW, PERMISSIONS.ACTIVITY_VIEW] },
  { title: "Administration", perms: [PERMISSIONS.USER_MANAGE, PERMISSIONS.ORG_SETTINGS] },
];
