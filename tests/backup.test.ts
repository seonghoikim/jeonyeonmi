import { describe, expect, it } from "vitest";
import { RESTORABLE_COLUMNS, assertLooksValid, stableStringify, summarize, toRestoreSql } from "../scripts/lib/backup.mjs";

const row = {
  id: 1,
  updated_at: "2026-09-30T09:17:56.673+00:00",
  content: { heroName: "전연미", footerCopyright: "Copyright © 2026 \"quoted\" it's a $1 & <b>" },
  current_exhibitions: [{ id: 2, title: "전시 'A'", endDate: "2026.10.04" }],
  artworks: [{ id: 53, title: "연 결", description: "줄바꿈\n두 번째 줄\\역슬래시", collected: true }, { id: 7, title: "B" }],
  series_list: [], slides: [{ id: 1, heading: "작가노트" }], exhibitions: [], activity_photos: [],
  videos: [], contacts: [{ id: "email", href: "mailto:a@b.c", visible: true }], press: [],
  settings: { curatorEnabled: "true" }, image_urls: { "artwork-53": "https://img/53.webp" },
};

describe("stableStringify", () => {
  it("is independent of key order but keeps array order", () => {
    const a = stableStringify({ b: 1, a: { d: [3, 1, 2], c: 2 } });
    const b = stableStringify({ a: { c: 2, d: [3, 1, 2] }, b: 1 });
    expect(a).toBe(b);
    expect(JSON.parse(a).a.d).toEqual([3, 1, 2]);
    expect(a.endsWith("\n")).toBe(true);
  });
  it("round-trips exactly", () => {
    expect(JSON.parse(stableStringify(row))).toEqual(row);
  });
});

describe("assertLooksValid", () => {
  it("accepts a populated row", () => expect(() => assertLooksValid(row)).not.toThrow());
  it.each([
    [null], [{}], [{ ...row, content: undefined }], [{ ...row, artworks: [] }], [{ ...row, artworks: undefined }], [{ ...row, updated_at: undefined }],
  ])("rejects %j so a bad fetch can never overwrite a good backup", (bad) => {
    expect(() => assertLooksValid(bad)).toThrow();
  });
});

describe("summarize", () => {
  it("counts each list", () => expect(summarize(row)).toBe("works=2 current_ex=1 history=0 press=0 videos=0 slides=1"));
});

describe("toRestoreSql", () => {
  const sql = toRestoreSql(row);
  // Read the SQL back the way Postgres would: each column's value sits between the quoting tags.
  const parsedBack = Object.fromEntries(
    RESTORABLE_COLUMNS.map((col) => {
      const m = sql.match(new RegExp(`  ${col} = \\$portfolio_restore\\$([\\s\\S]*?)\\$portfolio_restore\\$::jsonb`));
      return [col, m ? JSON.parse(m[1]) : undefined];
    }),
  );
  it("restores every content column with values identical to the snapshot (quotes, $, newlines, backslashes)", () => {
    for (const col of RESTORABLE_COLUMNS) expect(parsedBack[col]).toEqual(row[col as keyof typeof row]);
  });
  it("targets only row 1, never touches id, and stamps updated_at", () => {
    expect(sql).toContain("update public.portfolio_state set");
    expect(sql).toContain("  updated_at = now()");
    expect(sql).toContain("where id = 1;");
    expect(sql).not.toMatch(/\bid\s*=\s*\$/);
  });
  it("fills missing columns with the right empty shape instead of NULL", () => {
    const { settings, press, ...rest } = row;
    const partial = toRestoreSql(rest);
    expect(partial).toContain("settings = $portfolio_restore${}$portfolio_restore$::jsonb");
    expect(partial).toContain("press = $portfolio_restore$[]$portfolio_restore$::jsonb");
  });
  it("refuses to build SQL for an invalid snapshot or one containing the quoting tag", () => {
    expect(() => toRestoreSql({ ...row, artworks: [] })).toThrow();
    expect(() => toRestoreSql({ ...row, content: { x: "$portfolio_restore$ boom" } })).toThrow();
  });
});
