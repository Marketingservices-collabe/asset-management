"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { makeCrudActions } from "@/lib/crud";
import type { FormState } from "@/lib/form";
import { zText, zOptionalText, zOptionalDecimal } from "@/lib/form";

/* ── Sites ────────────────────────────────────────────── */

const siteSchema = z.object({
  name: zText,
  address: zOptionalText,
  lat: zOptionalDecimal,
  lng: zOptionalDecimal,
});

function siteData(d: z.infer<typeof siteSchema>) {
  return {
    name: d.name,
    address: d.address ?? null,
    lat: d.lat != null ? Number(d.lat) : null,
    lng: d.lng != null ? Number(d.lng) : null,
  };
}

const site = makeCrudActions({
  permission: PERMISSIONS.SETUP_MANAGE,
  basePath: "/setup/locations",
  entityType: "Site",
  schema: siteSchema,
  uniqueMessage: "A site with that name already exists.",
  create: (ctx, d) => db.site.create({ data: { orgId: ctx.orgId, ...siteData(d) } }),
  update: (ctx, id, d) => db.site.update({ where: { id, orgId: ctx.orgId }, data: siteData(d) }),
  remove: (ctx, id) => db.site.delete({ where: { id, orgId: ctx.orgId } }),
});

export async function createSite(state: FormState, fd: FormData) {
  return site.createAction(state, fd);
}
export async function updateSite(state: FormState, fd: FormData) {
  return site.updateAction(state, fd);
}
export async function deleteSite(fd: FormData) {
  return site.deleteAction(fd);
}

/* ── Locations ────────────────────────────────────────── */

const locationSchema = z.object({
  name: zText,
  siteId: zText,
  parentId: zOptionalText,
});

async function assertSite(orgId: string, siteId: string) {
  const found = await db.site.findFirst({ where: { id: siteId, orgId }, select: { id: true } });
  if (!found) throw new Error("Selected site not found.");
}

const location = makeCrudActions({
  permission: PERMISSIONS.SETUP_MANAGE,
  basePath: "/setup/locations",
  entityType: "Location",
  schema: locationSchema,
  create: async (ctx, d) => {
    await assertSite(ctx.orgId, d.siteId);
    return db.location.create({
      data: { orgId: ctx.orgId, siteId: d.siteId, name: d.name, parentId: d.parentId ?? null },
    });
  },
  update: async (ctx, id, d) => {
    await assertSite(ctx.orgId, d.siteId);
    if (d.parentId === id) throw new Error("A location cannot be its own parent.");
    return db.location.update({
      where: { id, orgId: ctx.orgId },
      data: { siteId: d.siteId, name: d.name, parentId: d.parentId ?? null },
    });
  },
  remove: (ctx, id) => db.location.delete({ where: { id, orgId: ctx.orgId } }),
});

export async function createLocation(state: FormState, fd: FormData) {
  return location.createAction(state, fd);
}
export async function updateLocation(state: FormState, fd: FormData) {
  return location.updateAction(state, fd);
}
export async function deleteLocation(fd: FormData) {
  return location.deleteAction(fd);
}
