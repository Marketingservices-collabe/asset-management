"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE } from "@/lib/form";
import { TextField, TextareaField, SelectField, CheckboxField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { createSchedule, completeRecord, logAdHoc } from "./actions";

type Option = { value: string; label: string };

function Msg({ error, ok, okText }: { error?: string; ok?: boolean; okText: string }) {
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (ok) return <p className="text-sm text-emerald-600">{okText}</p>;
  return null;
}

export function ScheduleForm({ assets, people }: { assets: Option[]; people: Option[] }) {
  const [state, action] = useActionState(createSchedule, EMPTY_FORM_STATE);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-4">
      <SelectField label="Asset" name="assetId" required options={assets} placeholder="Select…" />
      <TextField label="Task" name="title" required placeholder="Oil change, calibration, filter swap…" error={state.fieldErrors?.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Repeat every (days)"
          name="intervalDays"
          type="number"
          min={1}
          required
          defaultValue="90"
          error={state.fieldErrors?.intervalDays}
        />
        <TextField label="First due" name="firstDueAt" type="date" required defaultValue={today} error={state.fieldErrors?.firstDueAt} />
        <TextField label="Warn ahead (days)" name="leadDays" type="number" min={0} defaultValue="7" />
        <SelectField label="Assign to" name="assignedToPersonId" options={people} placeholder="—" />
      </div>
      <CheckboxField label="Active" name="active" defaultChecked hint="Uncheck to pause without deleting." />
      <Msg error={state.error} ok={state.ok} okText="Schedule created." />
      <SubmitButton>Create schedule</SubmitButton>
    </form>
  );
}

export function LogForm({ assets }: { assets: Option[] }) {
  const [state, action] = useActionState(logAdHoc, EMPTY_FORM_STATE);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-4">
      <SelectField label="Asset" name="assetId" required options={assets} placeholder="Select…" />
      <TextareaField label="Work performed" name="workPerformed" required error={state.fieldErrors?.workPerformed} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Date" name="completedAt" type="date" defaultValue={today} />
        <TextField label="Technician" name="technician" />
        <TextField label="Cost" name="cost" type="number" step="any" />
      </div>
      <Msg error={state.error} ok={state.ok} okText="Logged." />
      <SubmitButton>Log maintenance</SubmitButton>
    </form>
  );
}

export function CompleteForm({ recordId, title }: { recordId: string; title: string }) {
  const [state, action] = useActionState(completeRecord, EMPTY_FORM_STATE);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="recordId" value={recordId} />
      <p className="text-sm text-[var(--muted)]">
        Completing: <span className="font-medium text-[var(--fg)]">{title}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Completed on" name="completedAt" type="date" defaultValue={today} />
        <TextField label="Technician" name="technician" />
        <TextField label="Cost" name="cost" type="number" step="any" />
      </div>
      <TextareaField label="Work performed" name="workPerformed" />
      <Msg error={state.error} ok={state.ok} okText="Marked complete." />
      <SubmitButton>Mark complete</SubmitButton>
    </form>
  );
}
