"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/authz";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { runDepreciationClose } from "@/lib/depreciation-close";

export async function runCloseNow(): Promise<void> {
  const ctx = await requirePermission(PERMISSIONS.FINANCIALS_MANAGE);
  const res = await runDepreciationClose();
  await writeActivity({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    entityType: "Depreciation",
    entityId: "close",
    action: "RUN_CLOSE",
    after: res,
  });
  revalidatePath("/depreciation");
  revalidatePath("/dashboard");
}
