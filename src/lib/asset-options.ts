import { db } from "@/lib/db";
import type { AssetFormOptions } from "@/app/(app)/assets/asset-form";

export async function loadAssetFormOptions(orgId: string): Promise<AssetFormOptions> {
  const [categories, sites, locations, departments, people, companies, funds, fieldDefs] = await Promise.all([
    db.category.findMany({ where: { orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.site.findMany({ where: { orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, siteId: true, site: { select: { name: true } } },
    }),
    db.department.findMany({ where: { orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.person.findMany({ where: { orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.company.findMany({ where: { orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.fund.findMany({ where: { orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.customFieldDef.findMany({
      where: { orgId },
      orderBy: [{ order: "asc" }, { label: "asc" }],
      select: { id: true, key: true, label: true, type: true, required: true, options: true, categoryId: true },
    }),
  ]);

  return {
    categories: categories.map((c) => ({ value: c.id, label: c.name })),
    sites: sites.map((s) => ({ value: s.id, label: s.name })),
    locations: locations.map((l) => ({ value: l.id, label: `${l.site.name} › ${l.name}`, siteId: l.siteId })),
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    people: people.map((p) => ({ value: p.id, label: p.name })),
    companies: companies.map((c) => ({ value: c.id, label: c.name })),
    funds: funds.map((f) => ({ value: f.id, label: f.name })),
    fieldDefs: fieldDefs.map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options,
      categoryId: f.categoryId,
    })),
  };
}
