import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Permission } from "@/lib/authz";
import { can } from "@/lib/authz";

export type AppContext = {
  userId: string;
  email: string;
  name: string | null;
  orgId: string;
  orgName: string;
  roleName: string;
  permissions: string[];
};

/**
 * Resolve the current user, their org membership and effective permissions.
 * Single-org for v1: we take the user's first ACTIVE membership.
 * Cached per request.
 */
export const getContext = cache(async (): Promise<AppContext | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { org: true, role: true, user: true },
    orderBy: { org: { createdAt: "asc" } },
  });
  if (!membership) return null;

  return {
    userId: membership.userId,
    email: membership.user.email,
    name: membership.user.name,
    orgId: membership.orgId,
    orgName: membership.org.name,
    roleName: membership.role.name,
    permissions: membership.role.permissions,
  };
});

/** Use in pages/layouts: redirects to login if not authenticated, or to /no-access if no org. */
export async function requireContext(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) {
    const session = await auth();
    if (!session) redirect("/login");
    redirect("/no-access");
  }
  return ctx;
}

/** Use in Server Actions: throws instead of redirecting. */
export async function requirePermission(required: Permission): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) throw new Error("Not authenticated");
  if (!can(ctx.permissions, required)) throw new Error(`Missing permission: ${required}`);
  return ctx;
}
