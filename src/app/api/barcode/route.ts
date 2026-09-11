import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { renderBarcode, type BarcodeKind } from "@/lib/barcode";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const text = req.nextUrl.searchParams.get("text") ?? "";
  const kind = (req.nextUrl.searchParams.get("kind") ?? "qr") as BarcodeKind;
  if (!text) return new Response("Missing text", { status: 400 });

  try {
    const png = await renderBarcode(text, kind === "code128" ? "code128" : "qr");
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Render failed", { status: 500 });
  }
}
