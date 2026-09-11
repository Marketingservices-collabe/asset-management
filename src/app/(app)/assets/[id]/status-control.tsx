"use client";

import { useRef } from "react";
import { ASSET_STATUSES, STATUS_LABELS } from "@/lib/assets";
import { setAssetStatus } from "../actions";

export function StatusControl({ id, status }: { id: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setAssetStatus} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm outline-none focus:ring-2 focus:ring-brand"
      >
        {ASSET_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
