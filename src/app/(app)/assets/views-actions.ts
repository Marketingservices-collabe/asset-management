"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/session";

const ALLOWED = ["q", "category", "site", "status"] as const;

export async function saveView(formData: FormData): Promise<void> {
  const ctx = await requireContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const raw = String(formData.get("query") ?? "");
  const src = new URLSearchParams(raw);
  const config: Record<string, string> = {};
  for (const k of ALLOWED) {
    const v = src.get(k);
    if (v) config[k] = v;
  }
  await db.savedView.create({
    data: { orgId: ctx.orgId, userId: ctx.userId, entity: "ASSET", name, configJson: config },
  });
  revalidatePath("/assets");
}

export async function deleteView(formData: FormData): Promise<void> {
  const ctx = await requireContext();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.savedView.deleteMany({ where: { id, orgId: ctx.orgId, userId: ctx.userId } });
  revalidatePath("/assets");
}
