import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, clientIp, isSafeHref } from "../supabase/functions/server/safety";

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
