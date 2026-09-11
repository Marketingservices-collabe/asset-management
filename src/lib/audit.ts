import type { Prisma } from "@prisma/client";

export type AuditScope = {
  siteId: string | null;
  locationId: string | null;
  categoryId: string | null;
};

/** Which assets fall under an audit's scope. */
export function scopeWhere(orgId: string, scope: AuditScope): Prisma.AssetWhereInput {
  const w: Prisma.AssetWhereInput = { orgId, status: { notIn: ["DISPOSED", "LOST"] } };
  if (scope.siteId) w.siteId = scope.siteId;
  if (scope.locationId) w.locationId = scope.locationId;
  if (scope.categoryId) w.categoryId = scope.categoryId;
  return w;
}

export function scopeLabel(
  scope: AuditScope,
  names: { site?: string; location?: string; category?: string },
): string {
  const parts: string[] = [];
  if (scope.siteId) parts.push(`Site: ${names.site ?? "?"}`);
  if (scope.locationId) parts.push(`Location: ${names.location ?? "?"}`);
  if (scope.categoryId) parts.push(`Category: ${names.category ?? "?"}`);
  return parts.length ? parts.join(" · ") : "Whole organization";
}

export type ScanResult = "FOUND" | "MOVED" | "UNEXPECTED";
