/** Minimal RFC-4180-ish CSV utilities (parse + stringify). */

export type CsvRow = Record<string, string>;

/** Parse CSV text into { headers, rows }. Handles quotes, embedded commas/newlines, CRLF. */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const clean = text.replace(/^﻿/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((f) => f.trim() !== "") || record.length > 1) records.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.some((f) => f.trim() !== "")) records.push(record);
  }

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((r) => {
    const obj: CsvRow = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

function esc(value: unknown): string {
  if (value == null) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString().slice(0, 10);
  else s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Turn a column list + row matrix into a CSV string. */
export function toCsv(columns: string[], rows: unknown[][]): string {
  const lines = [columns.map(esc).join(",")];
  for (const row of rows) lines.push(row.map(esc).join(","));
  return lines.join("\r\n");
}
