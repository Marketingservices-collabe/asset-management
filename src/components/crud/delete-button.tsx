"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  id: string;
  action: (formData: FormData) => Promise<void>;
  label?: string;
  confirmText?: string;
};

export function DeleteButton({ id, action, label = "Delete", confirmText = "Delete this item?" }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" className="text-red-600">
        {label}
      </Button>
    </form>
  );
}
