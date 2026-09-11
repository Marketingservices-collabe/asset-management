"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children = "Save",
  pendingText = "Saving…",
  variant,
  size,
}: {
  children?: React.ReactNode;
  pendingText?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size}>
      {pending ? pendingText : children}
    </Button>
  );
}
