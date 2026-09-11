"use client";

import { useActionState } from "react";
import Link from "next/link";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form";
import { TextField, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";

type Option = { value: string; label: string };

export function ItemForm({
  action,
  categories,
  initial,
  submitLabel = "Save",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  categories: Option[];
  initial?: Record<string, unknown> | null;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const v = (n: string) => state.values?.[n] ?? (initial?.[n] == null ? "" : String(initial[n]));

  return (
    <form action={formAction} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="SKU" name="sku" required defaultValue={v("sku")} error={state.fieldErrors?.sku} />
        <TextField label="Name" name="name" required defaultValue={v("name")} error={state.fieldErrors?.name} />
        <TextField label="Unit" name="unit" placeholder="ea, box, m, L…" defaultValue={v("unit")} />
        <SelectField label="Category" name="categoryId" options={categories} placeholder="—" defaultValue={v("categoryId")} />
        <TextField
          label="Default reorder point"
          name="defaultReorderPoint"
          type="number"
          min={0}
          hint="Applied to new locations."
          defaultValue={v("defaultReorderPoint")}
        />
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/inventory">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
