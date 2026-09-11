"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { makeCrudActions } from "@/lib/crud";
import { zText, zOptionalInt } from "@/lib/form";

const METHODS = [
  "STRAIGHT_LINE",
  "DECLINING_BALANCE_200",
  "DECLINING_BALANCE_150",
  "SUM_OF_YEARS_DIGITS",
  "NONE",
] as const;

const schema = z.object({
  name: zText,
  depreciationMethod: z.enum(METHODS).default("STRAIGHT_LINE"),
  defaultUsefulLifeMo: zOptionalInt,
});

export const { createAction, updateAction, deleteAction } = makeCrudActions({
  permission: PERMISSIONS.SETUP_MANAGE,
  basePath: "/setup/categories",
  entityType: "Category",
  schema,
  uniqueMessage: "A category with that name already exists.",
  create: (ctx, data) =>
    db.category.create({
      data: {
        orgId: ctx.orgId,
        name: data.name,
        depreciationMethod: data.depreciationMethod,
        defaultUsefulLifeMo: data.defaultUsefulLifeMo ?? null,
      },
    }),
  update: (ctx, id, data) =>
    db.category.update({
      where: { id, orgId: ctx.orgId },
      data: {
        name: data.name,
        depreciationMethod: data.depreciationMethod,
        defaultUsefulLifeMo: data.defaultUsefulLifeMo ?? null,
      },
    }),
  remove: (ctx, id) => db.category.delete({ where: { id, orgId: ctx.orgId } }),
});
