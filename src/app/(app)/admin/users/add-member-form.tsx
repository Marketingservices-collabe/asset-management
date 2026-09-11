"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE } from "@/lib/form";
import { Card } from "@/components/ui/card";
import { TextField, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { addMember } from "./actions";

type Option = { value: string; label: string };

export function AddMemberForm({ roles }: { roles: Option[] }) {
  const [state, action] = useActionState(addMember, EMPTY_FORM_STATE);
  return (
    <Card className="max-w-2xl">
      <h2 className="mb-3 text-sm font-semibold">Add a member</h2>
      <form action={action} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Email" name="email" type="email" required error={state.fieldErrors?.email} />
          <TextField label="Name (optional)" name="name" />
          <SelectField label="Role" name="roleId" required options={roles} placeholder="Select…" error={state.fieldErrors?.roleId} />
          <TextField
            label="Temp password (optional)"
            name="password"
            type="text"
            hint="Leave blank if they'll sign in with Google."
            error={state.fieldErrors?.password}
          />
        </div>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-emerald-600">Member added.</p> : null}
        <SubmitButton>Add member</SubmitButton>
      </form>
    </Card>
  );
}
