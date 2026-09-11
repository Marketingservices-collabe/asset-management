"use client";

import { useActionState } from "react";
import Link from "next/link";
import { EMPTY_FORM_STATE } from "@/lib/form";
import { TextField, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { createAudit } from "./actions";

type Option = { value: string; label: string };

export function AuditForm({
  sites,
  locations,
  categories,
}: {
  sites: Option[];
  locations: Option[];
  categories: Option[];
}) {
  const [state, action] = useActionState(createAudit, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-4">
      <TextField
        label="Audit name"
        name="name"
        required
        placeholder="Q3 warehouse count, IT room audit…"
        error={state.fieldErrors?.name}
      />
      <p className="text-sm text-[var(--muted)]">Scope (optional — leave blank to audit everything):</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Site" name="siteId" options={sites} placeholder="Any" />
        <SelectField label="Location" name="locationId" options={locations} placeholder="Any" />
        <SelectField label="Category" name="categoryId" options={categories} placeholder="Any" />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="flex gap-2">
        <SubmitButton>Start audit</SubmitButton>
        <Link href="/audits">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
