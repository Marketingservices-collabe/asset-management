"use client";

import { useActionState } from "react";
import Link from "next/link";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "@/lib/permission-groups";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";

export function RoleForm({
  action,
  initial,
  submitLabel,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  initial?: { id?: string; name: string; permissions: string[]; isSystem?: boolean } | null;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, EMPTY_FORM_STATE);
  const has = (p: string) => initial?.permissions.includes(p) ?? false;

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <TextField
        label="Role name"
        name="name"
        required
        defaultValue={initial?.name ?? ""}
        disabled={initial?.isSystem}
        hint={initial?.isSystem ? "System role — name is fixed, permissions are editable." : undefined}
        error={state.fieldErrors?.name}
      />

      <div className="space-y-4">
        {PERMISSION_GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{g.title}</div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {g.perms.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="permissions" value={p} defaultChecked={has(p)} />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/admin/roles">
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
