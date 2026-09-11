import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatMoney } from "@/lib/utils";
import { CrudManager } from "@/components/crud/crud-manager";
import type { FieldSpec } from "@/components/crud/types";
import { createAction, updateAction, deleteAction } from "./actions";

const fields: FieldSpec[] = [
  { name: "name", label: "Name", type: "text", required: true, column: true },
  { name: "code", label: "Code", type: "text", column: true },
  { name: "amount", label: "Budget amount", type: "number", column: true, render: (r) => formatMoney(r.amount as number | null) },
  { name: "source", label: "Source", type: "text", column: true, hint: "Grantor, program, department budget…" },
  { name: "allocated", label: "", type: "text", displayOnly: true, column: true },
  { name: "assetCount", label: "", type: "text", displayOnly: true, column: true },
];

export default async function FundsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.FINANCIALS_VIEW)) redirect("/dashboard");
  const sp = await searchParams;

  const funds = await db.fund.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { assets: true } },
      assets: { select: { purchaseCost: true } },
    },
  });

  const rows = funds.map((f) => {
    const allocated = f.assets.reduce((s, a) => s + (a.purchaseCost ? Number(a.purchaseCost) : 0), 0);
    return {
      id: f.id,
      name: f.name,
      code: f.code,
      amount: f.amount ? Number(f.amount) : null,
      source: f.source,
      assetCount: `${f._count.assets} asset${f._count.assets === 1 ? "" : "s"}`,
      allocated: formatMoney(allocated),
    };
  });

  // relabel the two computed columns after building fields (kept generic in FieldSpec)
  const displayFields = fields.map((f) =>
    f.name === "allocated" ? { ...f, label: "Allocated" } : f.name === "assetCount" ? { ...f, label: "Assets" } : f,
  );

  return (
    <CrudManager
      title="Funds"
      description="Grants and budget lines assets are charged against."
      singular="fund"
      basePath="/funds"
      fields={displayFields}
      rows={rows}
      canManage={can(ctx.permissions, PERMISSIONS.FINANCIALS_MANAGE)}
      searchParams={sp}
      createAction={createAction}
      updateAction={updateAction}
      deleteAction={deleteAction}
    />
  );
}
