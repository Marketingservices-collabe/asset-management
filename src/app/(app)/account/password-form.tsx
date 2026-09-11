"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE } from "@/lib/form";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { changePassword } from "./actions";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState(changePassword, EMPTY_FORM_STATE);
  return (
    <form action={action} className="max-w-sm space-y-3">
      {hasPassword ? (
        <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />
      ) : (
        <p className="text-sm text-[var(--muted)]">You sign in with Google. Set a password to also allow email sign-in.</p>
      )}
      <TextField label="New password" name="next" type="password" autoComplete="new-password" required />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-600">Password updated.</p> : null}
      <SubmitButton>{hasPassword ? "Change password" : "Set password"}</SubmitButton>
    </form>
  );
}
