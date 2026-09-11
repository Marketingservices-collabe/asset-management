import crypto from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function randomSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/** Current 6-digit code. */
export function totp(secret: string, atMs = Date.now()): string {
  return hotp(secret, Math.floor(atMs / 30_000));
}

/** Accepts the current window and ±1 for clock drift. */
export function verifyTotp(secret: string, token: string, atMs = Date.now()): boolean {
  const t = token.replace(/\D/g, "");
  if (t.length !== 6) return false;
  const counter = Math.floor(atMs / 30_000);
  for (const c of [counter - 1, counter, counter + 1]) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, c)), Buffer.from(t))) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, account: string, issuer = "Asset Tracker"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
