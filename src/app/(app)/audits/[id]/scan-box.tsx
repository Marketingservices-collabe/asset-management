"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { recordScan, type ScanState } from "../actions";

type Option = { value: string; label: string };

export function ScanBox({ auditId, locations }: { auditId: string; locations: Option[] }) {
  const [state, action, pending] = useActionState<ScanState, FormData>(recordScan, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.tag) {
      formRef.current?.reset();
      inputRef.current?.focus();
    }
  }, [state]);

  const Icon = state.tone === "ok" ? CheckCircle2 : state.tone === "warn" ? AlertTriangle : XCircle;
  const toneCls =
    state.tone === "ok"
      ? "text-emerald-600"
      : state.tone === "warn"
        ? "text-amber-600"
        : "text-red-600";

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Scan a tag</h2>
      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="auditId" value={auditId} />
        <input
          ref={inputRef}
          name="rawTag"
          autoFocus
          autoComplete="off"
          placeholder="Scan or type an asset tag, then Enter"
          className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-brand/30"
        />
        <div className="flex gap-2">
          <select
            name="foundLocationId"
            defaultValue=""
            className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
          >
            <option value="">Found where it&apos;s expected</option>
            {locations.map((l) => (
              <option key={l.value} value={l.value}>
                Found at: {l.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={pending}>
            Record
          </Button>
        </div>
      </form>
      {state.message ? (
        <p className={`mt-3 flex items-center gap-1.5 text-sm ${toneCls}`}>
          <Icon size={15} /> {state.message}
        </p>
      ) : null}
    </Card>
  );
}
