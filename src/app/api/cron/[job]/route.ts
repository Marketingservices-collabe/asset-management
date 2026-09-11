import { NextRequest, NextResponse } from "next/server";
import { runAlertScan } from "@/lib/alerts";
import { runDepreciationClose } from "@/lib/depreciation-close";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Secret-protected cron entrypoints. Call with:
 *   Authorization: Bearer $CRON_SECRET
 * Jobs: alerts (daily), depreciation (monthly).
 * Vercel Cron triggers via GET and auto-attaches this header when a CRON_SECRET
 * env var is set on the project; POST is kept for manual curl/testing.
 */
async function handle(req: NextRequest, job: string) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  switch (job) {
    case "alerts": {
      const counts = await runAlertScan();
      return NextResponse.json({ ok: true, job, counts });
    }
    case "depreciation": {
      const res = await runDepreciationClose();
      return NextResponse.json({ ok: true, job, ...res });
    }
    default:
      return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  return handle(req, (await params).job);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  return handle(req, (await params).job);
}
