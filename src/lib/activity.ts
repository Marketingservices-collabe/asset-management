import { headers } from "next/headers";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type Client = PrismaClient | Prisma.TransactionClient;

export type ActivityInput = {
  orgId: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Append an immutable audit-log row. Call inside the same transaction as the mutation:
 *   await db.$transaction(async (tx) => { ...write...; await writeActivity(input, tx); })
 */
export async function writeActivity(input: ActivityInput, client: Client = db) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  } catch {
    // not in a request context (e.g. cron/seed)
  }

  await client.activityLog.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeJson: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      afterJson: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ip,
    },
  });
}

/** Asset-scoped timeline entry shown on the asset detail page. */
export async function writeAssetEvent(
  data: { assetId: string; type: string; actorId: string | null; summary: string; dataJson?: unknown },
  client: Client = db,
) {
  await client.assetEvent.create({
    data: {
      assetId: data.assetId,
      type: data.type,
      actorId: data.actorId,
      summary: data.summary,
      dataJson: (data.dataJson ?? {}) as Prisma.InputJsonValue,
    },
  });
}
