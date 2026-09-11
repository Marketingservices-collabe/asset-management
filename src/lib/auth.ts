import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";

/** Thrown from authorize() when the account has 2FA but no code was supplied. */
export class TwoFactorRequiredError extends CredentialsSignin {
  code = "2fa_required";
}
export const TWO_FACTOR_CODE = "2fa_required";

const googleEnabled = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, totp: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        const totp = String(creds?.totp ?? "").trim();
        if (!email || !password) return null;
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        if (user.twoFactorSecret) {
          if (!totp) throw new TwoFactorRequiredError();
          if (!verifyTotp(user.twoFactorSecret, totp)) return null;
        }
        return { id: user.id, email: user.email, name: user.name ?? undefined, image: user.image ?? undefined };
      },
    }),
    ...(googleEnabled ? [Google({ allowDangerousEmailAccountLinking: true })] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For Google sign-in, provision a User row on first login (internal tool: no domain gate).
      if (account?.provider === "google" && user.email) {
        await db.user.upsert({
          where: { email: user.email.toLowerCase() },
          update: { name: user.name ?? undefined, image: user.image ?? undefined },
          create: { email: user.email.toLowerCase(), name: user.name ?? undefined, image: user.image ?? undefined },
        });
      }
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const u = await db.user.findUnique({ where: { email: token.email.toLowerCase() } });
        if (u) token.uid = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
