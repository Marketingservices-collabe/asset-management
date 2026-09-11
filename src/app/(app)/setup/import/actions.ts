"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { commitAssetImport, type ImportMapping, type ImportResult } from "@/lib/import";

export type ImportState = { done?: boolean; result?: ImportResult; error?: string };

export async function runImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const ctx = await requirePermission(PERMISSIONS.ASSET_CREATE);
  const csvText = String(formData.get("csvText") ?? "");
  let mapping: ImportMapping;
  try {
    mapping = JSON.parse(String(formData.get("mapping") ?? "{}"));
  } catch {
    return { error: "Bad mapping payload." };
  }
  if (!csvText.trim()) return { error: "Paste or upload a CSV first." };

  let result: ImportResult;
  try {
    result = await commitAssetImport(ctx.orgId, csvText, mapping);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }

  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "Import",
    entityId: "assets",
    action: "IMPORT",
    after: { created: result.created, skipped: result.skipped, createdRefs: result.createdRefs },
  });

  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { done: true, result };
}
