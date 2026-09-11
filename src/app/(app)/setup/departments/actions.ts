"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { makeCrudActions } from "@/lib/crud";
import { zText } from "@/lib/form";

const schema = z.object({ name: zText });

export const { createAction, updateAction, deleteAction } = makeCrudActions({
  permission: PERMISSIONS.SETUP_MANAGE,
  basePath: "/setup/departments",
  entityType: "Department",
  schema,
  uniqueMessage: "A department with that name already exists.",
  create: (ctx, data) => db.department.create({ data: { orgId: ctx.orgId, name: data.name } }),
  update: (ctx, id, data) =>
    db.department.update({ where: { id, orgId: ctx.orgId }, data: { name: data.name } }),
  remove: (ctx, id) => db.department.delete({ where: { id, orgId: ctx.orgId } }),
});
