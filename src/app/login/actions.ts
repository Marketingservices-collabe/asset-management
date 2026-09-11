"use server";

import { AuthError } from "next-auth";
import { signIn, TWO_FACTOR_CODE } from "@/lib/auth";

export type LoginState = { error?: string; needsTotp?: boolean };

export async function loginWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const totp = String(formData.get("totp") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") || "/dashboard");

  try {
    await signIn("credentials", { email, password, totp, redirectTo: callbackUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      if (code === TWO_FACTOR_CODE || err.message?.includes(TWO_FACTOR_CODE)) {
        return { needsTotp: true, error: totp ? "That code didn't match." : undefined };
      }
      return { error: "Invalid email or password." };
    }
    throw err; // redirect() throws here — must rethrow
  }
  return {};
}

export async function loginWithGoogle(formData: FormData) {
  const callbackUrl = String(formData.get("callbackUrl") || "/dashboard");
  await signIn("google", { redirectTo: callbackUrl });
}
