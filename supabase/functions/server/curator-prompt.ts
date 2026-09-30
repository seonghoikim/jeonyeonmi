/* Prompt + knowledge assembly for the "curator" (호이) widget, kept out of
   index.tsx so the route handler stays about request handling and this file
   stays about what gets said and what the model sees.

   Knowledge is built fresh from the live portfolio_state row on every request
   (no separate copy to keep in sync) and split into named sections. For a
   dataset this size (one artist's site) sending every section every time is
   usually fine and most accurate — but as more exhibitions/press/works get
   added over the years this would otherwise grow unbounded, so past a size
   threshold we switch to keyword-based section selection instead of always
   sending everything. */

export type PortfolioRowForCurator = {
  content?: Record<string, string>;
  slides?: { heading: string; headingEn?: string; body: string; bodyEn?: string }[];
  artworks?: { title: string; titleEn?: string; year: string; medium: string; mediumEn?: string; size: string; category: string; categoryEn?: string; series?: string; collected?: boolean; heroFeatured?: boolean; description?: string; descriptionEn?: string }[];
  current_exhibitions?: { title: string; titleEn?: string; venue: string; venueEn?: string; location: string; locationEn?: string; startDate: string; endDate: string; tag: string; status?: string; visible?: boolean }[];
  exhibitions?: { year: string; title: string; titleEn?: string; venue: string; venueEn?: string; location: string; locationEn?: string; tag: string; award?: string; awardEn?: string }[];
  press?: { date: string; outlet: string; outletEn?: string; title: string; titleEn?: string }[];
  contacts?: { type: string; labelKo: string; labelEn: string; display: string; href: string; visible: boolean }[];
};

export type CuratorSections = {
  profile: string;
  summary: string;
  statement: string;
  works: string;
  currentExhibitions: string;
  history: string;
  press: string;
  contact: string;
};

export type CuratorContact = { type: string; label: string; display: string; href: string };

function t(isKo: boolean, ko?: string, en?: string): string {
  return (isKo ? ko : en || ko) ?? "";
}

export function getVisibleContacts(row: PortfolioRowForCurator, lang: "ko" | "en"): CuratorContact[] {
  const isKo = lang === "ko";
  return (row.contacts ?? [])
    .filter((c) => c.visible)
    .map((c) => ({ type: c.type, label: isKo ? c.labelKo : c.labelEn, display: c.display, href: c.href }));
}

/* ── dates ──
   The model has no clock, so without an explicit "today" it can't tell a running
   exhibition from an upcoming or finished one — it once told a visitor the show that
   had opened three weeks earlier was "upcoming" and one that had already closed was
   still on. Status is computed here from the dates, in Korean time. */
export function kstToday(now: number = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// "2026.09.08" / "2026-9-8" -> "2026-09-08"; null when it isn't a date.
export function normalizeDate(s?: string): string | null {
  const m = String(s ?? "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
}

export type ExhibitionStatus = "ongoing" | "upcoming" | "past";

export function exhibitionStatus(e: { startDate: string; endDate: string; status?: string }, today: string): ExhibitionStatus {
  const start = normalizeDate(e.startDate);
  const end = normalizeDate(e.endDate) ?? start;
  if (start && end) {
    if (end < today) return "past";
    if (start > today) return "upcoming";
    return "ongoing";
  }
  // Unparseable dates (e.g. "미정"): fall back to whatever the editor set.
  return e.status === "진행중" ? "ongoing" : e.status === "지난전시" ? "past" : "upcoming";
}

const STATUS_LABEL: Record<ExhibitionStatus, { ko: string; en: string }> = {
  ongoing: { ko: "진행중", en: "Ongoing" },
  upcoming: { ko: "예정", en: "Upcoming" },
  past: { ko: "지난전시", en: "Past" },
};

const countBy = <T,>(items: T[], key: (x: T) => string): [string, number][] => {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()];
};

export function buildSections(row: PortfolioRowForCurator, lang: "ko" | "en", today: string = kstToday()): CuratorSections {
  const isKo = lang === "ko";
  const tt = (ko?: string, en?: string) => t(isKo, ko, en);

  const profileLines: string[] = [];
  profileLines.push(`${tt("작가명", "Artist")}: ${tt(row.content?.heroName, row.content?.heroNameEn) || "전연미 (Jeon Yeon-mi)"}`);
  const desc = tt(row.content?.heroDesc, row.content?.heroDescEn);
  if (desc) profileLines.push(`${tt("소개", "Description")}: ${desc}`);

  const statementLines: string[] = [];
  for (const s of row.slides ?? []) {
    const heading = tt(s.heading, s.headingEn).replace(/\n/g, " ");
    const body = tt(s.body, s.bodyEn);
    if (heading || body) statementLines.push(`### ${heading}\n${body}`);
  }

  const worksLines: string[] = [];
  for (const a of row.artworks ?? []) {
    const title = tt(a.title, a.titleEn);
    const medium = tt(a.medium, a.mediumEn);
    const category = tt(a.category, a.categoryEn);
    const collected = a.collected ? ` · ${tt("컬렉션", "Collected")}` : "";
    const d = tt(a.description, a.descriptionEn);
    worksLines.push(`- ${title} (${a.year}) · ${medium} · ${a.size} · ${category}${collected}${d ? `\n  ${d}` : ""}`);
  }

  // Running first, then upcoming (soonest first), then past (most recent first) — the
  // order a visitor cares about, and one the model can read straight off the list.
  const rank: Record<ExhibitionStatus, number> = { ongoing: 0, upcoming: 1, past: 2 };
  const visibleEx = (row.current_exhibitions ?? [])
    .filter((e) => e.visible !== false)
    .map((e) => ({ e, status: exhibitionStatus(e, today), start: normalizeDate(e.startDate) ?? "9999" }))
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.status === "past" ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
  const currentExLines: string[] = visibleEx.map(({ e, status }) =>
    `- [${STATUS_LABEL[status][isKo ? "ko" : "en"]}] ${e.startDate}–${e.endDate} ${tt(e.title, e.titleEn)} — ${tt(e.venue, e.venueEn)}, ${tt(e.location, e.locationEn)} [${e.tag}]`);

  const historyLines: string[] = [];
  for (const e of row.exhibitions ?? []) {
    const award = tt(e.award, e.awardEn);
    historyLines.push(`- ${e.year} ${tt(e.title, e.titleEn)} — ${tt(e.venue, e.venueEn)}, ${tt(e.location, e.locationEn)} [${e.tag}]${award ? ` — ${award}` : ""}`);
  }

  const pressLines: string[] = [];
  for (const p of row.press ?? []) pressLines.push(`- ${p.date} ${tt(p.outlet, p.outletEn)} — ${tt(p.title, p.titleEn)}`);

  const contacts = getVisibleContacts(row, lang);
  const contactLines = contacts.map((c) => `- ${c.label}: ${c.display}`);

  const wrap = (heading: string, lines: string[]) => (lines.length ? `## ${heading}\n${lines.join("\n")}` : "");

  // Counted here rather than left to the model: asked "how many works?" it answered "40여 점"
  // for a list of 54.
  const artworks = row.artworks ?? [];
  const factLines: string[] = [];
  if (artworks.length) {
    const byYear = countBy(artworks, (a) => a.year).sort(([x], [y]) => x.localeCompare(y)).map(([y, n]) => (isKo ? `${y}년 ${n}점` : `${y}: ${n}`)).join(", ");
    const bySeries = countBy(artworks, (a) => a.series || (isKo ? "시리즈 없음" : "no series")).map(([s, n]) => (isKo ? `${s} ${n}점` : `${s}: ${n}`)).join(", ");
    const collectedN = artworks.filter((a) => a.collected).length;
    factLines.push(isKo
      ? `- 작품 총 ${artworks.length}점 (연도별: ${byYear} / 시리즈별: ${bySeries} / 컬렉션(소장) ${collectedN}점)`
      : `- ${artworks.length} works in total (by year: ${byYear} / by series: ${bySeries} / ${collectedN} in collections)`);
    const featured = [...new Set(artworks.filter((a) => a.heroFeatured).map((a) => `${tt(a.title, a.titleEn)}(${a.year})`))];
    if (featured.length) {
      factLines.push(isKo
        ? `- 작가가 홈페이지 첫 화면에서 소개하는 대표작: ${featured.join(", ")}`
        : `- Works the artist features on the homepage's first screen: ${featured.join(", ")}`);
    }
  }
  const history = row.exhibitions ?? [];
  if (history.length) {
    const byTag = countBy(history, (e) => e.tag).map(([g, n]) => (isKo ? `${g} ${n}건` : `${g}: ${n}`)).join(", ");
    const awards = history.filter((e) => e.award).map((e) => `${e.year} ${tt(e.award, e.awardEn)}`);
    factLines.push(isKo
      ? `- 전시 이력 ${history.length}건 (${byTag})${awards.length ? ` · 수상·선정: ${awards.join(", ")}` : ""}`
      : `- ${history.length} exhibitions on record (${byTag})${awards.length ? ` · awards/selections: ${awards.join(", ")}` : ""}`);
  }
  if (visibleEx.length) {
    const n = (s: ExhibitionStatus) => visibleEx.filter((x) => x.status === s).length;
    factLines.push(isKo
      ? `- 오늘(${today}) 기준 전시: 진행중 ${n("ongoing")}건, 예정 ${n("upcoming")}건, 지난 전시 ${n("past")}건`
      : `- As of today (${today}): ${n("ongoing")} ongoing, ${n("upcoming")} upcoming, ${n("past")} past exhibitions`);
  }

  return {
    profile: profileLines.join("\n"),
    summary: wrap(tt("자료 요약 (자동 집계)", "Summary (auto-counted)"), factLines),
    statement: wrap(tt("작가노트", "Artist Statement"), statementLines),
    works: wrap(tt("작품 목록 (크기는 세로 x 가로)", "Selected Works (sizes are height x width)"), worksLines),
    currentExhibitions: wrap(tt("현재·예정 전시", "Current & Upcoming Exhibitions"), currentExLines),
    history: wrap(tt("전시 및 수상 이력", "Exhibition & Award History"), historyLines),
    press: wrap(tt("언론 보도", "Press"), pressLines),
    contact: wrap(tt("연락처", "Contact"), contactLines),
  };
}

/* Keyword hints per section — deliberately loose (over-matching costs a few
   hundred extra characters; under-matching costs a wrong "I don't know"). */
const KEYWORDS: Record<"works" | "statement" | "currentExhibitions" | "history" | "press", RegExp> = {
  works: /작품|작열|코르셋|꿈\s*결|봄\s*결|묵\s*결|숨\s*결|흰\s*결|연\s*결|결연|재료|기법|한지|태우|찢|크기|cm|시리즈|컬렉션|소장|가격|work|piece|material|technique|size|series|collect|price/i,
  statement: /작가노트|철학|영감|의미|컨셉|콘셉트|작업\s*방식|스타일|왜\s*이런|statement|philosophy|inspir|concept|meaning|why/i,
  currentExhibitions: /전시|지금|현재|예정|어디서|언제|가볼|방문|now|current|upcoming|exhibit|where|when|visit/i,
  history: /전시|이력|경력|수상|선정|공모전|아트페어|연혁|약력|exhibit|award|history|competition|fair|career/i,
  press: /기사|보도|언론|인터뷰|뉴스|press|article|interview|news/i,
};

// Below this, just send every section — simpler and more accurate than
// guessing, and small enough that the extra tokens don't matter. (It was 9000, which the
// site outgrew once it had ~50 works: the works section alone is ~6.5K chars, so every
// question silently fell into keyword-picking and e.g. "어떤 전시를 했나요?" never got
// the exhibition history. A full send is ~14K chars, well within what one call handles.)
const FULL_SEND_CHAR_BUDGET = 40000;

export function selectKnowledge(question: string, sections: CuratorSections): string {
  const always = [sections.profile, sections.summary, sections.contact].filter(Boolean);
  const optional: [keyof typeof KEYWORDS, string][] = [
    ["statement", sections.statement],
    ["works", sections.works],
    ["currentExhibitions", sections.currentExhibitions],
    ["history", sections.history],
    ["press", sections.press],
  ];
  const full = [...always, ...optional.map(([, v]) => v)].filter(Boolean).join("\n\n");
  if (full.length <= FULL_SEND_CHAR_BUDGET) return full;

  const matched = optional.filter(([key]) => KEYWORDS[key].test(question)).map(([, v]) => v);
  // No section matched (a very generic question) — default to the two sections
  // that answer the most common questions in practice.
  const picked = matched.length ? matched : [sections.statement, sections.works];
  return [...always, ...picked].filter(Boolean).join("\n\n");
}

export function personaPrelude(lang: "ko" | "en"): string {
  if (lang === "ko") {
    return `당신은 전연미 작가의 활동을 함께하는 매니저 '호이'입니다. 방문자에게 전연미 작가와 그 작품 세계를 정확하고 전문적으로 소개하는 것이 목적입니다.

어투 원칙:
- "전연미 작가는 ~합니다", "이 작품은 ~을 담고 있습니다"처럼 작가와 작품을 주어로 하는 3인칭 서술을 기본으로 하세요.
- "남편", "아내", "집사람" 같은 개인적 호칭을 답변마다 반복해서 강조하지 마세요. 사적인 친밀함을 내세우기보다, 작가를 가까이서 지켜봐 온 사람의 정확하고 신뢰감 있는 소개자 톤을 유지하세요.
- 필요할 때만 아주 가볍게 1인칭을 섞을 수 있지만("제가 곁에서 본 바로는"), 매 답변마다 관계를 설명하지 마세요.

답변 원칙:
1. 아래 [참고 자료]를 바탕으로 답하세요. "자료에는 ~라고 나와있지 않아요", "확인이 어려워요"처럼 자료를 뒤져서 찾아 전달하는 기계적인 말투는 쓰지 말고, 직접 잘 알고 있는 사람이 자연스럽게 설명하듯 답하세요.
2. 가격, 작품 구매, 커미션(의뢰) 등 비즈니스 관련 질문에는 "모른다"거나 "자료에 없다"고 답하지 마세요. 대신 "이 부분은 인스타그램이나 블로그로 편하게 문의 주시면 자세히 안내해드릴 수 있어요"처럼 담백하고 자연스럽게 직접 문의를 안내하세요. (구체적인 연락처 링크 자체는 답변 본문에 넣지 마세요 — 시스템이 자동으로 붙여드립니다.)
3. 그 외에 자료에 정말 없는 사적인 정보(정확한 생년월일, 출신지 등)를 답할 수 없을 때도, "모르겠어요"라고 무성의하게 끝내지 말고 아는 만큼 자연스럽게 답한 뒤 부족한 부분은 담백하게 인정하세요. 이런 사적 정보는 연락처로 문의한다고 알 수 있는 게 아니므로, 이렇게 답했다면 그 자체로 완결된 답입니다 — 문의를 유도하지 마세요.
4. 친절하고 자연스러운 한국어 존댓말을 쓰되, 큐레이터가 실제로 설명하듯 답하세요.
5. 답변은 3~6문장 정도로, 핵심만 전달하세요.
6. 관련된 작품이 있으면 작품명을 〈 〉로 표기해 언급하세요.
7. 전시 일정을 물으면 [현재·예정 전시]의 [진행중]/[예정]/[지난전시] 표기와 "오늘 날짜"를 기준으로 정확히 구분해 답하세요. 끝난 전시를 예정이라고 하거나, 아직 열리지 않은 전시를 열리고 있다고 하지 마세요. "지금 하는 전시"는 [진행중]만, "다음 전시"는 가장 가까운 [예정]을 기간과 장소와 함께 안내하세요. 해당하는 전시가 없으면 없다고 솔직하게 말하고 가장 최근 전시를 소개하세요.
8. 작품 수·전시 수처럼 개수를 물으면 [자료 요약 (자동 집계)]의 정확한 숫자를 쓰세요. "40여 점" 같은 어림 표현은 쓰지 마세요.
9. "가장 유명한 작품", "대표작"을 물으면 [자료 요약]의 대표작(작가가 홈페이지 첫 화면에서 소개하는 작품)을 중심으로 추천하세요.`;
  }
  return `You are 'Hoi', the manager working alongside artist Jeon Yeon-mi. Your job is to give visitors an accurate, professional introduction to the artist and her work.

Tone:
- Default to third person, with the artist and the work as the subject ("Jeon Yeon-mi works with...", "This piece explores...").
- Don't repeat personal terms like "husband" or "wife" in every answer. Keep a knowledgeable, professional introducer's tone rather than leaning on personal closeness.
- You may use first person sparingly ("from what I've seen up close") but don't re-explain the relationship every time.

Rules:
1. Answer from the [Reference] below, but don't sound like you're mechanically reporting what you did or didn't find ("that's not listed", "I can't confirm that") — answer the way someone who actually knows this would, naturally.
2. For business questions — price, buying a piece, commissions — don't say "I don't know" or "that's not in the material." Instead, naturally point them to reach out directly, e.g. "That's best handled directly — feel free to reach out via Instagram or the blog." (Don't put the actual contact link in your answer text — the system appends that separately.)
3. For other private details genuinely not in the reference (exact birth year, hometown, etc.), don't just flatly say "I don't know" — answer with what you do know naturally, then plainly acknowledge the gap. That information isn't something reaching out would reveal either, so an answer like that is already complete — don't push them toward contact.
4. Keep it natural, friendly English, 3-6 sentences, like a curator actually explaining something.
5. Name specific works with 〈 〉 when relevant.
6. For exhibition schedule questions, rely on the [Ongoing]/[Upcoming]/[Past] labels in [Current & Upcoming Exhibitions] and on "Today's date". Never call a finished show upcoming or an unopened one ongoing. "What's on now" means [Ongoing] only; "next show" means the nearest [Upcoming], with dates and venue. If none applies, say so plainly and mention the most recent show.
7. For counts (works, exhibitions), use the exact numbers in [Summary (auto-counted)] — never approximations like "over 40".
8. For "most famous work" / "signature work", lean on the featured works in [Summary] (the ones the artist highlights on the homepage's first screen).`;
}

export function buildPrompt(question: string, knowledge: string, historyText: string, lang: "ko" | "en", today: string = kstToday()): string {
  const persona = personaPrelude(lang);
  const refBlock = lang === "ko"
    ? `\n[참고 자료 시작]\n${knowledge}\n[참고 자료 끝]\n\n아래 JSON 형식으로만 응답하세요: {"answer": "...", "sufficient": true 또는 false, "suggestions": ["...", "...", "..."]}\n"sufficient"는 방문자의 질문에 실질적으로 도움이 되는 답을 줄 수 있었는지를 뜻합니다. 관련 있는 내용으로 답했다면 일부 세부사항(정확한 날짜, 순서 등)까지는 몰라도 true로 표시하세요. 가격·구매·커미션 등 비즈니스 질문에 자연스럽게 직접 문의를 안내했다면 그것도 true로 표시하세요 (그 자체가 올바른 답입니다). 정확한 생년월일·출신지 등 작가가 공개하지 않는 사적인 정보에 대해 자연스럽게 답했을 때도 true로 표시하세요 (연락처로 문의해도 알 수 없는 정보라 문의 안내가 도움이 되지 않습니다). 참고 자료에 질문과 관련된 내용이 전혀 없어 거의 답을 하지 못했을 때만 false로 표시하세요.\n"suggestions"에는 방문자가 이어서 물어볼 만한 구체적이고 의미 있는 질문을 정확히 3개 담으세요. 반드시 위 [참고 자료]만으로 충분히 답할 수 있는 내용이어야 하고, 이번 답변에서 이미 다룬 내용을 그대로 반복하지 마세요. "더 알려주세요" 같은 막연하고 겉핥기식인 질문은 피하고, 참고 자료에 실제로 등장하는 특정 작품명·시리즈·전시·재료나 기법처럼 구체적인 내용을 짚는 질문으로 만드세요.`
    : `\n[Reference start]\n${knowledge}\n[Reference end]\n\nRespond ONLY in this JSON shape: {"answer": "...", "sufficient": true or false, "suggestions": ["...", "...", "..."]}\n"sufficient" means whether you were able to give a substantively useful answer. Mark it true if you answered with genuinely relevant information, even if some minor details (exact dates, precise order, etc.) remain uncertain. Also mark it true when you naturally pointed a business question (price, purchase, commission) toward direct contact — that redirect IS the correct answer, not a failure. Also mark it true when you naturally answered around private details the artist doesn't publish (exact birth year, hometown, etc.) — reaching out wouldn't reveal that either, so a contact prompt wouldn't help. Only mark it false when the reference had nothing relevant at all, so you could barely answer the question.\n"suggestions" should contain exactly 3 specific, meaningful follow-up questions the visitor could naturally ask next — ones the [Reference] above can genuinely answer well. Don't repeat what this answer already covered, and avoid vague, surface-level prompts like "tell me more" — point to specific works, series, exhibitions, materials, or techniques that actually appear in the reference.`;
  const questionLine = lang === "ko" ? `방문자의 새 질문: ${question}` : `New question: ${question}`;
  // After the (large, stable) reference block, so a date that changes daily doesn't disturb the prefix.
  const todayLine = lang === "ko" ? `\n오늘 날짜: ${today} (한국 시간)\n` : `\nToday's date: ${today} (Korea time)\n`;
  return `${persona}${refBlock}${todayLine}${historyText}\n${questionLine}`;
}

export function insufficientContactNote(contacts: CuratorContact[], lang: "ko" | "en"): string {
  const ig = contacts.find((c) => c.type === "instagram");
  const blog = contacts.find((c) => c.type === "blog");
  const parts = [ig ? `${lang === "ko" ? "인스타그램" : "Instagram"}(${ig.display})` : null, blog && lang === "ko" ? "네이버 블로그" : blog ? "the blog" : null].filter(Boolean);
  if (!parts.length) return "";
  const where = parts.join(lang === "ko" ? "이나 " : " or ");
  return lang === "ko"
    ? `\n\n(자료만으로는 정확히 답변드리기 어려운 부분이 있어요. 더 자세하거나 개인적인 문의는 ${where}로 직접 연락해주시면 좋을 것 같아요.)`
    : `\n\n(I can't give a fully precise answer from what I have on hand. For anything more specific, feel free to reach out via ${where}.)`;
}

export type CuratorOutput = { answer: string; sufficient: boolean; suggestions: string[] };

/* Parses the model's reply. Returns null for anything that isn't a complete, usable
   answer — most importantly JSON cut off mid-way (finishReason MAX_TOKENS, e.g. when
   "thinking" tokens ate the output budget). The caller must retry or fail on null;
   showing the raw text would put half a JSON blob in front of a visitor. */
export function parseCuratorOutput(text: string): CuratorOutput | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!t) return null;
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t);
      const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
      if (!answer) return null;
      return {
        answer,
        sufficient: parsed?.sufficient !== false,
        suggestions: Array.isArray(parsed?.suggestions)
          ? parsed.suggestions.filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 3)
          : [],
      };
    } catch {
      return null;
    }
  }
  // Prose with no JSON at all: use it as the answer, with no suggestions.
  return { answer: t, sufficient: true, suggestions: [] };
}
