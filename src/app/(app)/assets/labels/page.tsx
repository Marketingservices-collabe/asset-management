import Link from "next/link";
import { requireContext } from "@/lib/session";
import { db } from "@/lib/db";
import { PrintButton } from "@/components/print-button";

type SP = { ids?: string | string[]; kind?: string };

export default async function LabelsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const kind = sp.kind === "code128" ? "code128" : "qr";

  const idList = (Array.isArray(sp.ids) ? sp.ids : (sp.ids ?? "").split(","))
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);

  const assets = idList.length
    ? await db.asset.findMany({
        where: { id: { in: idList }, orgId: ctx.orgId },
        select: { id: true, tagId: true, name: true },
        orderBy: { tagId: "asc" },
      })
    : [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <Link href="/assets" className="text-sm text-[var(--muted)] hover:underline">
            ← Assets
          </Link>
          <h1 className="text-lg font-semibold">
            Labels · {assets.length} tag{assets.length === 1 ? "" : "s"}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Avery 5160 (2.625&quot; × 1&quot;, 30 per sheet). Set printer margins to “None”, scale 100%.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/assets/labels?kind=${kind === "qr" ? "code128" : "qr"}&ids=${idList.join(",")}`}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            {kind === "qr" ? "Switch to barcode" : "Switch to QR"}
          </Link>
          <PrintButton>Print</PrintButton>
        </div>
      </div>

      {assets.length === 0 ? (
        <p className="text-sm text-[var(--muted)] print:hidden">
          No assets selected. Pick assets on the list and choose “Print selected labels”.
        </p>
      ) : (
        <div className="label-sheet">
          {assets.map((a) => (
            <div key={a.id} className="label">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/barcode?kind=${kind}&text=${encodeURIComponent(a.tagId)}`} alt={a.tagId} className="label-code" />
              <div className="label-text">
                <div className="label-tag">{a.tagId}</div>
                <div className="label-name">{a.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .label-sheet {
          display: grid;
          grid-template-columns: repeat(3, 2.625in);
          grid-auto-rows: 1in;
          column-gap: 0.125in;
          row-gap: 0;
          background: #fff;
          color: #000;
          width: 8.5in;
          padding: 0.5in 0.1875in;
        }
        .label {
          display: flex;
          align-items: center;
          gap: 0.08in;
          overflow: hidden;
          padding: 0.06in;
        }
        .label-code { width: 0.8in; height: 0.8in; object-fit: contain; }
        .label-text { min-width: 0; }
        .label-tag { font-family: ui-monospace, monospace; font-size: 10pt; font-weight: 700; }
        .label-name { font-size: 8pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media print {
          @page { size: letter; margin: 0; }
          body { background: #fff; }
          .label-sheet { padding: 0.5in 0.1875in; }
        }
      `}</style>
    </div>
  );
}
