import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, clientIp, detectImageType, isSafeHref } from "../supabase/functions/server/safety";

describe("isSafeHref", () => {
  it.each(["https://a.com", "http://a.com", "mailto:a@b.c", "tel:+8210", "/works/x", "youtu.be/abc", "", undefined, null])("allows %s", (v) => {
    expect(isSafeHref(v)).toBe(true);
  });
  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "  javascript:1", "data:text/html,x", "vbscript:x"])("rejects %s", (v) => {
    expect(isSafeHref(v)).toBe(false);
  });
  it("rejects non-strings", () => {
    expect(isSafeHref(42)).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it.each([
    "http://127.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://169.254.169.254/latest", "http://[::1]/",
    "http://[::ffff:127.0.0.1]/", "http://10.0.0.5/", "http://192.168.1.1/", "http://172.16.0.1/", "http://100.64.0.1/",
    "http://[fd00::1]/", "http://localhost/", "http://x.local/", "http://db.internal/", "http://example.com:8080/",
    "http://user:pw@example.com/", "ftp://example.com/",
  ])("blocks %s", async (u) => {
    await expect(assertPublicHttpUrl(u)).rejects.toThrow();
  });
  it.each(["http://93.184.216.34/", "https://93.184.216.34:443/x"])("allows public literal %s", async (u) => {
    await expect(assertPublicHttpUrl(u)).resolves.toBeInstanceOf(URL);
  });
});

describe("clientIp", () => {
  const h = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null });
  it("prefers cf-connecting-ip over the spoofable forwarded header", () => {
    expect(clientIp(h({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 1.1.1.1" }))).toBe("1.2.3.4");
  });
  it("falls back to the first forwarded entry, then 'unknown'", () => {
    expect(clientIp(h({ "x-forwarded-for": "9.9.9.9, 1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("detectImageType", () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73]);
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
  it("accepts real WebP and JPEG bytes", () => {
    expect(detectImageType(webp)).toBe("webp");
    expect(detectImageType(jpeg)).toBe("jpeg");
  });
  it("rejects PNG, SVG/HTML and tiny or empty input", () => {
    expect(detectImageType(png)).toBeNull();
    expect(detectImageType(svg)).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});
