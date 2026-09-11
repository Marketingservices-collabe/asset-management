import bwipjs from "bwip-js/node";

export type BarcodeKind = "qr" | "code128";

/** Render a barcode/QR to a PNG buffer. */
export async function renderBarcode(text: string, kind: BarcodeKind = "qr"): Promise<Buffer> {
  const value = text.trim() || "EMPTY";
  if (kind === "qr") {
    return bwipjs.toBuffer({
      bcid: "qrcode",
      text: value,
      scale: 4,
      padding: 2,
      backgroundcolor: "FFFFFF",
    });
  }
  return bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
  });
}
