/* Request-safety helpers, kept out of index.tsx so the route handlers stay about
   request handling. Nothing here touches the network except resolveHostAddresses. */

/* ── links stored by the editor and rendered as href on the public site ── */
// Rejects explicit non-web schemes (javascript:, data:, vbscript:, ...). A bare
// "youtu.be/abc" with no scheme at all is allowed — editors do paste those, and it
// can't execute anything.
export function isSafeHref(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string") return false;
  const m = value.trim().match(/^([a-z][a-z0-9+.-]*):/i);
  if (!m) return true;
  return ["http", "https", "mailto", "tel"].includes(m[1].toLowerCase());
}

/* ── client identity for rate limiting ──
   cf-connecting-ip is set by Cloudflare in front of Supabase and overwrites any
   client-supplied copy; x-forwarded-for's left-most entry is client-controlled
   unless a proxy strips it, so it is only the fallback. */
export function clientIp(headers: { get(name: string): string | null | undefined }): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── SSRF guard for server-side fetches of editor-supplied URLs ── */
function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(v)) return true; // fe80::/10 link-local
  if (v.startsWith("::ffff:")) { // IPv4-mapped — judge by the embedded IPv4
    const rest = v.slice(7);
    if (rest.includes(".")) return isPrivateIPv4(rest);
    const m = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (!m) return true;
    const hi = parseInt(m[1], 16);
    const lo = parseInt(m[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return false;
}

function isPrivateAddress(ip: string): boolean {
  return ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

// null = this runtime can't resolve DNS, so only the literal-host checks apply.
async function resolveHostAddresses(host: string): Promise<string[] | null> {
  const resolve = (Deno as unknown as { resolveDns?: (h: string, t: string) => Promise<string[]> }).resolveDns;
  if (typeof resolve !== "function") return null;
  const results = await Promise.allSettled([resolve(host, "A"), resolve(host, "AAAA")]);
  const addrs: string[] = [];
  let unsupported = false;
  for (const r of results) {
    if (r.status === "fulfilled") addrs.push(...r.value);
    else if (String(r.reason).includes("NotSupported") || String(r.reason).includes("not supported")) unsupported = true;
  }
  return unsupported && addrs.length === 0 ? null : addrs;
}

/** Throws with a short reason unless `raw` is an http(s) URL on port 80/443 whose host is public. */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("invalid_url"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid_scheme");
  if (url.username || url.password) throw new Error("credentials_in_url");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("port_not_allowed");

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("host_not_allowed");
  }
  // URL parsing already normalises decimal/hex/octal IPv4 forms to dotted quads.
  if (host.startsWith("[")) {
    if (isPrivateIPv6(host)) throw new Error("host_not_allowed");
    return url;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIPv4(host)) throw new Error("host_not_allowed");
    return url;
  }
  const addrs = await resolveHostAddresses(host);
  if (addrs && addrs.some(isPrivateAddress)) throw new Error("host_not_allowed");
  return url;
}
