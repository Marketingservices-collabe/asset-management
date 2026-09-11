"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { parseForm, type FormState, zText } from "@/lib/form";

const PERM_SET = new Set<string>(ALL_PERMISSIONS);

function pickPermissions(formData: FormData): string[] {
  return formData
    .getAll("permissions")
    .map(String)
    .filter((p) => PERM_SET.has(p));
}

export async function createRole(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.USER_MANAGE);
  const parsed = parseForm(z.object({ name: zText.max(60) }), formData);
  if (!parsed.success) return parsed.state;
  try {
    const role = await db.role.create({
      data: { orgId: ctx.orgId, name: parsed.data.name, permissions: pickPermissions(formData), isSystem: false },
    });
    await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Role", entityId: role.id, action: "CREATE", after: { name: parsed.data.name } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: "A role with that name already exists." };
    throw e;
  }
  revalidatePath("/admin/roles");
  redirect("/admin/roles");
}

export async function updateRole(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing id." };
  const role = await db.role.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!role) return { error: "Role not found." };

  const name = String(formData.get("name") ?? "").trim() || role.name;
  await db.role.update({
    where: { id },
    data: { name: role.isSystem ? role.name : name, permissions: pickPermissions(formData) },
  });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Role", entityId: id, action: "UPDATE" });
  revalidatePath("/admin/roles");
  redirect("/admin/roles");
}

export async function deleteRole(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const role = await db.role.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { _count: { select: { memberships: true } } },
  });
  if (!role || role.isSystem || role._count.memberships > 0) return;
  await db.role.delete({ where: { id } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Role", entityId: id, action: "DELETE" });
  revalidatePath("/admin/roles");
  redirect("/admin/roles");
}
