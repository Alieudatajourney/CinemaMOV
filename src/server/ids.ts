import "server-only";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

// Crockford-style alphabet without ambiguous characters (no 0/O, 1/I/L, U).
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomFrom(alphabet: string, length: number): string {
  // Rejection sampling for an unbiased distribution.
  const out: string[] = [];
  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < max && out.length < length) out.push(alphabet[b % alphabet.length]);
    }
  }
  return out.join("");
}

/** Human-friendly, unpredictable booking reference, e.g. MCP-7KQ2-X9HD (~39 bits). */
export function newBookingReference(): string {
  return `MCP-${randomFrom(REF_ALPHABET, 4)}-${randomFrom(REF_ALPHABET, 4)}`;
}

/** 192-bit opaque secret, URL-safe. Used for QR ticket tokens, access keys and hold keys. */
export function newSecret(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function newPaymentReference(): string {
  return `DEMO-PAY-${randomFrom(REF_ALPHABET, 8)}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
