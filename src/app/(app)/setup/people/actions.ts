"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { makeCrudActions } from "@/lib/crud";
import { zText, zOptionalText, zOptionalEmail } from "@/lib/form";

const schema = z.object({
  name: zText,
  email: zOptionalEmail,
  phone: zOptionalText,
});

export const { createAction, updateAction, deleteAction } = makeCrudActions({
  permission: PERMISSIONS.SETUP_MANAGE,
  basePath: "/setup/people",
  entityType: "Person",
  schema,
  create: (ctx, data) =>
    db.person.create({
      data: { orgId: ctx.orgId, name: data.name, email: data.email ?? null, phone: data.phone ?? null },
    }),
  update: (ctx, id, data) =>
    db.person.update({
      where: { id, orgId: ctx.orgId },
      data: { name: data.name, email: data.email ?? null, phone: data.phone ?? null },
    }),
  remove: (ctx, id) => db.person.delete({ where: { id, orgId: ctx.orgId } }),
});
