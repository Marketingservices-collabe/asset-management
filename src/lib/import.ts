import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";

export const IMPORT_FIELDS = [
  { key: "tagId", label: "Asset tag ID", required: true },
  { key: "name", label: "Name", required: true },
  { key: "serialNo", label: "Serial number", required: false },
  { key: "description", label: "Description", required: false },
  { key: "category", label: "Category", required: false },
  { key: "site", label: "Site", required: false },
  { key: "location", label: "Location", required: false },
  { key: "department", label: "Department", required: false },
  { key: "assignedPerson", label: "Assigned person", required: false },
  { key: "purchaseDate", label: "Purchase date", required: false },
  { key: "purchaseCost", label: "Purchase cost", required: false },
  { key: "poNumber", label: "PO number", required: false },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportMapping = Partial<Record<ImportFieldKey, string>>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Guess a mapping from CSV headers to target fields. */
export function autoMap(headers: string[]): ImportMapping {
  const map: ImportMapping = {};
  const aliases: Record<ImportFieldKey, string[]> = {
    tagId: ["tag", "tagid", "assettag", "assetid", "id", "assettagid", "barcode"],
    name: ["name", "assetname", "title", "description1"],
    serialNo: ["serial", "serialno", "serialnumber", "sn"],
    description: ["description", "notes", "details"],
    category: ["category", "type", "assettype", "class"],
    site: ["site", "building", "branch", "facility"],
    location: ["location", "room", "area", "place"],
    department: ["department", "dept", "division"],
    assignedPerson: ["assignedperson", "assignedto", "assignee", "person", "custodian", "owner", "holder", "employee", "assigned"],
    purchaseDate: ["purchasedate", "acquired", "acquisitiondate", "datepurchased", "purchased"],
    purchaseCost: ["purchasecost", "cost", "price", "value", "amount"],
    poNumber: ["po", "ponumber", "purchaseorder"],
  };
  const normed = headers.map((h) => ({ h, n: norm(h) }));
  for (const [key, list] of Object.entries(aliases) as [ImportFieldKey, string[]][]) {
    const hit = normed.find((x) => list.includes(x.n));
    if (hit) map[key] = hit.h;
  }
  return map;
}

export type ImportResult = {
  created: number;
  skipped: number;
  errors: string[];
  createdRefs: { categories: number; sites: number; locations: number; departments: number; people: number };
};

export async function commitAssetImport(
  orgId: string,
  csvText: string,
  mapping: ImportMapping,
): Promise<ImportResult> {
  const { rows } = parseCsv(csvText);
  const errors: string[] = [];
  const createdRefs = { categories: 0, sites: 0, locations: 0, departments: 0, people: 0 };

  if (!mapping.tagId || !mapping.name) {
    return { created: 0, skipped: 0, errors: ["Map both Asset tag ID and Name before importing."], createdRefs };
  }

  // ── caches of existing reference data (lowercased name → id) ──
  const [cats, sites, depts, persons, locations, existingAssets] = await Promise.all([
    db.category.findMany({ where: { orgId }, select: { id: true, name: true } }),
    db.site.findMany({ where: { orgId }, select: { id: true, name: true } }),
    db.department.findMany({ where: { orgId }, select: { id: true, name: true } }),
    db.person.findMany({ where: { orgId }, select: { id: true, name: true } }),
    db.location.findMany({ where: { orgId }, select: { id: true, name: true, siteId: true } }),
    db.asset.findMany({ where: { orgId }, select: { tagId: true } }),
  ]);
  const catMap = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));
  const siteMap = new Map(sites.map((s) => [s.name.toLowerCase(), s.id]));
  const deptMap = new Map(depts.map((d) => [d.name.toLowerCase(), d.id]));
  const personMap = new Map(persons.map((p) => [p.name.toLowerCase(), p.id]));
  const locMap = new Map(locations.map((l) => [`${l.siteId}||${l.name.toLowerCase()}`, l.id]));
  const takenTags = new Set(existingAssets.map((a) => a.tagId));

  const get = (row: Record<string, string>, key: ImportFieldKey) => {
    const col = mapping[key];
    return col ? (row[col] ?? "").trim() : "";
  };

  async function ensureCategory(name: string) {
    const k = name.toLowerCase();
    if (catMap.has(k)) return catMap.get(k)!;
    const c = await db.category.create({ data: { orgId, name } });
    catMap.set(k, c.id);
    createdRefs.categories++;
    return c.id;
  }
  async function ensureSite(name: string) {
    const k = name.toLowerCase();
    if (siteMap.has(k)) return siteMap.get(k)!;
    const s = await db.site.create({ data: { orgId, name } });
    siteMap.set(k, s.id);
    createdRefs.sites++;
    return s.id;
  }
  async function ensureDept(name: string) {
    const k = name.toLowerCase();
    if (deptMap.has(k)) return deptMap.get(k)!;
    const d = await db.department.create({ data: { orgId, name } });
    deptMap.set(k, d.id);
    createdRefs.departments++;
    return d.id;
  }
  async function ensurePerson(name: string) {
    const k = name.toLowerCase();
    if (personMap.has(k)) return personMap.get(k)!;
    const p = await db.person.create({ data: { orgId, name } });
    personMap.set(k, p.id);
    createdRefs.people++;
    return p.id;
  }
  async function ensureLocation(name: string, siteId: string) {
    const k = `${siteId}||${name.toLowerCase()}`;
    if (locMap.has(k)) return locMap.get(k)!;
    const l = await db.location.create({ data: { orgId, siteId, name } });
    locMap.set(k, l.id);
    createdRefs.locations++;
    return l.id;
  }

  const toCreate: Prisma.AssetCreateManyInput[] = [];

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2; // header is line 1
    const row = rows[i];
    const tagId = get(row, "tagId");
    const name = get(row, "name");
    if (!tagId && !name) continue; // blank line
    if (!tagId || !name) {
      errors.push(`Line ${line}: missing ${!tagId ? "tag" : "name"} — skipped.`);
      continue;
    }
    if (takenTags.has(tagId)) {
      errors.push(`Line ${line}: tag "${tagId}" already exists — skipped.`);
      continue;
    }
    takenTags.add(tagId);

    let categoryId: string | null = null;
    let siteId: string | null = null;
    let locationId: string | null = null;
    let departmentId: string | null = null;
    let assignedPersonId: string | null = null;

    const catName = get(row, "category");
    if (catName) categoryId = await ensureCategory(catName);
    const siteName = get(row, "site");
    if (siteName) siteId = await ensureSite(siteName);
    const locName = get(row, "location");
    if (locName) {
      if (!siteId) {
        siteId = await ensureSite("Imported");
      }
      locationId = await ensureLocation(locName, siteId);
    }
    const deptName = get(row, "department");
    if (deptName) departmentId = await ensureDept(deptName);
    const personName = get(row, "assignedPerson");
    if (personName) assignedPersonId = await ensurePerson(personName);

    const costRaw = get(row, "purchaseCost").replace(/[$,]/g, "");
    const cost = costRaw && !Number.isNaN(Number(costRaw)) ? new Prisma.Decimal(costRaw) : null;
    const dateRaw = get(row, "purchaseDate");
    const purchaseDate = dateRaw && !Number.isNaN(Date.parse(dateRaw)) ? new Date(dateRaw) : null;

    toCreate.push({
      orgId,
      tagId,
      name,
      serialNo: get(row, "serialNo") || null,
      description: get(row, "description") || null,
      poNumber: get(row, "poNumber") || null,
      categoryId,
      siteId,
      locationId,
      departmentId,
      assignedPersonId,
      purchaseDate,
      purchaseCost: cost,
      bookValue: cost,
    });
  }

  let created = 0;
  if (toCreate.length > 0) {
    const res = await db.asset.createMany({ data: toCreate, skipDuplicates: true });
    created = res.count;
  }

  return {
    created,
    skipped: rows.length - created,
    errors,
    createdRefs,
  };
}
