"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE } from "@/lib/form";
import { Card } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { createReservation } from "./actions";

type Option = { value: string; label: string };

export function ReservationForm({ assets, people }: { assets: Option[]; people: Option[] }) {
  const [state, action] = useActionState(createReservation, EMPTY_FORM_STATE);
  return (
    <Card className="max-w-xl">
      <h2 className="mb-3 text-sm font-semibold">Reserve an asset</h2>
      <form action={action} className="space-y-3">
        <SelectField label="Asset" name="assetId" required options={assets} placeholder="Select…" />
        <SelectField label="For" name="personId" required options={people} placeholder="Select…" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="From" name="fromAt" type="date" required error={state.fieldErrors?.fromAt} />
          <TextField label="To" name="toAt" type="date" required error={state.fieldErrors?.toAt} />
        </div>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-emerald-600">Reserved.</p> : null}
        <SubmitButton>Reserve</SubmitButton>
      </form>
    </Card>
  );
}
