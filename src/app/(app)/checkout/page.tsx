import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { CheckoutForm } from "./checkout-form";
import { checkInAsset } from "../assets/actions";

const BLOCKED = ["CHECKED_OUT", "LEASED", "DISPOSED", "LOST"] as const;

export default async function CheckoutPage() {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.CHECKOUT_MANAGE)) redirect("/assets");

  const [available, people, locations, openCheckouts] = await Promise.all([
    db.asset.findMany({
      where: { orgId: ctx.orgId, status: { notIn: [...BLOCKED] } },
      orderBy: { tagId: "asc" },
      select: { id: true, tagId: true, name: true },
    }),
    db.person.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.location.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, site: { select: { name: true } } },
    }),
    db.checkoutRecord.findMany({
      where: { orgId: ctx.orgId, checkedInAt: null },
      orderBy: { checkedOutAt: "desc" },
      include: {
        asset: { select: { id: true, tagId: true, name: true } },
        person: { select: { name: true } },
      },
    }),
  ]);

  const now = new Date();

  return (
    <>
      <PageHeader title="Check-in / out" description="Track who has what." />

      <div className="mb-8">
        <CheckoutForm
          assets={available.map((a) => ({ value: a.id, label: `${a.tagId} — ${a.name}` }))}
          people={people.map((p) => ({ value: p.id, label: p.name }))}
          locations={locations.map((l) => ({ value: l.id, label: `${l.site.name} › ${l.name}` }))}
        />
      </div>

      <SectionTitle>Currently checked out ({openCheckouts.length})</SectionTitle>
      <Table>
        <thead>
          <tr>
            <Th>Tag</Th>
            <Th>Asset</Th>
            <Th>Holder</Th>
            <Th>Since</Th>
            <Th>Due</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {openCheckouts.length === 0 ? (
            <EmptyRow colSpan={6}>Nothing is checked out.</EmptyRow>
          ) : (
            openCheckouts.map((c) => {
              const overdue = c.dueAt && c.dueAt < now;
              return (
                <TrLink key={c.id}>
                  <Td className="font-mono text-xs">
                    <Link href={`/assets/${c.asset.id}`} className="text-brand hover:underline">
                      {c.asset.tagId}
                    </Link>
                  </Td>
                  <Td>{c.asset.name}</Td>
                  <Td>{c.person?.name ?? "Location"}</Td>
                  <Td>{formatDate(c.checkedOutAt)}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      {c.dueAt ? (
                        <span className={overdue ? "font-medium text-red-600" : undefined}>
                          {formatDate(c.dueAt)}
                        </span>
                      ) : (
                        "—"
                      )}
                      {overdue ? <StatusBadge status="OVERDUE" /> : null}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <form action={checkInAsset}>
                      <input type="hidden" name="assetId" value={c.asset.id} />
                      <Button type="submit" size="sm" variant="secondary">
                        Check in
                      </Button>
                    </form>
                  </Td>
                </TrLink>
              );
            })
          )}
        </tbody>
      </Table>
    </>
  );
}
