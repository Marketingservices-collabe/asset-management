"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE } from "@/lib/form";
import { Card } from "@/components/ui/card";
import { SelectField, TextField, TextareaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { checkOutAsset } from "../assets/actions";

type Option = { value: string; label: string };

export function CheckoutForm({
  assets,
  people,
  locations,
}: {
  assets: Option[];
  people: Option[];
  locations: Option[];
}) {
  const [state, action] = useActionState(checkOutAsset, EMPTY_FORM_STATE);

  return (
    <Card className="max-w-xl">
      <h2 className="mb-3 text-sm font-semibold">Check out an asset</h2>
      {assets.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Every asset is already checked out, leased or disposed.</p>
      ) : (
        <form action={action} className="space-y-3">
          <SelectField label="Asset" name="assetId" required options={assets} placeholder="Select…" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="To person" name="personId" options={people} placeholder="—" />
            <SelectField label="…or location" name="toLocationId" options={locations} placeholder="—" />
          </div>
          <TextField label="Due date" name="dueAt" type="date" hint="Optional — overdue items trigger alerts." />
          <TextareaField label="Notes" name="notes" />
          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          {state.ok ? <p className="text-sm text-emerald-600">Checked out.</p> : null}
          <SubmitButton>Check out</SubmitButton>
        </form>
      )}
    </Card>
  );
}
