"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, TWO_FACTOR_CODE } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/utils";

export type LoginState = { error?: string; needsTotp?: boolean };

export async function loginWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const totp = String(formData.get("totp") ?? "");
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

  try {
    // redirect: false — Auth.js's own redirect can produce a doubled target
    // ("/dashboard, /dashboard"); we redirect ourselves to a sanitised path below.
    await signIn("credentials", { email, password, totp, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      if (code === TWO_FACTOR_CODE || err.message?.includes(TWO_FACTOR_CODE)) {
        return { needsTotp: true, error: totp ? "That code didn't match." : undefined };
      }
      return { error: "Invalid email or password." };
    }
    throw err;
  }
  redirect(callbackUrl);
}

export async function loginWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeCallbackUrl(formData.get("callbackUrl")) });
}
