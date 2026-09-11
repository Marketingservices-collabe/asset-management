import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function NoAccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      <h1 className="text-lg font-semibold">No organization access</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Your account is signed in but not a member of any organization. Ask an admin to add you.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
        className="mt-4"
      >
        <Button variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
