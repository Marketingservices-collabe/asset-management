"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ children = "Print" }: { children?: React.ReactNode }) {
  return (
    <Button size="sm" onClick={() => window.print()}>
      {children}
    </Button>
  );
}
