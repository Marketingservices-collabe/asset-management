"use client";

import { useActionState } from "react";
import type { FieldSpec } from "./types";
import type { FormState } from "@/lib/form";
import { EMPTY_FORM_STATE } from "@/lib/form";
import { TextField, TextareaField, SelectField, CheckboxField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function CrudForm({
  fields,
  action,
  initial,
  submitLabel = "Save",
  cancelHref,
}: {
  fields: FieldSpec[];
  action: Action;
  initial?: Record<string, unknown> | null;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);

  const val = (name: string) => {
    if (state.values && name in state.values) return state.values[name];
    const v = initial?.[name];
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  };
  const checked = (name: string) => {
    if (state.values && name in state.values) return state.values[name] === "on";
    return Boolean(initial?.[name]);
  };
  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.filter((f) => !f.displayOnly).map((f) => {
          if (f.type === "textarea") {
            return (
              <div key={f.name} className="sm:col-span-2">
                <TextareaField
                  label={f.label}
                  name={f.name}
                  required={f.required}
                  hint={f.hint}
                  placeholder={f.placeholder}
                  error={err(f.name)}
                  defaultValue={val(f.name)}
                />
              </div>
            );
          }
          if (f.type === "select") {
            return (
              <SelectField
                key={f.name}
                label={f.label}
                name={f.name}
                required={f.required}
                hint={f.hint}
                error={err(f.name)}
                options={f.options ?? []}
                placeholder={f.required ? undefined : "—"}
                defaultValue={val(f.name)}
              />
            );
          }
          if (f.type === "checkbox") {
            return (
              <div key={f.name} className="flex items-center sm:col-span-2">
                <CheckboxField label={f.label} name={f.name} hint={f.hint} defaultChecked={checked(f.name)} />
              </div>
            );
          }
          return (
            <TextField
              key={f.name}
              label={f.label}
              name={f.name}
              type={f.type === "url" ? "url" : f.type}
              required={f.required}
              hint={f.hint}
              placeholder={f.placeholder}
              error={err(f.name)}
              defaultValue={val(f.name)}
              step={f.type === "number" ? "any" : undefined}
            />
          );
        })}
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        {cancelHref ? (
          <Link href={cancelHref}>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        ) : null}
      </div>
    </form>
  );
}
