import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/authz";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, Th, Td, EmptyRow } from "@/components/ui/table";
import { CrudForm } from "@/components/crud/crud-form";
import { DeleteButton } from "@/components/crud/delete-button";
import type { FieldSpec } from "@/components/crud/types";
import {
  createSite,
  updateSite,
  deleteSite,
  createLocation,
  updateLocation,
  deleteLocation,
} from "./actions";

const BASE = "/setup/locations";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; id?: string }>;
}) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const canManage = can(ctx.permissions, PERMISSIONS.SETUP_MANAGE);

  const [sites, locations] = await Promise.all([
    db.site.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      include: { _count: { select: { locations: true } } },
    }),
    db.location.findMany({
      where: { orgId: ctx.orgId },
      orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
      include: { site: { select: { name: true } }, parent: { select: { name: true } } },
    }),
  ]);

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: `${l.site.name} › ${l.name}` }));

  const siteFields: FieldSpec[] = [
    { name: "name", label: "Site name", type: "text", required: true },
    { name: "address", label: "Address", type: "textarea" },
    { name: "lat", label: "Latitude", type: "number" },
    { name: "lng", label: "Longitude", type: "number" },
  ];
  const locationFields: FieldSpec[] = [
    { name: "name", label: "Location name", type: "text", required: true, placeholder: "IT Room, Bay A, Shelf 3…" },
    { name: "siteId", label: "Site", type: "select", required: true, options: siteOptions },
    {
      name: "parentId",
      label: "Parent location (optional)",
      type: "select",
      options: locationOptions,
      hint: "Nest aisles under a room, bins under a shelf, etc.",
    },
  ];

  if (canManage && sp.form === "site") {
    const editing = sp.id ? sites.find((s) => s.id === sp.id) : null;
    return (
      <>
        <PageHeader title={editing ? "Edit site" : "New site"} back={{ label: "Sites & locations", href: BASE }} />
        <Card className="max-w-2xl">
          <CrudForm
            fields={siteFields}
            action={editing ? updateSite : createSite}
            initial={editing}
            submitLabel={editing ? "Save changes" : "Create site"}
            cancelHref={BASE}
          />
        </Card>
      </>
    );
  }

  if (canManage && sp.form === "location") {
    const editing = sp.id ? locations.find((l) => l.id === sp.id) : null;
    return (
      <>
        <PageHeader
          title={editing ? "Edit location" : "New location"}
          back={{ label: "Sites & locations", href: BASE }}
        />
        <Card className="max-w-2xl">
          <CrudForm
            fields={locationFields}
            action={editing ? updateLocation : createLocation}
            initial={editing}
            submitLabel={editing ? "Save changes" : "Create location"}
            cancelHref={BASE}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Sites & locations" description="Physical places assets live in." />

      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Sites</h2>
          {canManage ? (
            <Link href={`${BASE}?form=site`}>
              <Button size="sm">Add site</Button>
            </Link>
          ) : null}
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Address</Th>
              <Th className="w-24">Locations</Th>
              {canManage ? <Th className="w-32 text-right">Actions</Th> : null}
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 ? (
              <EmptyRow colSpan={canManage ? 4 : 3}>No sites yet.</EmptyRow>
            ) : (
              sites.map((s) => (
                <tr key={s.id}>
                  <Td>{s.name}</Td>
                  <Td>{s.address ?? "—"}</Td>
                  <Td>{s._count.locations}</Td>
                  {canManage ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`${BASE}?form=site&id=${s.id}`}
                          className="rounded-md px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          Edit
                        </Link>
                        <DeleteButton
                          id={s.id}
                          action={deleteSite}
                          confirmText="Delete this site? Locations under it must be removed first."
                        />
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Locations</h2>
          {canManage && sites.length > 0 ? (
            <Link href={`${BASE}?form=location`}>
              <Button size="sm">Add location</Button>
            </Link>
          ) : null}
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Site</Th>
              <Th>Parent</Th>
              {canManage ? <Th className="w-32 text-right">Actions</Th> : null}
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <EmptyRow colSpan={canManage ? 4 : 3}>
                {sites.length === 0 ? "Add a site first." : "No locations yet."}
              </EmptyRow>
            ) : (
              locations.map((l) => (
                <tr key={l.id}>
                  <Td>{l.name}</Td>
                  <Td>{l.site.name}</Td>
                  <Td>{l.parent?.name ?? "—"}</Td>
                  {canManage ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`${BASE}?form=location&id=${l.id}`}
                          className="rounded-md px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          Edit
                        </Link>
                        <DeleteButton id={l.id} action={deleteLocation} confirmText="Delete this location?" />
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </>
  );
}
