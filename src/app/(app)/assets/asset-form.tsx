"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form";
import { DEP_METHODS } from "@/lib/assets";
import { TextField, TextareaField, SelectField, CheckboxField, Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Option = { value: string; label: string };
type FieldDef = {
  id: string;
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "DATE" | "BOOL" | "SELECT";
  required: boolean;
  options: string[];
  categoryId: string | null;
};

export type AssetFormOptions = {
  categories: Option[];
  sites: Option[];
  locations: (Option & { siteId: string })[];
  departments: Option[];
  people: Option[];
  companies: Option[];
  funds: Option[];
  fieldDefs: FieldDef[];
};

const DEP_LABELS: Record<string, string> = {
  STRAIGHT_LINE: "Straight line",
  DECLINING_BALANCE_200: "Declining balance (200%)",
  DECLINING_BALANCE_150: "Declining balance (150%)",
  SUM_OF_YEARS_DIGITS: "Sum of years' digits",
  NONE: "No depreciation",
};

export function AssetForm({
  action,
  options,
  initial,
  customValues,
  submitLabel = "Save asset",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  options: AssetFormOptions;
  initial?: Record<string, unknown> | null;
  customValues?: Record<string, string>;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const [categoryId, setCategoryId] = useState(str(initial?.categoryId));
  const [siteId, setSiteId] = useState(str(initial?.siteId));

  const v = (name: string) => {
    if (state.values && name in state.values) return state.values[name];
    return str(initial?.[name]);
  };
  const err = (name: string) => state.fieldErrors?.[name];
  const cfVal = (id: string) => state.values?.[`cf_${id}`] ?? customValues?.[id] ?? "";

  const visibleLocations = siteId ? options.locations.filter((l) => l.siteId === siteId) : options.locations;
  const visibleDefs = options.fieldDefs.filter((d) => d.categoryId === null || d.categoryId === categoryId);

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}

      <Section title="Identity">
        <TextField
          label="Asset tag ID"
          name="tagId"
          required
          defaultValue={v("tagId")}
          error={err("tagId")}
          hint="Printed on the barcode/QR label. Must be unique."
        />
        <TextField label="Name" name="name" required defaultValue={v("name")} error={err("name")} />
        <TextField label="Serial number" name="serialNo" defaultValue={v("serialNo")} error={err("serialNo")} />
        <TextField
          label="Photo URL"
          name="photoUrl"
          type="url"
          defaultValue={v("photoUrl")}
          error={err("photoUrl")}
          hint="Link to an image (Google Drive, etc.)."
        />
        <div className="sm:col-span-2">
          <TextareaField label="Description" name="description" defaultValue={v("description")} error={err("description")} />
        </div>
      </Section>

      <Section title="Classification">
        <SelectField
          label="Category"
          name="categoryId"
          options={options.categories}
          placeholder="—"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />
        <SelectField
          label="Site"
          name="siteId"
          options={options.sites}
          placeholder="—"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        />
        <SelectField
          label="Location"
          name="locationId"
          options={visibleLocations}
          placeholder="—"
          defaultValue={v("locationId")}
        />
        <SelectField label="Department" name="departmentId" options={options.departments} placeholder="—" defaultValue={v("departmentId")} />
        <SelectField
          label="Assigned to"
          name="assignedPersonId"
          options={options.people}
          placeholder="—"
          defaultValue={v("assignedPersonId")}
        />
      </Section>

      <Section title="Purchase & funding">
        <TextField label="Purchase date" name="purchaseDate" type="date" defaultValue={v("purchaseDate")} error={err("purchaseDate")} />
        <TextField label="Purchase cost" name="purchaseCost" type="number" step="any" defaultValue={v("purchaseCost")} error={err("purchaseCost")} />
        <TextField label="PO number" name="poNumber" defaultValue={v("poNumber")} error={err("poNumber")} />
        <SelectField label="Supplier" name="supplierId" options={options.companies} placeholder="—" defaultValue={v("supplierId")} />
        <SelectField label="Fund / grant" name="fundId" options={options.funds} placeholder="—" defaultValue={v("fundId")} />
      </Section>

      <Section title="Depreciation">
        <SelectField
          label="Method"
          name="depreciationMethod"
          required
          options={DEP_METHODS.map((m) => ({ value: m, label: DEP_LABELS[m] }))}
          defaultValue={v("depreciationMethod") || "NONE"}
        />
        <TextField label="Salvage value" name="salvageValue" type="number" step="any" defaultValue={v("salvageValue")} error={err("salvageValue")} />
        <TextField label="Useful life (months)" name="usefulLifeMonths" type="number" defaultValue={v("usefulLifeMonths")} error={err("usefulLifeMonths")} />
        <TextField label="Depreciation start" name="depreciationStart" type="date" defaultValue={v("depreciationStart")} error={err("depreciationStart")} hint="Defaults to purchase date." />
      </Section>

      {visibleDefs.length > 0 ? (
        <Section title="Custom fields">
          {visibleDefs.map((d) => (
            <CustomFieldInput key={d.id} def={d} value={cfVal(d.id)} />
          ))}
        </Section>
      ) : null}

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div className="flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={initial?.id ? `/assets/${initial.id}` : "/assets"}>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function CustomFieldInput({ def, value }: { def: FieldDef; value: string }) {
  const name = `cf_${def.id}`;
  if (def.type === "BOOL") {
    return (
      <div className="sm:col-span-2">
        <CheckboxField label={def.label} name={name} defaultChecked={value === "on" || value === "true"} />
      </div>
    );
  }
  if (def.type === "SELECT") {
    return (
      <SelectField
        label={def.label}
        name={name}
        required={def.required}
        options={def.options.map((o) => ({ value: o, label: o }))}
        placeholder={def.required ? undefined : "—"}
        defaultValue={value}
      />
    );
  }
  const inputType = def.type === "NUMBER" ? "number" : def.type === "DATE" ? "date" : "text";
  return (
    <Field label={def.label} name={name} required={def.required}>
      <input
        id={name}
        name={name}
        type={inputType}
        step={inputType === "number" ? "any" : undefined}
        required={def.required}
        defaultValue={value}
        className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:ring-2 focus:ring-brand"
      />
    </Field>
  );
}

function str(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
