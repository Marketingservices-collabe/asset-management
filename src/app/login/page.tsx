"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginWithPassword, loginWithGoogle, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [state, action, pending] = useActionState<LoginState, FormData>(loginWithPassword, {});

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 text-center">
        <div className="text-xl font-semibold">Asset Tracker</div>
        <div className="text-sm text-[var(--muted)]">ZenTrades internal</div>
      </div>
      <Card className="space-y-4">
        <form action={action} className="space-y-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.needsTotp ? (
            <div>
              <Label htmlFor="totp">Authentication code</Label>
              <Input
                id="totp"
                name="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="6-digit code"
                required
              />
            </div>
          ) : null}
          {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : state?.needsTotp ? "Verify" : "Sign in"}
          </Button>
        </form>

        {googleEnabled ? (
          <form action={loginWithGoogle}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button type="submit" variant="secondary" className="w-full">
              Continue with Google
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
