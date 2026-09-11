"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getContext } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { randomSecret, verifyTotp, otpauthUrl } from "@/lib/totp";
import type { FormState } from "@/lib/form";

async function me() {
  const ctx = await getContext();
  if (!ctx) throw new Error("Not authenticated");
  const user = await db.user.findUnique({ where: { id: ctx.userId } });
  if (!user) throw new Error("User not found");
  return { ctx, user };
}

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const { ctx, user } = await me();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (user.passwordHash) {
    const ok = await bcrypt.compare(current, user.passwordHash);
    if (!ok) return { error: "Current password is incorrect." };
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "User", entityId: user.id, action: "CHANGE_PASSWORD" });
  return { ok: true };
}

export type TwoFactorSetup = { secret?: string; url?: string; error?: string; ok?: boolean };

export async function beginTwoFactor(): Promise<TwoFactorSetup> {
  const { user } = await me();
  const secret = randomSecret();
  return { secret, url: otpauthUrl(secret, user.email) };
}

export async function confirmTwoFactor(_state: TwoFactorSetup, formData: FormData): Promise<TwoFactorSetup> {
  const { ctx, user } = await me();
  const secret = String(formData.get("secret") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!secret) return { error: "Start setup again." };
  if (!verifyTotp(secret, code)) return { secret, url: otpauthUrl(secret, user.email), error: "That code didn't match. Check your authenticator and try again." };
  await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "User", entityId: user.id, action: "ENABLE_2FA" });
  revalidatePath("/account");
  return { ok: true };
}

export async function disableTwoFactor(_state: FormState, formData: FormData): Promise<FormState> {
  const { ctx, user } = await me();
  if (!user.twoFactorSecret) return { ok: true };
  const code = String(formData.get("code") ?? "");
  if (!verifyTotp(user.twoFactorSecret, code)) return { error: "Enter a current code to disable 2FA." };
  await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: null } });
  await writeActivity({ orgId: ctx.orgId, actorId: ctx.userId, entityType: "User", entityId: user.id, action: "DISABLE_2FA" });
  revalidatePath("/account");
  return { ok: true };
}
