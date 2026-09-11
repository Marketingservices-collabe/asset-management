"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { makeCrudActions } from "@/lib/crud";
import { zText, zOptionalText, zOptionalDecimal } from "@/lib/form";

const schema = z.object({
  name: zText,
  code: zOptionalText,
  amount: zOptionalDecimal,
  source: zOptionalText,
});

function data(d: z.infer<typeof schema>) {
  return {
    name: d.name,
    code: d.code ?? null,
    source: d.source ?? null,
    amount: d.amount != null ? new Prisma.Decimal(d.amount) : null,
  };
}

export const { createAction, updateAction, deleteAction } = makeCrudActions({
  permission: PERMISSIONS.FINANCIALS_MANAGE,
  basePath: "/funds",
  entityType: "Fund",
  schema,
  uniqueMessage: "A fund with that name already exists.",
  create: (ctx, d) => db.fund.create({ data: { orgId: ctx.orgId, ...data(d) } }),
  update: (ctx, id, d) => db.fund.update({ where: { id, orgId: ctx.orgId }, data: data(d) }),
  remove: (ctx, id) => db.fund.delete({ where: { id, orgId: ctx.orgId } }),
});
