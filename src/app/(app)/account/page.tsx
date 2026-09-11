import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Card, SectionTitle } from "@/components/ui/card";
import { PasswordForm } from "./password-form";
import { TwoFactor } from "./two-factor";

export default async function AccountPage() {
  const ctx = await requireContext();
  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { email: true, name: true, passwordHash: true, twoFactorSecret: true },
  });

  return (
    <>
      <PageHeader title="Your account" description={`${ctx.name ?? ctx.email} · ${ctx.roleName} in ${ctx.orgName}`} />

      <div className="max-w-2xl space-y-4">
        <Card>
          <SectionTitle>Profile</SectionTitle>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Name</dt>
              <dd>{user?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Role</dt>
              <dd>{ctx.roleName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Organization</dt>
              <dd>{ctx.orgName}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <SectionTitle>Password</SectionTitle>
          <PasswordForm hasPassword={!!user?.passwordHash} />
        </Card>

        <Card>
          <SectionTitle>Two-factor authentication</SectionTitle>
          <TwoFactor enabled={!!user?.twoFactorSecret} />
        </Card>
      </div>
    </>
  );
}
