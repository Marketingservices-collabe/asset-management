"use client";

import { useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseCsv } from "@/lib/csv";
import { IMPORT_FIELDS, autoMap, type ImportMapping } from "@/lib/import";
import { runImport, type ImportState } from "./actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, Th, Td } from "@/components/ui/table";

const TEMPLATE =
  "Asset Tag ID,Name,Serial Number,Category,Site,Location,Department,Assigned Person,Purchase Date,Purchase Cost,PO Number\n" +
  "AT-1001,Dell Latitude 7440,SN12345,Laptop,Headquarters,IT Room,Operations,Priya Shah,2025-03-14,1799.00,PO-5567";

export function ImportWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [csvText, setCsvText] = useState("");
  const [mapping, setMapping] = useState<ImportMapping>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<ImportState, FormData>(runImport, {});

  const parsed = useMemo(() => {
    try {
      return parseCsv(csvText);
    } catch {
      return { headers: [], rows: [] };
    }
  }, [csvText]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function goToMapping() {
    setMapping(autoMap(parsed.headers));
    setStep(2);
  }

  if (state.done && state.result) {
    const r = state.result;
    const refs = Object.entries(r.createdRefs).filter(([, n]) => n > 0);
    return (
      <Card className="max-w-2xl space-y-3">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 size={20} />
          <span className="font-medium">Imported {r.created} asset{r.created === 1 ? "" : "s"}.</span>
        </div>
        {refs.length > 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Also created: {refs.map(([k, n]) => `${n} ${k}`).join(", ")}.
          </p>
        ) : null}
        {r.errors.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle size={15} /> {r.errors.length} row{r.errors.length === 1 ? "" : "s"} skipped
            </div>
            <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-amber-800 dark:text-amber-300">
              {r.errors.slice(0, 50).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex gap-2">
          <a href="/assets">
            <Button size="sm">View assets</Button>
          </a>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setCsvText("");
              setMapping({});
              setStep(1);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            Import another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl space-y-4">
      {step === 1 ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium">Upload a CSV file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          <div className="text-center text-xs text-[var(--muted)]">or paste CSV text</div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={TEMPLATE}
            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCsvText(TEMPLATE)}
              className="text-sm text-brand hover:underline"
            >
              Use sample data
            </button>
            <Button size="sm" onClick={goToMapping} disabled={parsed.headers.length === 0}>
              <UploadCloud size={15} /> Next: map columns ({parsed.rows.length} rows)
            </Button>
          </div>
        </>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="csvText" value={csvText} />
          <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />

          <div>
            <h2 className="mb-2 text-sm font-semibold">Map columns</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {IMPORT_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {f.label}
                    {f.required ? <span className="text-red-500"> *</span> : null}
                  </span>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                    className="h-8 w-40 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
                  >
                    <option value="">— skip —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Preview (first 8 rows)</h2>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    {IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <Th key={f.key}>{f.label}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 8).map((row, i) => (
                    <tr key={i}>
                      {IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <Td key={f.key}>{row[mapping[f.key]!] || "—"}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>

          {!mapping.tagId || !mapping.name ? (
            <p className="text-sm text-amber-600">Map both Asset tag ID and Name to continue.</p>
          ) : null}
          {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" size="sm" disabled={pending || !mapping.tagId || !mapping.name}>
              {pending ? "Importing…" : `Import ${parsed.rows.length} assets`}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
