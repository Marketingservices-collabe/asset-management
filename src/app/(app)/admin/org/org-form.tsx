"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE } from "@/lib/form";
import { TextField, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { updateOrg } from "./actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function OrgForm({ initial }: { initial: { name: string; currency: string; dateFormat: string; fiscalYearStartMonth: number } }) {
  const [state, action] = useActionState(updateOrg, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-4">
      <TextField label="Organization name" name="name" required defaultValue={initial.name} error={state.fieldErrors?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Currency (ISO code)" name="currency" required defaultValue={initial.currency} error={state.fieldErrors?.currency} maxLength={3} />
        <SelectField
          label="Date format"
          name="dateFormat"
          required
          defaultValue={initial.dateFormat}
          options={[
            { value: "MMM d, yyyy", label: "Aug 30, 2026" },
            { value: "d MMM yyyy", label: "30 Aug 2026" },
            { value: "yyyy-MM-dd", label: "2026-08-30" },
            { value: "MM/dd/yyyy", label: "08/30/2026" },
            { value: "dd/MM/yyyy", label: "30/08/2026" },
          ]}
        />
        <SelectField
          label="Fiscal year starts"
          name="fiscalYearStartMonth"
          required
          defaultValue={String(initial.fiscalYearStartMonth)}
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
        />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-600">Saved.</p> : null}
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
