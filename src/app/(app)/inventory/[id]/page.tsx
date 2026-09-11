import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate } from "@/lib/utils";
import { TXN_LABELS } from "@/lib/inventory";
import { PageHeader } from "@/components/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { DeleteButton } from "@/components/crud/delete-button";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { StockActions } from "./stock-actions";
import { deleteItem, setReorderPoint } from "../actions";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.INVENTORY_VIEW)) redirect("/dashboard");
  const canManage = can(ctx.permissions, PERMISSIONS.INVENTORY_MANAGE);
  const { id } = await params;

  const [item, allLocations] = await Promise.all([
    db.inventoryItem.findFirst({
      where: { id, orgId: ctx.orgId },
      include: {
        category: { select: { name: true } },
        stock: { orderBy: { quantity: "desc" } },
        txns: {
          orderBy: { at: "desc" },
          take: 40,
        },
      },
    }),
    db.location.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, site: { select: { name: true } } },
    }),
  ]);
  if (!item) notFound();

  const locName = new Map(allLocations.map((l) => [l.id, `${l.site.name} › ${l.name}`]));
  const onHand = item.stock.reduce((s, r) => s + r.quantity, 0);
  const low = item.stock.some((r) => r.reorderPoint != null && r.quantity <= r.reorderPoint);

  return (
    <>
      <PageHeader
        title={item.name}
        description={`SKU ${item.sku}${item.category ? ` · ${item.category.name}` : ""}`}
        back={{ label: "Inventory", href: "/inventory" }}
        action={canManage ? { label: "Edit", href: `/inventory?form=1&id=${item.id}` } : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0">Stock by location</SectionTitle>
              <span className="text-sm text-[var(--muted)]">
                {onHand} {item.unit} on hand {low ? <StatusBadge status="OVERDUE" /> : null}
              </span>
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Location</Th>
                  <Th className="text-right">Quantity</Th>
                  <Th className="text-right">Reorder point</Th>
                </tr>
              </thead>
              <tbody>
                {item.stock.length === 0 ? (
                  <EmptyRow colSpan={3}>No stock recorded. Use “Receive” to add some.</EmptyRow>
                ) : (
                  item.stock.map((s) => {
                    const isLow = s.reorderPoint != null && s.quantity <= s.reorderPoint;
                    return (
                      <TrLink key={s.id}>
                        <Td>{locName.get(s.locationId) ?? s.locationId}</Td>
                        <Td className={`text-right tabular-nums ${isLow ? "font-medium text-red-600" : ""}`}>
                          {s.quantity}
                        </Td>
                        <Td className="text-right">
                          {canManage ? (
                            <form action={setReorderPoint} className="flex justify-end">
                              <input type="hidden" name="itemId" value={item.id} />
                              <input type="hidden" name="locationId" value={s.locationId} />
                              <input
                                key={`${s.id}-${s.reorderPoint ?? ""}`}
                                name="reorderPoint"
                                type="number"
                                min={0}
                                defaultValue={s.reorderPoint ?? ""}
                                aria-label="Reorder point"
                                className="h-7 w-20 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-right text-sm"
                              />
                            </form>
                          ) : (
                            (s.reorderPoint ?? "—")
                          )}
                        </Td>
                      </TrLink>
                    );
                  })
                )}
              </tbody>
            </Table>
            {canManage ? (
              <p className="mt-2 text-xs text-[var(--muted)]">Edit a reorder point and press Enter to save.</p>
            ) : null}
          </Card>

          <Card>
            <SectionTitle>Transaction ledger</SectionTitle>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Type</Th>
                  <Th>Location</Th>
                  <Th className="text-right">Change</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {item.txns.length === 0 ? (
                  <EmptyRow colSpan={5}>No transactions yet.</EmptyRow>
                ) : (
                  item.txns.map((t) => (
                    <TrLink key={t.id}>
                      <Td className="whitespace-nowrap text-[var(--muted)]">{formatDate(t.at)}</Td>
                      <Td>{TXN_LABELS[t.type] ?? t.type}</Td>
                      <Td>{locName.get(t.locationId) ?? "—"}</Td>
                      <Td className={`text-right tabular-nums ${t.delta < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {t.delta > 0 ? "+" : ""}
                        {t.delta}
                      </Td>
                      <Td className="text-[var(--muted)]">{t.reason ?? "—"}</Td>
                    </TrLink>
                  ))
                )}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-4">
          {canManage ? (
            <StockActions
              itemId={item.id}
              unit={item.unit}
              locations={allLocations.map((l) => ({ value: l.id, label: `${l.site.name} › ${l.name}` }))}
            />
          ) : null}

          {canManage ? (
            <Card>
              <SectionTitle>Danger zone</SectionTitle>
              <p className="mb-2 text-xs text-[var(--muted)]">Deletes the item and its ledger permanently.</p>
              <DeleteButton id={item.id} action={deleteItem} label="Delete item" confirmText={`Delete "${item.name}"?`} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
