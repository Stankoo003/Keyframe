/**
 * Admin session cookie — potpisivanje i provera.
 *
 * Koristi Web Crypto (`crypto.subtle`), NE Node-ov `node:crypto` — ova funkcija
 * mora da radi i u Edge runtime-u (`src/proxy.ts`, middleware) i u Node runtime-u
 * (Server Actions). `node:crypto` ne postoji u Edge-u; Web Crypto postoji u oba.
 *
 * Format cookie vrednosti: `<base64url payload>.<base64url HMAC-SHA256 potpis>`.
 * Payload je JSON `{ exp: epochMs }` — fiksna duzina sesije (vidi `SESSION_TTL_MS`),
 * bez rolling refresh-a. Najjednostavnije sto zadovoljava "single admin account".
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  // `new ArrayBuffer(...)`, ne `Uint8Array.from(...)` — potonji nasledjuje
  // generickiji `ArrayBufferLike` koji `crypto.subtle` ne prihvata direktno.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Novu potpisanu vrednost za `kf_admin_session` cookie, validnu `SESSION_TTL_MS`. */
export async function signSession(secret: string): Promise<string> {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = toBase64Url(new TextEncoder().encode(payload));

  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));

  return `${payloadB64}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Da li je cookie vrednost validno potpisana I jos nije istekla. */
export async function verifySession(cookieValue: string | undefined, secret: string): Promise<boolean> {
  if (!cookieValue) return false;

  const [payloadB64, signatureB64] = cookieValue.split(".");
  if (!payloadB64 || !signatureB64) return false;

  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signatureB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return false;

    const payload: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    if (typeof payload !== "object" || payload === null || !("exp" in payload)) return false;

    const exp = (payload as { exp: unknown }).exp;
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    // Nevalidan base64/JSON — tretiraj kao nevalidnu sesiju, ne baci gresku.
    return false;
  }
}

export const ADMIN_SESSION_COOKIE = "kf_admin_session";
