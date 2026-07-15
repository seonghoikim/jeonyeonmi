/* Session-token helpers for the editor login flow.
   Tokens are stateless: base64url(payload) + "." + HMAC-SHA256 signature,
   signed with SESSION_SECRET. No server-side session storage needed. */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(secret: string): Promise<string> {
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(secret: string, token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;
  const expectedSig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payloadB64));
  if (toBase64Url(new Uint8Array(expectedSig)) !== sigB64) return false;
  try {
    const { exp } = JSON.parse(decoder.decode(fromBase64Url(payloadB64)));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

// Constant-time compare so failed password attempts don't leak length/prefix via timing.
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.length, bBytes.length, 1);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}
