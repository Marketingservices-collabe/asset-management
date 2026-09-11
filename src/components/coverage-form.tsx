"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { X, Plus } from "lucide-react";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form";
import type { FieldSpec } from "@/components/crud/types";
import { TextField, TextareaField, SelectField, CheckboxField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";

type Option = { value: string; label: string };

export function CoverageForm({
  action,
  coreFields,
  assets,
  initial,
  linkedAssetIds = [],
  submitLabel = "Save",
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  coreFields: FieldSpec[];
  assets: Option[];
  initial?: Record<string, unknown> | null;
  linkedAssetIds?: string[];
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const [picked, setPicked] = useState<string[]>(linkedAssetIds);
  const [toAdd, setToAdd] = useState("");

  const labelOf = (id: string) => assets.find((a) => a.value === id)?.label ?? id;
  const available = assets.filter((a) => !picked.includes(a.value));

  const val = (name: string) => {
    if (state.values && name in state.values) return state.values[name];
    const v = initial?.[name];
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  };
  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}
      <input type="hidden" name="assetIds" value={JSON.stringify(picked)} />

      <div className="grid gap-4 sm:grid-cols-2">
        {coreFields.map((f) => {
          if (f.type === "textarea")
            return (
              <div key={f.name} className="sm:col-span-2">
                <TextareaField label={f.label} name={f.name} hint={f.hint} defaultValue={val(f.name)} error={err(f.name)} />
              </div>
            );
          if (f.type === "select")
            return (
              <SelectField
                key={f.name}
                label={f.label}
                name={f.name}
                required={f.required}
                hint={f.hint}
                options={f.options ?? []}
                placeholder={f.required ? undefined : "—"}
                defaultValue={val(f.name)}
                error={err(f.name)}
              />
            );
          if (f.type === "checkbox")
            return (
              <div key={f.name} className="flex items-center sm:col-span-2">
                <CheckboxField label={f.label} name={f.name} hint={f.hint} defaultChecked={Boolean(initial?.[f.name])} />
              </div>
            );
          return (
            <TextField
              key={f.name}
              label={f.label}
              name={f.name}
              type={f.type === "url" ? "url" : f.type}
              required={f.required}
              hint={f.hint}
              placeholder={f.placeholder}
              defaultValue={val(f.name)}
              error={err(f.name)}
              step={f.type === "number" ? "any" : undefined}
            />
          );
        })}
      </div>

      <div>
        <div className="mb-1 text-sm font-medium">Assets covered</div>
        {picked.length === 0 ? (
          <p className="mb-2 text-sm text-[var(--muted)]">None yet.</p>
        ) : (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {picked.map((id) => (
              <li
                key={id}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs"
              >
                {labelOf(id)}
                <button
                  type="button"
                  onClick={() => setPicked((p) => p.filter((x) => x !== id))}
                  className="text-[var(--muted)] hover:text-red-600"
                  aria-label="Remove"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <select
            value={toAdd}
            onChange={(e) => setToAdd(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="">Add an asset…</option>
            {available.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              if (toAdd) {
                setPicked((p) => [...p, toAdd]);
                setToAdd("");
              }
            }}
          >
            <Plus size={14} /> Add
          </Button>
        </div>
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
