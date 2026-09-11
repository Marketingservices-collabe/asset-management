"use client";

import { useActionState, useState } from "react";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form";
import { Card } from "@/components/ui/card";
import { SelectField, TextField, TextareaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { receiveStock, issueStock, adjustStock, transferStock } from "../actions";

type Option = { value: string; label: string };
type Tab = "receive" | "issue" | "adjust" | "transfer";

export function StockActions({
  itemId,
  unit,
  locations,
}: {
  itemId: string;
  unit: string;
  locations: Option[];
}) {
  const [tab, setTab] = useState<Tab>("receive");
  return (
    <Card>
      <div className="mb-3 flex flex-wrap gap-1">
        {(["receive", "issue", "adjust", "transfer"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
              tab === t ? "bg-brand text-brand-fg" : "hover:bg-[var(--surface-2)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "receive" ? <MoveForm action={receiveStock} itemId={itemId} unit={unit} locations={locations} verb="Receive" /> : null}
      {tab === "issue" ? <MoveForm action={issueStock} itemId={itemId} unit={unit} locations={locations} verb="Issue" /> : null}
      {tab === "adjust" ? <AdjustForm itemId={itemId} locations={locations} /> : null}
      {tab === "transfer" ? <TransferForm itemId={itemId} unit={unit} locations={locations} /> : null}
    </Card>
  );
}

function Msg({ state }: { state: FormState }) {
  if (state.error) return <p className="mt-2 text-xs text-red-600">{state.error}</p>;
  if (state.ok) return <p className="mt-2 text-xs text-emerald-600">Done.</p>;
  return null;
}

function MoveForm({
  action,
  itemId,
  unit,
  locations,
  verb,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  itemId: string;
  unit: string;
  locations: Option[];
  verb: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <SelectField label="Location" name="locationId" required options={locations} placeholder="Select…" />
      <TextField label={`Quantity (${unit})`} name="quantity" type="number" min={1} required error={state.fieldErrors?.quantity} />
      <TextareaField label="Reason / note" name="reason" />
      <SubmitButton size="sm">{verb}</SubmitButton>
      <Msg state={state} />
    </form>
  );
}

function AdjustForm({ itemId, locations }: { itemId: string; locations: Option[] }) {
  const [state, formAction] = useActionState(adjustStock, EMPTY_FORM_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <SelectField label="Location" name="locationId" required options={locations} placeholder="Select…" />
      <TextField label="Set count to" name="newCount" type="number" min={0} required error={state.fieldErrors?.newCount} />
      <TextareaField label="Reason" name="reason" />
      <SubmitButton size="sm">Adjust</SubmitButton>
      <Msg state={state} />
    </form>
  );
}

function TransferForm({ itemId, unit, locations }: { itemId: string; unit: string; locations: Option[] }) {
  const [state, formAction] = useActionState(transferStock, EMPTY_FORM_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <SelectField label="From" name="fromLocationId" required options={locations} placeholder="Select…" />
      <SelectField label="To" name="toLocationId" required options={locations} placeholder="Select…" error={state.fieldErrors?.toLocationId} />
      <TextField label={`Quantity (${unit})`} name="quantity" type="number" min={1} required error={state.fieldErrors?.quantity} />
      <TextareaField label="Reason / note" name="reason" />
      <SubmitButton size="sm">Transfer</SubmitButton>
      <Msg state={state} />
    </form>
  );
}
