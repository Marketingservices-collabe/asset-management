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
import { ReservationForm } from "./reservation-form";
import { cancelReservation } from "./actions";

export default async function ReservationsPage() {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.RESERVATION_MANAGE)) redirect("/assets");

  const [assets, people, reservations] = await Promise.all([
    db.asset.findMany({
      where: { orgId: ctx.orgId, status: { notIn: ["DISPOSED", "LOST"] } },
      orderBy: { tagId: "asc" },
      select: { id: true, tagId: true, name: true },
    }),
    db.person.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.reservation.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ status: "asc" }, { fromAt: "asc" }],
      include: {
        asset: { select: { id: true, tagId: true, name: true } },
        person: { select: { name: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader title="Reservations" description="Hold assets for a person over a date range." />

      <div className="mb-8">
        <ReservationForm
          assets={assets.map((a) => ({ value: a.id, label: `${a.tagId} — ${a.name}` }))}
          people={people.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      <SectionTitle>All reservations ({reservations.length})</SectionTitle>
      <Table>
        <thead>
          <tr>
            <Th>Tag</Th>
            <Th>Asset</Th>
            <Th>For</Th>
            <Th>From</Th>
            <Th>To</Th>
            <Th>Status</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {reservations.length === 0 ? (
            <EmptyRow colSpan={7}>No reservations.</EmptyRow>
          ) : (
            reservations.map((r) => (
              <TrLink key={r.id}>
                <Td className="font-mono text-xs">
                  <Link href={`/assets/${r.asset.id}`} className="text-brand hover:underline">
                    {r.asset.tagId}
                  </Link>
                </Td>
                <Td>{r.asset.name}</Td>
                <Td>{r.person.name}</Td>
                <Td>{formatDate(r.fromAt)}</Td>
                <Td>{formatDate(r.toAt)}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
                <Td className="text-right">
                  {r.status === "PENDING" || r.status === "ACTIVE" ? (
                    <form action={cancelReservation}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button type="submit" size="sm" variant="ghost" className="text-red-600">
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    "—"
                  )}
                </Td>
              </TrLink>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
