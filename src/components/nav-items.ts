import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  CalendarClock,
  Wrench,
  PackageSearch,
  ClipboardCheck,
  BarChart3,
  ScrollText,
  ShieldCheck,
  FileText,
  Umbrella,
  Landmark,
  TrendingDown,
  MapPin,
  Tags,
  Building2,
  Users,
  SlidersHorizontal,
  Upload,
  UserCog,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS, type Permission } from "@/lib/authz";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  perm?: Permission;
  group: "Overview" | "Assets" | "Operations" | "Finance" | "Setup" | "Admin";
};

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Overview" },
  { label: "Notifications", href: "/notifications", icon: Bell, group: "Overview" },

  { label: "Assets", href: "/assets", icon: Boxes, perm: PERMISSIONS.ASSET_VIEW, group: "Assets" },
  { label: "Check-in / out", href: "/checkout", icon: ArrowLeftRight, perm: PERMISSIONS.CHECKOUT_MANAGE, group: "Assets" },
  { label: "Reservations", href: "/reservations", icon: CalendarClock, perm: PERMISSIONS.RESERVATION_MANAGE, group: "Assets" },
  { label: "Maintenance", href: "/maintenance", icon: Wrench, perm: PERMISSIONS.MAINTENANCE_VIEW, group: "Assets" },

  { label: "Inventory", href: "/inventory", icon: PackageSearch, perm: PERMISSIONS.INVENTORY_VIEW, group: "Operations" },
  { label: "Audits", href: "/audits", icon: ClipboardCheck, perm: PERMISSIONS.AUDIT_RUN, group: "Operations" },
  { label: "Reports", href: "/reports", icon: BarChart3, perm: PERMISSIONS.REPORT_VIEW, group: "Operations" },
  { label: "Activity log", href: "/activity", icon: ScrollText, perm: PERMISSIONS.ACTIVITY_VIEW, group: "Operations" },

  { label: "Warranties", href: "/warranties", icon: ShieldCheck, perm: PERMISSIONS.FINANCIALS_VIEW, group: "Finance" },
  { label: "Contracts", href: "/contracts", icon: FileText, perm: PERMISSIONS.FINANCIALS_VIEW, group: "Finance" },
  { label: "Insurance", href: "/insurance", icon: Umbrella, perm: PERMISSIONS.FINANCIALS_VIEW, group: "Finance" },
  { label: "Funds", href: "/funds", icon: Landmark, perm: PERMISSIONS.FINANCIALS_VIEW, group: "Finance" },
  { label: "Depreciation", href: "/depreciation", icon: TrendingDown, perm: PERMISSIONS.FINANCIALS_VIEW, group: "Finance" },

  { label: "Sites & locations", href: "/setup/locations", icon: MapPin, perm: PERMISSIONS.SETUP_MANAGE, group: "Setup" },
  { label: "Categories", href: "/setup/categories", icon: Tags, perm: PERMISSIONS.SETUP_MANAGE, group: "Setup" },
  { label: "Departments", href: "/setup/departments", icon: Building2, perm: PERMISSIONS.SETUP_MANAGE, group: "Setup" },
  { label: "People", href: "/setup/people", icon: Users, perm: PERMISSIONS.SETUP_MANAGE, group: "Setup" },
  { label: "Companies", href: "/setup/companies", icon: Building2, perm: PERMISSIONS.SETUP_MANAGE, group: "Setup" },
  { label: "Custom fields", href: "/setup/fields", icon: SlidersHorizontal, perm: PERMISSIONS.SETUP_MANAGE, group: "Setup" },
  { label: "Import", href: "/setup/import", icon: Upload, perm: PERMISSIONS.ASSET_CREATE, group: "Setup" },

  { label: "Users", href: "/admin/users", icon: UserCog, perm: PERMISSIONS.USER_MANAGE, group: "Admin" },
  { label: "Roles", href: "/admin/roles", icon: ShieldCheck, perm: PERMISSIONS.USER_MANAGE, group: "Admin" },
  { label: "Alert rules", href: "/admin/alerts", icon: Bell, perm: PERMISSIONS.ORG_SETTINGS, group: "Admin" },
  { label: "Organization", href: "/admin/org", icon: Settings, perm: PERMISSIONS.ORG_SETTINGS, group: "Admin" },
];

export const NAV_GROUPS = ["Overview", "Assets", "Operations", "Finance", "Setup", "Admin"] as const;
