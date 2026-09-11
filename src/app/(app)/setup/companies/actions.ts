"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { makeCrudActions } from "@/lib/crud";
import { zText, zOptionalText, zOptionalEmail } from "@/lib/form";

const zBool = z
  .union([z.literal("on"), z.literal("true"), z.undefined()])
  .transform((v) => v === "on" || v === "true");

const schema = z.object({
  name: zText,
  isVendor: zBool,
  isManufacturer: zBool,
  isCustomer: zBool,
  contactName: zOptionalText,
  email: zOptionalEmail,
  phone: zOptionalText,
  address: zOptionalText,
});

function data(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    isVendor: d.isVendor,
    isManufacturer: d.isManufacturer,
    isCustomer: d.isCustomer,
    contactName: d.contactName ?? null,
    email: d.email ?? null,
    phone: d.phone ?? null,
    address: d.address ?? null,
  };
}

export const { createAction, updateAction, deleteAction } = makeCrudActions({
  permission: PERMISSIONS.SETUP_MANAGE,
  basePath: "/setup/companies",
  entityType: "Company",
  schema,
  uniqueMessage: "A company with that name already exists.",
  create: (ctx, d) => db.company.create({ data: { orgId: ctx.orgId, ...data(d) } }),
  update: (ctx, id, d) => db.company.update({ where: { id, orgId: ctx.orgId }, data: data(d) }),
  remove: (ctx, id) => db.company.delete({ where: { id, orgId: ctx.orgId } }),
});
