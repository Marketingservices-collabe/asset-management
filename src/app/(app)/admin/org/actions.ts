"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { parseForm, type FormState, zText } from "@/lib/form";

const schema = z.object({
  name: zText.max(120),
  currency: z.string().trim().toUpperCase().pipe(z.string().length(3, "Use a 3-letter code")),
  dateFormat: z.enum(["MMM d, yyyy", "d MMM yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy"]),
  fiscalYearStartMonth: z
    .string()
    .trim()
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n >= 1 && n <= 12, "Pick a month"),
});

export async function updateOrg(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.ORG_SETTINGS);
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  await db.organization.update({
    where: { id: ctx.orgId },
    data: {
      name: d.name,
      settings: {
        currency: d.currency,
        dateFormat: d.dateFormat,
        fiscalYearStartMonth: d.fiscalYearStartMonth,
      },
    },
  });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Organization", entityId: ctx.orgId, action: "UPDATE", after: d });
  revalidatePath("/admin/org");
  revalidatePath("/", "layout");
  return { ok: true };
}
