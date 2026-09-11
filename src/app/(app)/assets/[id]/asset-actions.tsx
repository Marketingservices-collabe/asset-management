"use client";

import { useActionState, useState } from "react";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { SelectField, TextField, TextareaField } from "@/components/ui/field";
import { checkOutAsset, checkInAsset, moveAsset, disposeAsset } from "../actions";

type Option = { value: string; label: string };

export function AssetActions({
  assetId,
  status,
  people,
  sites,
  locations,
}: {
  assetId: string;
  status: string;
  people: Option[];
  sites: Option[];
  locations: (Option & { siteId: string })[];
}) {
  const canCheckOut = !["CHECKED_OUT", "LEASED", "DISPOSED", "LOST"].includes(status);
  const isOut = status === "CHECKED_OUT";
  const disposed = status === "DISPOSED" || status === "LOST";

  const tabs = [
    canCheckOut && ("checkout" as const),
    !disposed && ("move" as const),
    !disposed && ("dispose" as const),
  ].filter(Boolean) as ("checkout" | "move" | "dispose")[];

  const [tab, setTab] = useState<(typeof tabs)[number] | null>(tabs[0] ?? null);

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Actions</h2>

      {isOut ? (
        <form action={checkInAsset} className="mb-3">
          <input type="hidden" name="assetId" value={assetId} />
          <Button type="submit" size="sm" className="w-full">
            Check in
          </Button>
        </form>
      ) : null}

      {tabs.length > 0 ? (
        <div className="mb-3 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-2 py-1 text-xs capitalize ${
                tab === t ? "bg-brand text-brand-fg" : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "checkout" ? (
        <CheckoutForm assetId={assetId} people={people} locations={locations} />
      ) : null}
      {tab === "move" ? <MoveForm assetId={assetId} sites={sites} locations={locations} /> : null}
      {tab === "dispose" ? <DisposeForm assetId={assetId} /> : null}
    </Card>
  );
}

function Result({ state }: { state: FormState }) {
  if (state.error) return <p className="mt-2 text-xs text-red-600">{state.error}</p>;
  if (state.ok) return <p className="mt-2 text-xs text-emerald-600">Done.</p>;
  return null;
}

function CheckoutForm({
  assetId,
  people,
  locations,
}: {
  assetId: string;
  people: Option[];
  locations: Option[];
}) {
  const [state, action] = useActionState(checkOutAsset, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="assetId" value={assetId} />
      <SelectField label="To person" name="personId" options={people} placeholder="—" />
      <SelectField label="…or location" name="toLocationId" options={locations} placeholder="—" />
      <TextField label="Due date" name="dueAt" type="date" />
      <TextareaField label="Notes" name="notes" />
      <SubmitButton size="sm">Check out</SubmitButton>
      <Result state={state} />
    </form>
  );
}

function MoveForm({
  assetId,
  sites,
  locations,
}: {
  assetId: string;
  sites: Option[];
  locations: Option[];
}) {
  const [state, action] = useActionState(moveAsset, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={assetId} />
      <SelectField label="Destination site" name="toSiteId" options={sites} placeholder="—" />
      <SelectField label="Destination location" name="toLocationId" options={locations} placeholder="—" />
      <TextareaField label="Notes" name="notes" />
      <SubmitButton size="sm">Move</SubmitButton>
      <Result state={state} />
    </form>
  );
}

function DisposeForm({ assetId }: { assetId: string }) {
  const [state, action] = useActionState(disposeAsset, EMPTY_FORM_STATE);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={assetId} />
      <SelectField
        label="Method"
        name="method"
        required
        options={[
          { value: "SOLD", label: "Sold" },
          { value: "DONATED", label: "Donated" },
          { value: "SCRAPPED", label: "Scrapped" },
          { value: "LOST", label: "Lost / stolen" },
        ]}
      />
      <TextField label="Proceeds" name="proceeds" type="number" step="any" />
      <TextField label="Date" name="at" type="date" />
      <TextareaField label="Notes" name="notes" />
      <SubmitButton size="sm" variant="danger">
        Dispose asset
      </SubmitButton>
      <Result state={state} />
    </form>
  );
}
