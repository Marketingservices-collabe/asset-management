import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Permission } from "@/lib/authz";
import type { AppContext } from "@/lib/session";
import { requirePermission } from "@/lib/session";
import { writeActivity } from "@/lib/activity";
import { parseForm, type FormState } from "@/lib/form";

type Ctx = AppContext;

export function makeCrudActions<S extends z.ZodType>(opts: {
  permission: Permission;
  basePath: string;
  entityType: string;
  schema: S;
  create: (ctx: Ctx, data: z.infer<S>) => Promise<{ id: string }>;
  update: (ctx: Ctx, id: string, data: z.infer<S>) => Promise<{ id: string }>;
  remove: (ctx: Ctx, id: string) => Promise<unknown>;
  /** human label for the friendly unique-constraint error */
  uniqueMessage?: string;
}) {
  async function createAction(_state: FormState, formData: FormData): Promise<FormState> {
    const ctx = await requirePermission(opts.permission);
    const parsed = parseForm(opts.schema, formData);
    if (!parsed.success) return parsed.state;
    let created: { id: string };
    try {
      created = await opts.create(ctx, parsed.data);
    } catch (e) {
      return handlePrismaError(e, opts.uniqueMessage);
    }
    await writeActivity({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: opts.entityType,
      entityId: created.id,
      action: "CREATE",
      after: parsed.data,
    });
    revalidatePath(opts.basePath);
    redirect(opts.basePath);
  }

  async function updateAction(_state: FormState, formData: FormData): Promise<FormState> {
    const ctx = await requirePermission(opts.permission);
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Missing id." };
    const parsed = parseForm(opts.schema, formData);
    if (!parsed.success) return parsed.state;
    try {
      await opts.update(ctx, id, parsed.data);
    } catch (e) {
      return handlePrismaError(e, opts.uniqueMessage);
    }
    await writeActivity({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: opts.entityType,
      entityId: id,
      action: "UPDATE",
      after: parsed.data,
    });
    revalidatePath(opts.basePath);
    redirect(opts.basePath);
  }

  async function deleteAction(formData: FormData): Promise<void> {
    const ctx = await requirePermission(opts.permission);
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    try {
      await opts.remove(ctx, id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        redirect(`${opts.basePath}?error=in-use`);
      }
      throw e;
    }
    await writeActivity({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: opts.entityType,
      entityId: id,
      action: "DELETE",
    });
    revalidatePath(opts.basePath);
    redirect(opts.basePath);
  }

  return { createAction, updateAction, deleteAction };
}

function handlePrismaError(e: unknown, uniqueMessage?: string): FormState {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { error: uniqueMessage ?? "That name is already in use." };
    if (e.code === "P2003") return { error: "A referenced record does not exist." };
  }
  throw e;
}
