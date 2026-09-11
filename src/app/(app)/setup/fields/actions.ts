"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { makeCrudActions } from "@/lib/crud";
import { zText, zOptionalText, zOptionalInt } from "@/lib/form";

const TYPES = ["TEXT", "NUMBER", "DATE", "BOOL", "SELECT"] as const;

const zBool = z
  .union([z.literal("on"), z.literal("true"), z.undefined()])
  .transform((v) => v === "on" || v === "true");

const schema = z.object({
  label: zText,
  key: z
    .string()
    .trim()
    .min(1, "Required")
    .transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")),
  type: z.enum(TYPES).default("TEXT"),
  categoryId: zOptionalText,
  options: zOptionalText,
  required: zBool,
  order: zOptionalInt,
});

function toData(d: z.infer<typeof schema>) {
  return {
    label: d.label,
    key: d.key,
    type: d.type,
    categoryId: d.categoryId ?? null,
    options:
      d.type === "SELECT" && d.options
        ? d.options.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
        : [],
    required: d.required,
    order: d.order ?? 0,
  };
}

async function assertCategory(orgId: string, categoryId?: string | null) {
  if (!categoryId) return;
  const c = await db.category.findFirst({ where: { id: categoryId, orgId }, select: { id: true } });
  if (!c) throw new Error("Selected category not found.");
}

export const { createAction, updateAction, deleteAction } = makeCrudActions({
  permission: PERMISSIONS.SETUP_MANAGE,
  basePath: "/setup/fields",
  entityType: "CustomFieldDef",
  schema,
  uniqueMessage: "A field with that key already exists for this category.",
  create: async (ctx, d) => {
    await assertCategory(ctx.orgId, d.categoryId);
    return db.customFieldDef.create({ data: { orgId: ctx.orgId, ...toData(d) } });
  },
  update: async (ctx, id, d) => {
    await assertCategory(ctx.orgId, d.categoryId);
    return db.customFieldDef.update({ where: { id, orgId: ctx.orgId }, data: toData(d) });
  },
  remove: (ctx, id) => db.customFieldDef.delete({ where: { id, orgId: ctx.orgId } }),
});
