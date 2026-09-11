"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/session";

export async function markRead(formData: FormData): Promise<void> {
  const ctx = await requireContext();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.notification.updateMany({
    where: { id, orgId: ctx.orgId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllRead(): Promise<void> {
  const ctx = await requireContext();
  await db.notification.updateMany({
    where: { orgId: ctx.orgId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
