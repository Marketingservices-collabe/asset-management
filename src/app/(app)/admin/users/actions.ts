"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { parseForm, type FormState } from "@/lib/form";

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  name: z.string().trim().optional(),
  roleId: z.string().trim().min(1, "Pick a role"),
  password: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : undefined))
    .refine((v) => v === undefined || v.length >= 8, "At least 8 characters"),
});

export async function addMember(_state: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission(PERMISSIONS.USER_MANAGE);
  const parsed = parseForm(addSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  const role = await db.role.findFirst({ where: { id: d.roleId, orgId: ctx.orgId } });
  if (!role) return { error: "Role not found." };

  const user = await db.user.upsert({
    where: { email: d.email },
    update: {
      ...(d.name ? { name: d.name } : {}),
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    },
    create: {
      email: d.email,
      name: d.name || null,
      passwordHash: d.password ? await bcrypt.hash(d.password, 10) : null,
    },
  });

  const existing = await db.membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId: ctx.orgId } } });
  if (existing) return { error: "That person is already a member." };

  await db.membership.create({
    data: { userId: user.id, orgId: ctx.orgId, roleId: d.roleId, status: "ACTIVE" },
  });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Membership", entityId: user.id, action: "ADD_MEMBER", after: { email: d.email, role: role.name } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setMemberRole(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get("id") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!id || !roleId) return;
  const [membership, role] = await Promise.all([
    db.membership.findFirst({ where: { id, orgId: ctx.orgId } }),
    db.role.findFirst({ where: { id: roleId, orgId: ctx.orgId } }),
  ]);
  if (!membership || !role) return;
  await db.membership.update({ where: { id }, data: { roleId } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Membership", entityId: id, action: "SET_ROLE", after: { role: role.name } });
  revalidatePath("/admin/users");
}

export async function setMemberStatus(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["ACTIVE", "DISABLED"].includes(status)) return;
  const membership = await db.membership.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!membership) return;
  if (membership.userId === ctx.userId) return; // can't disable yourself
  await db.membership.update({ where: { id }, data: { status } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Membership", entityId: id, action: status === "ACTIVE" ? "ENABLE" : "DISABLE" });
  revalidatePath("/admin/users");
}

export async function removeMember(formData: FormData): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const membership = await db.membership.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!membership || membership.userId === ctx.userId) return;
  await db.membership.delete({ where: { id } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "Membership", entityId: id, action: "REMOVE_MEMBER" });
  revalidatePath("/admin/users");
}
