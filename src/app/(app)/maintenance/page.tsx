import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ClipboardList } from "lucide-react";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { formatDate, formatMoney } from "@/lib/utils";
import { effectiveStatus } from "@/lib/maintenance";
import { PageHeader } from "@/components/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, Th, Td, TrLink, EmptyRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ScheduleForm, LogForm, CompleteForm } from "./forms";
import { skipRecord, toggleSchedule, deleteSchedule } from "./actions";
import { DeleteButton } from "@/components/crud/delete-button";

const BASE = "/maintenance";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; complete?: string }>;
}) {
  const ctx = await requireContext();
  if (!can(ctx.permissions, PERMISSIONS.MAINTENANCE_VIEW)) redirect("/assets");
  const canManage = can(ctx.permissions, PERMISSIONS.MAINTENANCE_MANAGE);
  const sp = await searchParams;

  const [openRecs, schedules, doneRecs, assets, people, completing] = await Promise.all([
    db.maintenanceRecord.findMany({
      where: { orgId: ctx.orgId, status: { in: ["SCHEDULED", "OVERDUE"] } },
      orderBy: { dueAt: "asc" },
      include: { asset: { select: { id: true, tagId: true, name: true } }, schedule: { select: { title: true, assignedTo: { select: { name: true } } } } },
    }),
    db.maintenanceSchedule.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ active: "desc" }, { nextDueAt: "asc" }],
      include: { asset: { select: { id: true, tagId: true, name: true } }, assignedTo: { select: { name: true } } },
    }),
    db.maintenanceRecord.findMany({
      where: { orgId: ctx.orgId, status: { in: ["DONE", "SKIPPED"] } },
      orderBy: { completedAt: "desc" },
      take: 15,
      include: { asset: { select: { id: true, tagId: true, name: true } }, schedule: { select: { title: true } } },
    }),
    db.asset.findMany({
      where: { orgId: ctx.orgId, status: { notIn: ["DISPOSED", "LOST"] } },
      orderBy: { tagId: "asc" },
      select: { id: true, tagId: true, name: true },
    }),
    db.person.findMany({ where: { orgId: ctx.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    sp.complete
      ? db.maintenanceRecord.findFirst({
          where: { id: sp.complete, orgId: ctx.orgId },
          include: { asset: { select: { name: true } }, schedule: { select: { title: true } } },
        })
      : null,
  ]);

  const assetOpts = assets.map((a) => ({ value: a.id, label: `${a.tagId} — ${a.name}` }));
  const peopleOpts = people.map((p) => ({ value: p.id, label: p.name }));

  if (canManage && sp.form === "schedule") {
    return (
      <>
        <PageHeader title="New maintenance schedule" back={{ label: "Maintenance", href: BASE }} />
        <Card className="max-w-2xl">
          <ScheduleForm assets={assetOpts} people={peopleOpts} />
        </Card>
      </>
    );
  }
  if (canManage && sp.form === "log") {
    return (
      <>
        <PageHeader title="Log maintenance" back={{ label: "Maintenance", href: BASE }} />
        <Card className="max-w-2xl">
          <LogForm assets={assetOpts} />
        </Card>
      </>
    );
  }
  if (canManage && completing) {
    return (
      <>
        <PageHeader title="Complete maintenance" back={{ label: "Maintenance", href: BASE }} />
        <Card className="max-w-2xl">
          <CompleteForm
            recordId={completing.id}
            title={`${completing.schedule?.title ?? "Maintenance"} · ${completing.asset.name}`}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Maintenance" description="Preventive schedules and service history." />

      {canManage ? (
        <div className="mb-6 flex gap-2">
          <Link href={`${BASE}?form=schedule`}>
            <Button size="sm">
              <Plus size={15} /> New schedule
            </Button>
          </Link>
          <Link href={`${BASE}?form=log`}>
            <Button size="sm" variant="secondary">
              <ClipboardList size={15} /> Log past work
            </Button>
          </Link>
        </div>
      ) : null}

      <section className="mb-8">
        <SectionTitle>Open ({openRecs.length})</SectionTitle>
        <Table>
          <thead>
            <tr>
              <Th>Asset</Th>
              <Th>Task</Th>
              <Th>Due</Th>
              <Th>Assignee</Th>
              {canManage ? <Th className="text-right">Actions</Th> : null}
            </tr>
          </thead>
          <tbody>
            {openRecs.length === 0 ? (
              <EmptyRow colSpan={canManage ? 5 : 4}>Nothing due. Nice.</EmptyRow>
            ) : (
              openRecs.map((r) => {
                const eff = effectiveStatus(r.status, r.dueAt);
                return (
                  <TrLink key={r.id}>
                    <Td>
                      <Link href={`/assets/${r.asset.id}`} className="hover:underline">
                        {r.asset.name}
                      </Link>
                      <span className="ml-1.5 font-mono text-xs text-[var(--muted)]">{r.asset.tagId}</span>
                    </Td>
                    <Td>{r.schedule?.title ?? "Ad-hoc"}</Td>
                    <Td>
                      <span className={eff === "OVERDUE" ? "font-medium text-red-600" : undefined}>
                        {formatDate(r.dueAt)}
                      </span>{" "}
                      <StatusBadge status={eff} />
                    </Td>
                    <Td>{r.schedule?.assignedTo?.name ?? "—"}</Td>
                    {canManage ? (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`${BASE}?complete=${r.id}`}
                            className="rounded-md px-2 py-1 text-[13px] font-medium text-brand hover:bg-[var(--surface-2)]"
                          >
                            Complete
                          </Link>
                          <form action={skipRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button type="submit" size="sm" variant="ghost" className="text-[var(--muted)]">
                              Skip
                            </Button>
                          </form>
                        </div>
                      </Td>
                    ) : null}
                  </TrLink>
                );
              })
            )}
          </tbody>
        </Table>
      </section>

      <section className="mb-8">
        <SectionTitle>Schedules ({schedules.length})</SectionTitle>
        <Table>
          <thead>
            <tr>
              <Th>Asset</Th>
              <Th>Task</Th>
              <Th>Every</Th>
              <Th>Next due</Th>
              <Th>Assignee</Th>
              <Th>State</Th>
              {canManage ? <Th className="text-right">Actions</Th> : null}
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <EmptyRow colSpan={canManage ? 7 : 6}>No schedules yet.</EmptyRow>
            ) : (
              schedules.map((s) => (
                <TrLink key={s.id}>
                  <Td>
                    {s.asset ? (
                      <>
                        <Link href={`/assets/${s.asset.id}`} className="hover:underline">
                          {s.asset.name}
                        </Link>
                        <span className="ml-1.5 font-mono text-xs text-[var(--muted)]">{s.asset.tagId}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>{s.title}</Td>
                  <Td>{s.intervalDays ? `${s.intervalDays} days` : "—"}</Td>
                  <Td>{formatDate(s.nextDueAt)}</Td>
                  <Td>{s.assignedTo?.name ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={s.active ? "ACTIVE" : "SKIPPED"} />
                  </Td>
                  {canManage ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <form action={toggleSchedule}>
                          <input type="hidden" name="id" value={s.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            {s.active ? "Pause" : "Resume"}
                          </Button>
                        </form>
                        <DeleteButton id={s.id} action={deleteSchedule} confirmText="Delete this schedule? Completed history is kept." />
                      </div>
                    </Td>
                  ) : null}
                </TrLink>
              ))
            )}
          </tbody>
        </Table>
      </section>

      <section>
        <SectionTitle>Recently completed</SectionTitle>
        <Table>
          <thead>
            <tr>
              <Th>Asset</Th>
              <Th>Task / work</Th>
              <Th>Completed</Th>
              <Th>Technician</Th>
              <Th className="text-right">Cost</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {doneRecs.length === 0 ? (
              <EmptyRow colSpan={6}>No history yet.</EmptyRow>
            ) : (
              doneRecs.map((r) => (
                <TrLink key={r.id}>
                  <Td>
                    <Link href={`/assets/${r.asset.id}`} className="hover:underline">
                      {r.asset.name}
                    </Link>
                    <span className="ml-1.5 font-mono text-xs text-[var(--muted)]">{r.asset.tagId}</span>
                  </Td>
                  <Td>{r.schedule?.title ?? r.workPerformed ?? "Maintenance"}</Td>
                  <Td>{formatDate(r.completedAt)}</Td>
                  <Td>{r.technician ?? "—"}</Td>
                  <Td className="text-right">{formatMoney(r.cost ? Number(r.cost) : null)}</Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                </TrLink>
              ))
            )}
          </tbody>
        </Table>
      </section>
    </>
  );
}
