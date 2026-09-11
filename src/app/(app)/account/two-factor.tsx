"use client";

import { useActionState, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { beginTwoFactor, confirmTwoFactor, disableTwoFactor, type TwoFactorSetup } from "./actions";

export function TwoFactor({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [confirmState, confirmAction] = useActionState<TwoFactorSetup, FormData>(confirmTwoFactor, {});
  const [disableState, disableAction] = useActionState<FormState, FormData>(disableTwoFactor, EMPTY_FORM_STATE);

  if (enabled && !disableState.ok) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-emerald-600">
          <ShieldCheck size={16} /> Two-factor authentication is on.
        </p>
        <form action={disableAction} className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[var(--muted)]">Enter a current code to turn it off</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="h-9 w-32 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 font-mono text-sm"
            />
          </label>
          <SubmitButton variant="danger" size="sm">
            Disable
          </SubmitButton>
        </form>
        {disableState.error ? <p className="text-sm text-red-600">{disableState.error}</p> : null}
      </div>
    );
  }

  if (enabled && disableState.ok) {
    return <p className="text-sm text-[var(--muted)]">Two-factor authentication is off.</p>;
  }

  if (confirmState.ok) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-600">
        <ShieldCheck size={16} /> Two-factor authentication is now enabled.
      </p>
    );
  }

  const active = setup ?? (confirmState.secret ? confirmState : null);

  if (!active) {
    return (
      <form
        action={async () => {
          setSetup(await beginTwoFactor());
        }}
      >
        <Button size="sm">Set up two-factor authentication</Button>
        <p className="mt-2 text-xs text-[var(--muted)]">Uses any TOTP app (Google Authenticator, 1Password, Authy…).</p>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">Scan this in your authenticator app, then enter a code to confirm.</p>
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/barcode?kind=qr&text=${encodeURIComponent(active.url ?? "")}`}
          alt="2FA QR code"
          className="h-40 w-40 rounded-lg border border-[var(--border)] bg-white p-2"
        />
        <div className="text-xs">
          <div className="text-[var(--muted)]">Or enter this secret manually:</div>
          <code className="mt-1 block break-all rounded-md bg-[var(--surface-2)] p-2 font-mono">{active.secret}</code>
        </div>
      </div>
      <form action={confirmAction} className="flex items-end gap-2">
        <input type="hidden" name="secret" value={active.secret} />
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[var(--muted)]">6-digit code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="h-9 w-32 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 font-mono text-sm"
          />
        </label>
        <SubmitButton size="sm">Confirm & enable</SubmitButton>
      </form>
      {confirmState.error ? <p className="text-sm text-red-600">{confirmState.error}</p> : null}
    </div>
  );
}
