import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { ItemForm } from "./item-form";
import { createItem, updateItem } from "./actions";

const BASE = "/inventory";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; id?: string }>;
}) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.INVENTORY_VIEW)) redirect("/dashboard");
  const canManage = can(ctx.permissions, PERMISSIONS.INVENTORY_MANAGE);
  const sp = await searchParams;

  const [categories, items] = await Promise.all([
    db.category.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.inventoryItem.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      include: {
        category: { select: { name: true } },
        stock: { select: { quantity: true, reorderPoint: true } },
      },
    }),
  ]);

  if (canManage && sp.form) {
    const editing = sp.id ? items.find((i) => i.id === sp.id) : null;
    return (
      <>
        <PageHeader
          title={editing ? "Edit item" : "New inventory item"}
          back={{ label: "Inventory", href: BASE }}
        />
        <Card className="max-w-2xl">
          <ItemForm
            action={editing ? updateItem : createItem}
            categories={categories.map((c) => ({ value: c.id, label: c.name }))}
            initial={editing}
            submitLabel={editing ? "Save changes" : "Create item"}
          />
        </Card>
      </>
    );
  }

  const rows = items.map((i) => {
    const onHand = i.stock.reduce((s, r) => s + r.quantity, 0);
    const low = i.stock.some((r) => r.reorderPoint != null && r.quantity <= r.reorderPoint);
    return { i, onHand, low, locations: i.stock.length };
  });

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Consumable stock tracked by quantity and location."
        action={canManage ? { label: "Add item", href: `${BASE}?form=1` } : undefined}
      />
      <Table>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Name</Th>
            <Th>Category</Th>
            <Th className="text-right">On hand</Th>
            <Th className="text-right">Locations</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6}>No inventory items yet.</EmptyRow>
          ) : (
            rows.map(({ i, onHand, low, locations }) => (
              <TrLink key={i.id}>
                <Td className="font-mono text-xs">
                  <Link href={`${BASE}/${i.id}`} className="text-brand hover:underline">
                    {i.sku}
                  </Link>
                </Td>
                <Td>
                  <Link href={`${BASE}/${i.id}`} className="hover:underline">
                    {i.name}
                  </Link>
                </Td>
                <Td>{i.category?.name ?? "—"}</Td>
                <Td className="text-right tabular-nums">
                  {onHand} {i.unit}
                </Td>
                <Td className="text-right tabular-nums">{locations}</Td>
                <Td>{low ? <StatusBadge status="OVERDUE" /> : <StatusBadge status="ACTIVE" />}</Td>
              </TrLink>
            ))
          )}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-[var(--muted)]">
        <StatusBadge status="OVERDUE" /> = at or below a reorder point. Low-stock alerts fire on the daily scan.
      </p>
    </>
  );
}
