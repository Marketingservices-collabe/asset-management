import type { Permission } from "@/lib/authz";

export type ReportColumn = { key: string; label: string; align?: "left" | "right" };
export type ReportRow = Record<string, string | number | null>;

export type ReportFilterKey = "dateFrom" | "dateTo" | "categoryId" | "siteId" | "status" | "personId";
export type ReportParams = Partial<Record<ReportFilterKey, string>>;

export type ReportResult = {
  columns: ReportColumn[];
  rows: ReportRow[];
  note?: string;
};

export type ReportGroup = "Assets" | "Custody" | "Maintenance" | "Finance" | "Inventory";

export type ReportDef = {
  key: string;
  name: string;
  description: string;
  group: ReportGroup;
  permission: Permission;
  filters: ReportFilterKey[];
  run: (orgId: string, params: ReportParams) => Promise<ReportResult>;
};
