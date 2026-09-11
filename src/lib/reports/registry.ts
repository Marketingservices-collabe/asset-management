import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { STATUS_LABELS, monthsElapsed } from "@/lib/assets";
import { buildSchedule, type DepMethod } from "@/lib/depreciation";
import { effectiveStatus } from "@/lib/maintenance";
import type { ReportDef, ReportParams, ReportResult } from "./types";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const num = (v: Prisma.Decimal | null | undefined) => (v == null ? null : Number(v));

function assetWhere(orgId: string, p: ReportParams): Prisma.AssetWhereInput {
  const w: Prisma.AssetWhereInput = { orgId };
  if (p.categoryId) w.categoryId = p.categoryId;
  if (p.siteId) w.siteId = p.siteId;
  if (p.status) w.status = p.status as Prisma.AssetWhereInput["status"];
  return w;
}

function dateRange(p: ReportParams): { gte?: Date; lte?: Date } | undefined {
  const r: { gte?: Date; lte?: Date } = {};
  if (p.dateFrom) r.gte = new Date(p.dateFrom);
  if (p.dateTo) {
    const d = new Date(p.dateTo);
    d.setHours(23, 59, 59, 999);
    r.lte = d;
  }
  return r.gte || r.lte ? r : undefined;
}

/** accumulated depreciation + current book value for one asset */
function depFor(a: {
  purchaseCost: Prisma.Decimal | null;
  salvageValue: Prisma.Decimal | null;
  usefulLifeMonths: number | null;
  depreciationMethod: string;
  depreciationStart: Date | null;
  purchaseDate: Date | null;
  bookValue: Prisma.Decimal | null;
}) {
  const cost = num(a.purchaseCost);
  if (cost == null) return { accumulated: null as number | null, book: num(a.bookValue) };
  if (a.depreciationMethod === "NONE" || !a.usefulLifeMonths)
    return { accumulated: 0, book: cost };
  const schedule = buildSchedule({
    cost,
    salvage: num(a.salvageValue) ?? 0,
    usefulLifeMonths: a.usefulLifeMonths,
    method: a.depreciationMethod as DepMethod,
  });
  const elapsed = monthsElapsed(a.depreciationStart ?? a.purchaseDate);
  if (schedule.length === 0) return { accumulated: 0, book: cost };
  const row = schedule[Math.min(Math.max(elapsed, 1), schedule.length) - 1];
  return elapsed <= 0
    ? { accumulated: 0, book: cost }
    : { accumulated: row.accumulated, book: row.bookValue };
}

export const REPORTS: ReportDef[] = [
  /* ── Assets ─────────────────────────────────────────────── */
  {
    key: "asset-register",
    name: "Asset register",
    description: "Every asset with location, custody and value.",
    group: "Assets",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["categoryId", "siteId", "status"],
    async run(orgId, p) {
      const assets = await db.asset.findMany({
        where: assetWhere(orgId, p),
        orderBy: { tagId: "asc" },
        include: {
          category: { select: { name: true } },
          site: { select: { name: true } },
          location: { select: { name: true } },
          department: { select: { name: true } },
          assignedPerson: { select: { name: true } },
        },
      });
      return {
        columns: [
          { key: "tag", label: "Tag" },
          { key: "name", label: "Name" },
          { key: "category", label: "Category" },
          { key: "site", label: "Site" },
          { key: "location", label: "Location" },
          { key: "department", label: "Department" },
          { key: "assigned", label: "Assigned to" },
          { key: "status", label: "Status" },
          { key: "serial", label: "Serial" },
          { key: "purchased", label: "Purchased" },
          { key: "cost", label: "Cost", align: "right" },
          { key: "book", label: "Book value", align: "right" },
        ],
        rows: assets.map((a) => ({
          tag: a.tagId,
          name: a.name,
          category: a.category?.name ?? "",
          site: a.site?.name ?? "",
          location: a.location?.name ?? "",
          department: a.department?.name ?? "",
          assigned: a.assignedPerson?.name ?? "",
          status: STATUS_LABELS[a.status] ?? a.status,
          serial: a.serialNo ?? "",
          purchased: iso(a.purchaseDate),
          cost: num(a.purchaseCost),
          book: num(a.bookValue),
        })),
      };
    },
  },
  {
    key: "assets-by-location",
    name: "Assets by location",
    description: "Counts and value rolled up by site and location.",
    group: "Assets",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["siteId", "categoryId"],
    async run(orgId, p) {
      const assets = await db.asset.findMany({
        where: assetWhere(orgId, p),
        include: { site: { select: { name: true } }, location: { select: { name: true } } },
      });
      const map = new Map<string, { site: string; location: string; count: number; cost: number; book: number }>();
      for (const a of assets) {
        const site = a.site?.name ?? "— No site";
        const location = a.location?.name ?? "— No location";
        const k = `${site}||${location}`;
        const e = map.get(k) ?? { site, location, count: 0, cost: 0, book: 0 };
        e.count++;
        e.cost += num(a.purchaseCost) ?? 0;
        e.book += num(a.bookValue) ?? 0;
        map.set(k, e);
      }
      return {
        columns: [
          { key: "site", label: "Site" },
          { key: "location", label: "Location" },
          { key: "count", label: "Assets", align: "right" },
          { key: "cost", label: "Purchase value", align: "right" },
          { key: "book", label: "Book value", align: "right" },
        ],
        rows: [...map.values()]
          .sort((a, b) => a.site.localeCompare(b.site) || a.location.localeCompare(b.location))
          .map((e) => ({ ...e, cost: round(e.cost), book: round(e.book) })),
      };
    },
  },
  {
    key: "assets-by-category",
    name: "Assets by category",
    description: "Counts and value rolled up by category.",
    group: "Assets",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["siteId"],
    async run(orgId, p) {
      const assets = await db.asset.findMany({
        where: assetWhere(orgId, p),
        include: { category: { select: { name: true } } },
      });
      return groupCount(
        assets.map((a) => ({ key: a.category?.name ?? "— Uncategorized", cost: num(a.purchaseCost) ?? 0, book: num(a.bookValue) ?? 0 })),
        "Category",
      );
    },
  },
  {
    key: "assets-by-department",
    name: "Assets by department",
    description: "Counts and value rolled up by department.",
    group: "Assets",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["siteId", "categoryId"],
    async run(orgId, p) {
      const assets = await db.asset.findMany({
        where: assetWhere(orgId, p),
        include: { department: { select: { name: true } } },
      });
      return groupCount(
        assets.map((a) => ({ key: a.department?.name ?? "— No department", cost: num(a.purchaseCost) ?? 0, book: num(a.bookValue) ?? 0 })),
        "Department",
      );
    },
  },

  /* ── Custody ────────────────────────────────────────────── */
  {
    key: "checkout-history",
    name: "Check-out history",
    description: "Every check-out with return and overdue status.",
    group: "Custody",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["dateFrom", "dateTo", "personId"],
    async run(orgId, p) {
      const range = dateRange(p);
      const rows = await db.checkoutRecord.findMany({
        where: {
          orgId,
          ...(range ? { checkedOutAt: range } : {}),
          ...(p.personId ? { personId: p.personId } : {}),
        },
        orderBy: { checkedOutAt: "desc" },
        include: { asset: { select: { tagId: true, name: true } }, person: { select: { name: true } } },
      });
      const now = Date.now();
      return {
        columns: [
          { key: "tag", label: "Tag" },
          { key: "asset", label: "Asset" },
          { key: "holder", label: "Holder" },
          { key: "out", label: "Checked out" },
          { key: "due", label: "Due" },
          { key: "in", label: "Checked in" },
          { key: "state", label: "State" },
        ],
        rows: rows.map((c) => ({
          tag: c.asset.tagId,
          asset: c.asset.name,
          holder: c.person?.name ?? "Location",
          out: iso(c.checkedOutAt),
          due: iso(c.dueAt),
          in: iso(c.checkedInAt),
          state: c.checkedInAt
            ? "Returned"
            : c.dueAt && c.dueAt.getTime() < now
              ? "Overdue"
              : "Out",
        })),
      };
    },
  },
  {
    key: "checked-out-now",
    name: "Currently checked out",
    description: "Open check-outs, overdue first.",
    group: "Custody",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["personId"],
    async run(orgId, p) {
      const rows = await db.checkoutRecord.findMany({
        where: { orgId, checkedInAt: null, ...(p.personId ? { personId: p.personId } : {}) },
        orderBy: { dueAt: "asc" },
        include: { asset: { select: { tagId: true, name: true } }, person: { select: { name: true } } },
      });
      const now = Date.now();
      return {
        columns: [
          { key: "tag", label: "Tag" },
          { key: "asset", label: "Asset" },
          { key: "holder", label: "Holder" },
          { key: "since", label: "Since" },
          { key: "due", label: "Due" },
          { key: "overdue", label: "Overdue" },
        ],
        rows: rows.map((c) => ({
          tag: c.asset.tagId,
          asset: c.asset.name,
          holder: c.person?.name ?? "Location",
          since: iso(c.checkedOutAt),
          due: iso(c.dueAt),
          overdue: c.dueAt && c.dueAt.getTime() < now ? "Yes" : "",
        })),
      };
    },
  },

  /* ── Maintenance ────────────────────────────────────────── */
  {
    key: "maintenance-log",
    name: "Maintenance log & cost",
    description: "Completed and skipped work with cost totals.",
    group: "Maintenance",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["dateFrom", "dateTo", "categoryId"],
    async run(orgId, p) {
      const range = dateRange(p);
      const rows = await db.maintenanceRecord.findMany({
        where: {
          orgId,
          status: { in: ["DONE", "SKIPPED"] },
          ...(range ? { completedAt: range } : {}),
          ...(p.categoryId ? { asset: { categoryId: p.categoryId } } : {}),
        },
        orderBy: { completedAt: "desc" },
        include: { asset: { select: { tagId: true, name: true } }, schedule: { select: { title: true } } },
      });
      const total = rows.reduce((s, r) => s + (num(r.cost) ?? 0), 0);
      return {
        columns: [
          { key: "tag", label: "Tag" },
          { key: "asset", label: "Asset" },
          { key: "task", label: "Task / work" },
          { key: "completed", label: "Completed" },
          { key: "technician", label: "Technician" },
          { key: "cost", label: "Cost", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: rows.map((r) => ({
          tag: r.asset.tagId,
          asset: r.asset.name,
          task: r.schedule?.title ?? r.workPerformed ?? "Maintenance",
          completed: iso(r.completedAt),
          technician: r.technician ?? "",
          cost: num(r.cost),
          status: r.status === "DONE" ? "Done" : "Skipped",
        })),
        note: `Total cost: ${total.toLocaleString("en-US", { style: "currency", currency: "USD" })} across ${rows.length} records.`,
      };
    },
  },
  {
    key: "maintenance-upcoming",
    name: "Upcoming & overdue maintenance",
    description: "Open maintenance occurrences by due date.",
    group: "Maintenance",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["categoryId"],
    async run(orgId, p) {
      const rows = await db.maintenanceRecord.findMany({
        where: {
          orgId,
          status: { in: ["SCHEDULED", "OVERDUE"] },
          ...(p.categoryId ? { asset: { categoryId: p.categoryId } } : {}),
        },
        orderBy: { dueAt: "asc" },
        include: {
          asset: { select: { tagId: true, name: true } },
          schedule: { select: { title: true, assignedTo: { select: { name: true } } } },
        },
      });
      return {
        columns: [
          { key: "tag", label: "Tag" },
          { key: "asset", label: "Asset" },
          { key: "task", label: "Task" },
          { key: "due", label: "Due" },
          { key: "assignee", label: "Assignee" },
          { key: "status", label: "Status" },
        ],
        rows: rows.map((r) => ({
          tag: r.asset.tagId,
          asset: r.asset.name,
          task: r.schedule?.title ?? "Ad-hoc",
          due: iso(r.dueAt),
          assignee: r.schedule?.assignedTo?.name ?? "",
          status: effectiveStatus(r.status, r.dueAt) === "OVERDUE" ? "Overdue" : "Scheduled",
        })),
      };
    },
  },

  /* ── Finance ────────────────────────────────────────────── */
  {
    key: "depreciation-schedule",
    name: "Depreciation schedule",
    description: "Method, accumulated depreciation and current book value per asset.",
    group: "Finance",
    permission: PERMISSIONS.FINANCIALS_VIEW,
    filters: ["categoryId", "siteId"],
    async run(orgId, p) {
      const assets = await db.asset.findMany({
        where: { ...assetWhere(orgId, p), purchaseCost: { not: null } },
        orderBy: { tagId: "asc" },
        include: { category: { select: { name: true } } },
      });
      return {
        columns: [
          { key: "tag", label: "Tag" },
          { key: "name", label: "Name" },
          { key: "category", label: "Category" },
          { key: "method", label: "Method" },
          { key: "cost", label: "Cost", align: "right" },
          { key: "salvage", label: "Salvage", align: "right" },
          { key: "life", label: "Life (mo)", align: "right" },
          { key: "elapsed", label: "Elapsed (mo)", align: "right" },
          { key: "accum", label: "Accum. dep.", align: "right" },
          { key: "book", label: "Book value", align: "right" },
        ],
        rows: assets.map((a) => {
          const { accumulated, book } = depFor(a);
          return {
            tag: a.tagId,
            name: a.name,
            category: a.category?.name ?? "",
            method: a.depreciationMethod === "NONE" ? "None" : a.depreciationMethod.replaceAll("_", " ").toLowerCase(),
            cost: num(a.purchaseCost),
            salvage: num(a.salvageValue),
            life: a.usefulLifeMonths,
            elapsed: monthsElapsed(a.depreciationStart ?? a.purchaseDate),
            accum: accumulated,
            book,
          };
        }),
      };
    },
  },
  {
    key: "book-value-summary",
    name: "Book value summary",
    description: "Cost, accumulated depreciation and net book value by category.",
    group: "Finance",
    permission: PERMISSIONS.FINANCIALS_VIEW,
    filters: ["siteId"],
    async run(orgId, p) {
      const assets = await db.asset.findMany({
        where: assetWhere(orgId, p),
        include: { category: { select: { name: true } } },
      });
      const map = new Map<string, { category: string; count: number; cost: number; accum: number; book: number }>();
      for (const a of assets) {
        const category = a.category?.name ?? "— Uncategorized";
        const { accumulated, book } = depFor(a);
        const e = map.get(category) ?? { category, count: 0, cost: 0, accum: 0, book: 0 };
        e.count++;
        e.cost += num(a.purchaseCost) ?? 0;
        e.accum += accumulated ?? 0;
        e.book += book ?? 0;
        map.set(category, e);
      }
      return {
        columns: [
          { key: "category", label: "Category" },
          { key: "count", label: "Assets", align: "right" },
          { key: "cost", label: "Cost", align: "right" },
          { key: "accum", label: "Accum. dep.", align: "right" },
          { key: "book", label: "Net book value", align: "right" },
        ],
        rows: [...map.values()]
          .sort((a, b) => a.category.localeCompare(b.category))
          .map((e) => ({ category: e.category, count: e.count, cost: round(e.cost), accum: round(e.accum), book: round(e.book) })),
      };
    },
  },
  {
    key: "disposal-report",
    name: "Disposal report",
    description: "Assets sold, donated, scrapped or lost.",
    group: "Finance",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["dateFrom", "dateTo"],
    async run(orgId, p) {
      const range = dateRange(p);
      const rows = await db.disposalRecord.findMany({
        where: { orgId, ...(range ? { at: range } : {}) },
        orderBy: { at: "desc" },
        include: { asset: { select: { tagId: true, name: true, purchaseCost: true } } },
      });
      return {
        columns: [
          { key: "tag", label: "Tag" },
          { key: "asset", label: "Asset" },
          { key: "method", label: "Method" },
          { key: "date", label: "Date" },
          { key: "cost", label: "Original cost", align: "right" },
          { key: "proceeds", label: "Proceeds", align: "right" },
          { key: "notes", label: "Notes" },
        ],
        rows: rows.map((r) => ({
          tag: r.asset.tagId,
          asset: r.asset.name,
          method: r.method[0] + r.method.slice(1).toLowerCase(),
          date: iso(r.at),
          cost: num(r.asset.purchaseCost),
          proceeds: num(r.proceeds),
          notes: r.notes ?? "",
        })),
      };
    },
  },
  {
    key: "warranty-expirations",
    name: "Warranty expirations",
    description: "Warranties by expiry date.",
    group: "Finance",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["dateFrom", "dateTo"],
    async run(orgId, p) {
      const range = dateRange(p);
      const rows = await db.warranty.findMany({
        where: { orgId, ...(range ? { endAt: range } : {}) },
        orderBy: { endAt: "asc" },
        include: { asset: { select: { tagId: true, name: true } } },
      });
      const now = Date.now();
      return {
        columns: [
          { key: "tag", label: "Tag" },
          { key: "asset", label: "Asset" },
          { key: "provider", label: "Provider" },
          { key: "start", label: "Start" },
          { key: "end", label: "Expires" },
          { key: "state", label: "State" },
        ],
        rows: rows.map((w) => ({
          tag: w.asset.tagId,
          asset: w.asset.name,
          provider: w.provider ?? "",
          start: iso(w.startAt),
          end: iso(w.endAt),
          state: w.endAt.getTime() < now ? "Expired" : "Active",
        })),
      };
    },
  },
  {
    key: "contract-expirations",
    name: "Contract & policy expirations",
    description: "Contracts and insurance policies by end date.",
    group: "Finance",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["dateFrom", "dateTo"],
    async run(orgId, p) {
      const range = dateRange(p);
      const [contracts, policies] = await Promise.all([
        db.contract.findMany({
          where: { orgId, endAt: range ? range : { not: null } },
          orderBy: { endAt: "asc" },
          include: { vendor: { select: { name: true } }, _count: { select: { assets: true } } },
        }),
        db.insurancePolicy.findMany({
          where: { orgId, endAt: range ? range : { not: null } },
          orderBy: { endAt: "asc" },
          include: { _count: { select: { assets: true } } },
        }),
      ]);
      const now = Date.now();
      const rows = [
        ...contracts.map((c) => ({
          kind: "Contract",
          name: c.name,
          party: c.vendor?.name ?? "",
          assets: c._count.assets,
          end: iso(c.endAt),
          state: c.endAt && c.endAt.getTime() < now ? "Expired" : "Active",
        })),
        ...policies.map((pl) => ({
          kind: "Insurance",
          name: pl.provider,
          party: pl.policyNo ?? "",
          assets: pl._count.assets,
          end: iso(pl.endAt),
          state: pl.endAt && pl.endAt.getTime() < now ? "Expired" : "Active",
        })),
      ].sort((a, b) => (a.end || "9999").localeCompare(b.end || "9999"));
      return {
        columns: [
          { key: "kind", label: "Kind" },
          { key: "name", label: "Name" },
          { key: "party", label: "Vendor / policy #" },
          { key: "assets", label: "Assets", align: "right" },
          { key: "end", label: "Ends" },
          { key: "state", label: "State" },
        ],
        rows,
      };
    },
  },
  {
    key: "low-stock",
    name: "Low-stock inventory",
    description: "Item/location stock at or below its reorder point.",
    group: "Inventory",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: [],
    async run(orgId) {
      const stock = await db.inventoryStock.findMany({
        where: { orgId, reorderPoint: { not: null } },
        include: {
          item: { select: { sku: true, name: true, unit: true } },
        },
      });
      const low = stock.filter((s) => s.reorderPoint != null && s.quantity <= s.reorderPoint);
      const locIds = [...new Set(low.map((s) => s.locationId))];
      const locs = await db.location.findMany({
        where: { id: { in: locIds } },
        select: { id: true, name: true, site: { select: { name: true } } },
      });
      const locName = new Map(locs.map((l) => [l.id, `${l.site.name} › ${l.name}`]));
      return {
        columns: [
          { key: "sku", label: "SKU" },
          { key: "item", label: "Item" },
          { key: "location", label: "Location" },
          { key: "qty", label: "On hand", align: "right" },
          { key: "reorder", label: "Reorder point", align: "right" },
          { key: "short", label: "Short by", align: "right" },
        ],
        rows: low
          .sort((a, b) => a.item.sku.localeCompare(b.item.sku))
          .map((s) => ({
            sku: s.item.sku,
            item: s.item.name,
            location: locName.get(s.locationId) ?? s.locationId,
            qty: s.quantity,
            reorder: s.reorderPoint,
            short: (s.reorderPoint ?? 0) - s.quantity,
          })),
      };
    },
  },
  {
    key: "inventory-ledger",
    name: "Inventory transaction ledger",
    description: "Every stock movement.",
    group: "Inventory",
    permission: PERMISSIONS.REPORT_VIEW,
    filters: ["dateFrom", "dateTo"],
    async run(orgId, p) {
      const range = dateRange(p);
      const txns = await db.inventoryTxn.findMany({
        where: { orgId, ...(range ? { at: range } : {}) },
        orderBy: { at: "desc" },
        take: 5000,
        include: { item: { select: { sku: true, name: true } } },
      });
      const locIds = [...new Set(txns.map((t) => t.locationId))];
      const locs = await db.location.findMany({
        where: { id: { in: locIds } },
        select: { id: true, name: true, site: { select: { name: true } } },
      });
      const locName = new Map(locs.map((l) => [l.id, `${l.site.name} › ${l.name}`]));
      const LABELS: Record<string, string> = {
        RECEIVE: "Received",
        ISSUE: "Issued",
        ADJUST: "Adjusted",
        TRANSFER_IN: "Transfer in",
        TRANSFER_OUT: "Transfer out",
      };
      return {
        columns: [
          { key: "when", label: "When" },
          { key: "sku", label: "SKU" },
          { key: "item", label: "Item" },
          { key: "type", label: "Type" },
          { key: "location", label: "Location" },
          { key: "change", label: "Change", align: "right" },
          { key: "reason", label: "Reason" },
        ],
        rows: txns.map((t) => ({
          when: t.at.toISOString().slice(0, 16).replace("T", " "),
          sku: t.item.sku,
          item: t.item.name,
          type: LABELS[t.type] ?? t.type,
          location: locName.get(t.locationId) ?? t.locationId,
          change: t.delta,
          reason: t.reason ?? "",
        })),
      };
    },
  },
  {
    key: "activity-log",
    name: "Activity log",
    description: "Every recorded user action.",
    group: "Custody",
    permission: PERMISSIONS.ACTIVITY_VIEW,
    filters: ["dateFrom", "dateTo"],
    async run(orgId, p) {
      const range = dateRange(p);
      const rows = await db.activityLog.findMany({
        where: { orgId, ...(range ? { at: range } : {}) },
        orderBy: { at: "desc" },
        take: 5000,
      });
      const userIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean) as string[])];
      const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
      const nameOf = new Map(users.map((u) => [u.id, u.name ?? u.email]));
      return {
        columns: [
          { key: "when", label: "When" },
          { key: "actor", label: "Actor" },
          { key: "entity", label: "Entity" },
          { key: "action", label: "Action" },
          { key: "ref", label: "Reference" },
        ],
        rows: rows.map((r) => ({
          when: r.at.toISOString().slice(0, 16).replace("T", " "),
          actor: r.actorId ? nameOf.get(r.actorId) ?? "—" : "System",
          entity: r.entityType,
          action: r.action,
          ref: r.entityId,
        })),
      };
    },
  },
];

export function getReport(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function groupCount(items: { key: string; cost: number; book: number }[], label: string): ReportResult {
  const map = new Map<string, { key: string; count: number; cost: number; book: number }>();
  for (const it of items) {
    const e = map.get(it.key) ?? { key: it.key, count: 0, cost: 0, book: 0 };
    e.count++;
    e.cost += it.cost;
    e.book += it.book;
    map.set(it.key, e);
  }
  return {
    columns: [
      { key: "key", label: label },
      { key: "count", label: "Assets", align: "right" },
      { key: "cost", label: "Purchase value", align: "right" },
      { key: "book", label: "Book value", align: "right" },
    ],
    rows: [...map.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((e) => ({ key: e.key, count: e.count, cost: round(e.cost), book: round(e.book) })),
  };
}
