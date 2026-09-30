import { describe, expect, it } from "vitest";
import {
  buildPrompt, buildSections, getVisibleContacts, insufficientContactNote, personaPrelude, selectKnowledge,
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
