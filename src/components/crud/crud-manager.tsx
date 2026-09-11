import Link from "next/link";
import type { FieldSpec, CrudRow } from "./types";
import type { FormState } from "@/lib/form";
import { CrudForm } from "./crud-form";
import { DeleteButton } from "./delete-button";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, Th, Td, EmptyRow } from "@/components/ui/table";

type Props = {
  title: string;
  description?: string;
  singular: string;
  basePath: string;
  fields: FieldSpec[];
  rows: CrudRow[];
  canManage: boolean;
  searchParams: { new?: string; edit?: string };
  createAction: (state: FormState, formData: FormData) => Promise<FormState>;
  updateAction: (state: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function CrudManager({
  title,
  description,
  singular,
  basePath,
  fields,
  rows,
  canManage,
  searchParams,
  createAction,
  updateAction,
  deleteAction,
}: Props) {
  const columns = fields.filter((f) => f.column);
  const editing = searchParams.edit ? rows.find((r) => r.id === searchParams.edit) : undefined;
  const showCreate = searchParams.new !== undefined && canManage;
  const showEdit = editing !== undefined && canManage;

  // `render` is a function — strip it before handing fields to the client form.
  const formFields = fields
    .filter((f) => !f.displayOnly)
    .map(({ render: _render, ...rest }) => rest);

  if (showCreate) {
    return (
      <>
        <PageHeader title={`New ${singular}`} back={{ label: title, href: basePath }} />
        <Card className="max-w-2xl">
          <CrudForm fields={formFields} action={createAction} submitLabel={`Create ${singular}`} cancelHref={basePath} />
        </Card>
      </>
    );
  }

  if (showEdit) {
    return (
      <>
        <PageHeader title={`Edit ${singular}`} back={{ label: title, href: basePath }} />
        <Card className="max-w-2xl">
          <CrudForm
            fields={formFields}
            action={updateAction}
            initial={editing}
            submitLabel="Save changes"
            cancelHref={basePath}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={canManage ? { label: `Add ${singular}`, href: `${basePath}?new` } : undefined}
      />
      <Table>
        <thead>
          <tr>
            {columns.map((c) => (
              <Th key={c.name}>{c.label}</Th>
            ))}
            {canManage ? <Th className="w-32 text-right">Actions</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={columns.length + (canManage ? 1 : 0)}>No {title.toLowerCase()} yet.</EmptyRow>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <Td key={c.name}>{c.render ? c.render(row) : renderValue(row[c.name])}</Td>
                ))}
                {canManage ? (
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`${basePath}?edit=${row.id}`}
                        className="rounded-md px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        Edit
                      </Link>
                      <DeleteButton
                        id={row.id}
                        action={deleteAction}
                        confirmText={`Delete this ${singular}? This cannot be undone.`}
                      />
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}

function renderValue(v: unknown): React.ReactNode {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v instanceof Date) return v.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return String(v);
}
