import { describe, expect, it } from "vitest";
import {
  buildPrompt, buildSections, exhibitionStatus, getVisibleContacts, insufficientContactNote, kstToday, normalizeDate, parseCuratorOutput, personaPrelude, selectKnowledge,
  type PortfolioRowForCurator,
} from "../supabase/functions/server/curator-prompt";

const row: PortfolioRowForCurator = {
  content: { heroName: "전연미", heroNameEn: "Jeon Yeon-mi", heroDesc: "한지를 태우고 찢는 작가", heroDescEn: "Burns and tears hanji" },
  slides: [{ heading: "작가노트", headingEn: "Statement", body: "태움은 소멸이 아니다", bodyEn: "Burning is not ending" }],
  artworks: [
    { title: "봄 결", titleEn: "Bom-gyeol", year: "2026", medium: "한지", mediumEn: "Hanji", size: "10F", category: "회화", collected: true, description: "시작의 다짐" },
    { title: "작열", titleEn: "Incandescence", year: "2025", medium: "한지", size: "20F", category: "회화" },
  ],
  current_exhibitions: [
    { title: "숨", titleEn: "Breath", venue: "갤러리", location: "서울", startDate: "2026.10.01", endDate: "2026.10.30", tag: "개인전", visible: true },
    { title: "숨김전", titleEn: "Hidden", venue: "v", location: "l", startDate: "a", endDate: "b", tag: "개인전", visible: false },
  ],
  contacts: [
    { type: "instagram", labelKo: "인스타그램", labelEn: "Instagram", display: "@artist", href: "https://instagram.com/artist", visible: true },
    { type: "blog", labelKo: "블로그", labelEn: "Blog", display: "blog", href: "https://blog.example", visible: true },
    { type: "phone", labelKo: "전화", labelEn: "Phone", display: "010", href: "tel:010", visible: false },
  ],
};

describe("buildSections", () => {
  it("uses the requested language and falls back to Korean when English is missing", () => {
    const en = buildSections(row, "en");
    expect(en.works).toContain("Bom-gyeol");
    expect(en.works).toContain("Incandescence");
    expect(en.profile).toContain("Jeon Yeon-mi");
    expect(buildSections(row, "ko").works).toContain("봄 결");
  });
  it("flags collected works and includes descriptions", () => {
    const ko = buildSections(row, "ko");
    expect(ko.works).toContain("컬렉션");
    expect(ko.works).toContain("시작의 다짐");
  });
  it("leaves hidden exhibitions and hidden contacts out", () => {
    const ko = buildSections(row, "ko");
    expect(ko.currentExhibitions).toContain("숨");
    expect(ko.currentExhibitions).not.toContain("숨김전");
    expect(ko.contact).not.toContain("010");
  });
  it("returns empty strings for sections with no data", () => {
    expect(buildSections({}, "ko").press).toBe("");
  });
});

describe("getVisibleContacts", () => {
  it("returns only visible contacts with language-specific labels", () => {
    expect(getVisibleContacts(row, "en").map((c) => c.label)).toEqual(["Instagram", "Blog"]);
  });
});

describe("selectKnowledge", () => {
  it("sends every section while the total is under budget", () => {
    const k = selectKnowledge("아무 질문", buildSections(row, "ko"));
    expect(k).toContain("작가노트");
    expect(k).toContain("작품 목록");
  });
  it("switches to keyword-picked sections once the knowledge base is large", () => {
    const big = { ...row, artworks: Array.from({ length: 400 }, (_, i) => ({ title: `작품${i}`, titleEn: `Work${i}`, year: "2026", medium: "한지", size: "1F", category: "회화", description: "긴 설명 ".repeat(20) })) };
    const sections = buildSections(big, "ko");
    const asked = selectKnowledge("언론 보도 기사 알려줘", sections);
    expect(asked.length).toBeLessThan(sections.works.length);
    expect(asked).toContain("전연미"); // profile is always included
  });
});

describe("selectKnowledge at the site's real size", () => {
  // ~50 works plus statement/exhibitions came to ~11K chars — over the old 9000 budget,
  // which silently sent only statement+works and left exhibition history out.
  const realistic: PortfolioRowForCurator = {
    ...row,
    artworks: Array.from({ length: 54 }, (_, i) => ({ title: `작품 ${i}`, titleEn: `Work ${i}`, year: "2026", medium: "한지와 아크릴", size: "10F", category: "회화", description: "작품 설명 문장입니다. ".repeat(12) })),
    exhibitions: [{ year: "2025", title: "단체전 하나", venue: "갤러리", location: "서울", tag: "단체전" }],
  };
  it("still sends every section, so an exhibition question can see the exhibition history", () => {
    const sections = buildSections(realistic, "ko");
    const full = [sections.profile, sections.statement, sections.works, sections.currentExhibitions, sections.history, sections.press, sections.contact].join("").length;
    expect(full).toBeGreaterThan(9000);
    expect(selectKnowledge("어떤 전시를 했나요?", sections)).toContain("단체전 하나");
  });
});

describe("buildPrompt", () => {
  it("asks for the JSON shape including sufficient and suggestions, and carries the question", () => {
    const p = buildPrompt("재료가 뭔가요?", "REF", "", "ko");
    expect(p).toContain('"sufficient"');
    expect(p).toContain('"suggestions"');
    expect(p).toContain("방문자의 새 질문: 재료가 뭔가요?");
    expect(p).toContain("[참고 자료 시작]\nREF\n[참고 자료 끝]");
  });
  it("builds an English prompt for lang=en", () => {
    const p = buildPrompt("What materials?", "REF", "", "en");
    expect(p).toContain("New question: What materials?");
    expect(p).toContain("[Reference start]");
  });
  it("keeps the tone rules that were explicitly requested", () => {
    const ko = personaPrelude("ko");
    expect(ko).toContain("가격, 작품 구매, 커미션");
    expect(ko).toContain("기계적인 말투");
  });
});

describe("insufficientContactNote", () => {
  it("names both channels in Korean", () => {
    const note = insufficientContactNote(getVisibleContacts(row, "ko"), "ko");
    expect(note).toContain("인스타그램(@artist)");
    expect(note).toContain("네이버 블로그");
  });
  it("returns nothing when there is no channel to point to", () => {
    expect(insufficientContactNote([], "ko")).toBe("");
  });
});

describe("parseCuratorOutput", () => {
  it("parses a complete reply, capping suggestions at three and dropping blanks", () => {
    const out = parseCuratorOutput(JSON.stringify({ answer: " 답변입니다 ", sufficient: true, suggestions: ["a", "", "b", "c", "d"] }));
    expect(out).toEqual({ answer: "답변입니다", sufficient: true, suggestions: ["a", "b", "c"] });
  });
  it("only an explicit false marks the answer insufficient", () => {
    expect(parseCuratorOutput('{"answer":"x","sufficient":false}')?.sufficient).toBe(false);
    expect(parseCuratorOutput('{"answer":"x"}')?.sufficient).toBe(true);
  });
  it("returns null for JSON truncated mid-string — the raw text must never reach a visitor", () => {
    expect(parseCuratorOutput('{\n  "answer": "전연미 작가에게 한지를 태우는 행위는 무언가를 없애는')).toBeNull();
    expect(parseCuratorOutput('{"answer":"완성된 문장","suggestions":["절반만')).toBeNull();
  });
  it("returns null for empty, blank-answer, or answerless JSON", () => {
    expect(parseCuratorOutput("")).toBeNull();
    expect(parseCuratorOutput('{"answer":"  "}')).toBeNull();
    expect(parseCuratorOutput('{"suggestions":["a"]}')).toBeNull();
  });
  it("unwraps a fenced json block", () => {
    expect(parseCuratorOutput('```json\n{"answer":"펜스 안"}\n```')?.answer).toBe("펜스 안");
  });
  it("uses plain prose as the answer when there is no JSON at all", () => {
    expect(parseCuratorOutput("그냥 문장입니다.")).toEqual({ answer: "그냥 문장입니다.", sufficient: true, suggestions: [] });
  });
});

describe("dates and exhibition status", () => {
  it("normalizes the site's date formats and rejects non-dates", () => {
    expect(normalizeDate("2026.09.08")).toBe("2026-09-08");
    expect(normalizeDate("2026-9-8")).toBe("2026-09-08");
    expect(normalizeDate("미정")).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });
  it("kstToday uses Korean time, not UTC", () => {
    // 2026-09-29 16:00 UTC is already 2026-09-30 01:00 in Seoul.
    expect(kstToday(Date.UTC(2026, 8, 29, 16, 0, 0))).toBe("2026-09-30");
    expect(kstToday(Date.UTC(2026, 8, 29, 14, 59, 0))).toBe("2026-09-29");
  });
  const ex = (startDate: string, endDate: string, status?: string) => ({ startDate, endDate, status });
  it("classifies by date, treating the first and last day as ongoing", () => {
    const today = "2026-09-30";
    expect(exhibitionStatus(ex("2026.09.08", "2026.10.04"), today)).toBe("ongoing");
    expect(exhibitionStatus(ex("2026.09.30", "2026.10.04"), today)).toBe("ongoing"); // opens today
    expect(exhibitionStatus(ex("2026.09.01", "2026.09.30"), today)).toBe("ongoing"); // closes today
    expect(exhibitionStatus(ex("2026.08.25", "2026.09.18"), today)).toBe("past");
    expect(exhibitionStatus(ex("2026.10.02", "2026.10.11"), today)).toBe("upcoming");
  });
  it("falls back to the editor's status when dates can't be read", () => {
    expect(exhibitionStatus(ex("미정", "미정", "진행중"), "2026-09-30")).toBe("ongoing");
    expect(exhibitionStatus(ex("미정", "미정", "지난전시"), "2026-09-30")).toBe("past");
    expect(exhibitionStatus(ex("미정", "미정"), "2026-09-30")).toBe("upcoming");
  });
});

describe("current & upcoming exhibitions section", () => {
  const rowWithShows: PortfolioRowForCurator = {
    current_exhibitions: [
      { title: "지난 전시 A", venue: "v", location: "l", startDate: "2026.08.25", endDate: "2026.09.18", tag: "단체전" },
      { title: "예정 전시 늦음", venue: "v", location: "l", startDate: "2026.11.18", endDate: "2026.11.25", tag: "단체전" },
      { title: "진행중 개인전", venue: "v", location: "l", startDate: "2026.09.08", endDate: "2026.10.04", tag: "개인전" },
      { title: "예정 전시 빠름", venue: "v", location: "l", startDate: "2026.10.02", endDate: "2026.10.11", tag: "아트페어" },
      { title: "더 지난 전시 B", venue: "v", location: "l", startDate: "2026.05.14", endDate: "2026.05.17", tag: "아트페어" },
      { title: "숨김", venue: "v", location: "l", startDate: "2026.10.01", endDate: "2026.10.02", tag: "개인전", visible: false },
    ],
  };
  const lines = buildSections(rowWithShows, "ko", "2026-09-30").currentExhibitions.split("\n").filter((l) => l.startsWith("- "));
  it("labels each show and orders ongoing, then upcoming soonest-first, then past newest-first", () => {
    expect(lines.map((l) => l.match(/\[(진행중|예정|지난전시)\]/)?.[1])).toEqual(["진행중", "예정", "예정", "지난전시", "지난전시"]);
    expect(lines[0]).toContain("진행중 개인전");
    expect(lines[1]).toContain("예정 전시 빠름");
    expect(lines[2]).toContain("예정 전시 늦음");
    expect(lines[3]).toContain("지난 전시 A");
    expect(lines[4]).toContain("더 지난 전시 B");
  });
  it("leaves hidden shows out and uses English labels for lang=en", () => {
    expect(lines.join("")).not.toContain("숨김");
    expect(buildSections(rowWithShows, "en", "2026-09-30").currentExhibitions).toContain("[Ongoing]");
  });
});

describe("auto-counted summary", () => {
  const r: PortfolioRowForCurator = {
    artworks: [
      { title: "A", year: "2025", medium: "m", size: "s", category: "c", series: "S1", heroFeatured: true },
      { title: "A", year: "2025", medium: "m", size: "s", category: "c", series: "S1", heroFeatured: true, collected: true },
      { title: "B", year: "2026", medium: "m", size: "s", category: "c", collected: true },
    ],
    exhibitions: [
      { year: "2026.08", title: "t", venue: "v", location: "l", tag: "단체전", award: "특선" },
      { year: "2025", title: "t2", venue: "v", location: "l", tag: "개인전" },
    ],
    current_exhibitions: [{ title: "x", venue: "v", location: "l", startDate: "2026.09.08", endDate: "2026.10.04", tag: "개인전" }],
  };
  const summary = buildSections(r, "ko", "2026-09-30").summary;
  it("gives exact counts by year, series and collection", () => {
    expect(summary).toContain("작품 총 3점");
    expect(summary).toContain("2025년 2점, 2026년 1점");
    expect(summary).toContain("S1 2점");
    expect(summary).toContain("시리즈 없음 1점");
    expect(summary).toContain("컬렉션(소장) 2점");
  });
  it("lists each featured title once and summarizes exhibitions, awards and today's status", () => {
    expect(summary).toContain("대표작: A(2025)");
    expect(summary.match(/A\(2025\)/g)).toHaveLength(1);
    expect(summary).toContain("전시 이력 2건");
    expect(summary).toContain("수상·선정: 2026.08 특선");
    expect(summary).toContain("오늘(2026-09-30) 기준 전시: 진행중 1건");
  });
  it("is always sent, even when the knowledge base is large enough to be filtered", () => {
    const big = { ...r, artworks: Array.from({ length: 900 }, (_, i) => ({ title: `작품${i}`, year: "2026", medium: "한지", size: "1F", category: "회화", description: "긴 설명 ".repeat(30) })) };
    expect(selectKnowledge("언론 기사", buildSections(big, "ko", "2026-09-30"))).toContain("작품 총 900점");
  });
});

describe("prompt date awareness", () => {
  it("states today's date after the reference block and asks for date-based reasoning", () => {
    const p = buildPrompt("다음 전시는?", "REF", "", "ko", "2026-09-30");
    expect(p).toContain("오늘 날짜: 2026-09-30 (한국 시간)");
    expect(p.indexOf("[참고 자료 끝]")).toBeLessThan(p.indexOf("오늘 날짜: 2026-09-30"));
    expect(personaPrelude("ko")).toContain("[진행중]/[예정]/[지난전시]");
    expect(buildPrompt("next show?", "REF", "", "en", "2026-09-30")).toContain("Today's date: 2026-09-30");
  });
});

describe("artist notes", () => {
  it("are part of the knowledge in both languages and say what the docent could not answer before", () => {
    const ko = selectKnowledge("가장 먼저 제작한 작품이 뭐예요?", buildSections(row, "ko"));
    expect(ko).toContain("작가가 직접 들려준 추가 정보");
    expect(ko).toContain("가장 먼저 만든 작품은 〈흰 결〉");
    expect(ko).toContain("SNS 연락처");
    expect(ko).toContain("남편의 한마디");
    const en = selectKnowledge("Where did the work begin?", buildSections(row, "en"));
    expect(en).toContain("Additional notes from the artist");
    expect(en).toContain("one sentence from my husband");
  });
  it("survive keyword-picking when the knowledge base is large", () => {
    const big = { ...row, artworks: Array.from({ length: 400 }, (_, i) => ({ title: `작품${i}`, titleEn: `Work${i}`, year: "2026", medium: "한지", size: "1F", category: "회화", description: "긴 설명 ".repeat(20) })) };
    const k = selectKnowledge("언론 보도 기사 알려줘", buildSections(big, "ko"));
    expect(k).toContain("작가가 직접 들려준 추가 정보");
  });
});
