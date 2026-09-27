import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { createSessionToken, verifySessionToken, timingSafeEqual } from "./auth.tsx";

const app = new Hono();
const PREFIX = "/make-server-9c6a1cce";

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Edit-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Health check endpoint
app.get(`${PREFIX}/health`, (c) => {
  return c.json({ status: "ok" });
});

/* ── login: verify password server-side, issue a signed session token ──
   Best-effort in-memory brute-force throttle. Resets on cold start, which is
   an acceptable tradeoff for a single-editor portfolio site (not a public API). */
const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

app.post(`${PREFIX}/auth/login`, async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  if (attempt && now - attempt.windowStart < LOGIN_WINDOW_MS && attempt.count >= LOGIN_MAX_ATTEMPTS) {
    return c.json({ error: "너무 많은 시도입니다. 잠시 후 다시 시도하세요." }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const password = body?.password;

  const expectedPassword = Deno.env.get("EDIT_PASSWORD");
  const sessionSecret = Deno.env.get("SESSION_SECRET");
  if (!expectedPassword || !sessionSecret) {
    console.error("[auth] EDIT_PASSWORD or SESSION_SECRET env var not set");
    return c.json({ error: "서버 설정 오류" }, 500);
  }

  if (typeof password !== "string" || !timingSafeEqual(password, expectedPassword)) {
    loginAttempts.set(ip, attempt && now - attempt.windowStart < LOGIN_WINDOW_MS
      ? { count: attempt.count + 1, windowStart: attempt.windowStart }
      : { count: 1, windowStart: now });
    return c.json({ error: "비밀번호가 올바르지 않습니다" }, 401);
  }

  loginAttempts.delete(ip);
  const token = await createSessionToken(sessionSecret);
  return c.json({ token });
});

// Our own editor-session token travels in X-Edit-Token, not Authorization — that
// header is reserved for the Supabase gateway's own JWT check (the anon key).
async function requireAuth(c: any, next: any) {
  const token = c.req.header("X-Edit-Token") ?? "";
  const sessionSecret = Deno.env.get("SESSION_SECRET");
  if (!sessionSecret || !(await verifySessionToken(sessionSecret, token))) {
    return c.json({ error: "인증이 필요합니다" }, 401);
  }
  await next();
}

/* ── save: authenticated write, with optimistic-concurrency conflict check ── */
app.post(`${PREFIX}/portfolio/save`, requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.patch || typeof body.patch !== "object") {
    return c.json({ error: "잘못된 요청" }, 400);
  }
  const { patch, expectedUpdatedAt } = body as { patch: Record<string, unknown>; expectedUpdatedAt?: string };

  const { data: current, error: readErr } = await supabaseAdmin
    .from("portfolio_state").select("*").eq("id", 1).maybeSingle();
  if (readErr) return c.json({ error: readErr.message }, 500);

  // Another tab/device saved a newer version since this client last loaded — refuse
  // to overwrite it. Client should merge `latest` into its state and let the user retry.
  if (expectedUpdatedAt && current?.updated_at && current.updated_at !== expectedUpdatedAt) {
    return c.json({ conflict: true, latest: current }, 409);
  }

  const rawImageUrls = patch.image_urls as Record<string, string> | undefined;
  const safeImageUrls = rawImageUrls
    ? Object.fromEntries(Object.entries(rawImageUrls).filter(([, v]) => typeof v === "string" && v.startsWith("http")))
    : undefined;
  const mergedImageUrls = safeImageUrls
    ? { ...(current?.image_urls as Record<string, string> ?? {}), ...safeImageUrls }
    : current?.image_urls ?? {};

  const { data: saved, error } = await supabaseAdmin
    .from("portfolio_state")
    .upsert({ ...patch, image_urls: mergedImageUrls, id: 1, updated_at: new Date().toISOString() })
    .select()
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: saved });
});

/* ── upload: authenticated image upload, server performs the storage write ── */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Turns e.g. "Floating Memory I" into "floating-memory-i" for descriptive,
// search-friendly filenames instead of a bare timestamp.
function slugify(text: string): string {
  const stripped = text.normalize("NFKD").replace(/\p{Diacritic}/gu, "");
  const slug = stripped.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || "image";
}

app.post(`${PREFIX}/portfolio/upload`, requireAuth, async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  const key = form?.get("key");
  const label = form?.get("label");
  if (!(file instanceof File) || typeof key !== "string" || !key) {
    return c.json({ error: "잘못된 요청" }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "파일이 너무 큽니다 (최대 10MB)" }, 413);
  }

  const namePart = typeof label === "string" && label.trim() ? `${slugify(label)}-${Date.now()}` : `${Date.now()}`;
  const path = `${key}/${namePart}.webp`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from("portfolio")
    .upload(path, bytes, { upsert: true, contentType: file.type || "image/webp" });
  if (error) return c.json({ error: error.message }, 500);

  const { data } = supabaseAdmin.storage.from("portfolio").getPublicUrl(path);
  return c.json({ url: data.publicUrl });
});

/* ── translate: authenticated batch KO→EN translation via Gemini ──
   One request for the whole batch (Gemini, unlike MyMemory, has no per-string limit
   that forces per-field calls), asked to respond as JSON directly. */
const MAX_TRANSLATE_ITEMS = 200;
const MAX_TRANSLATE_CHARS = 20000;
// Use the "-latest" alias, not a pinned version — Google periodically retires
// versioned model names (e.g. gemini-2.5-flash) for new API keys/projects,
// which broke this exact endpoint with a 404 once already.
const GEMINI_MODEL = "gemini-flash-latest";

app.post(`${PREFIX}/portfolio/translate`, requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const texts = body?.texts;
  if (!Array.isArray(texts) || texts.some((t) => typeof t !== "string")) {
    return c.json({ error: "잘못된 요청" }, 400);
  }
  if (texts.length === 0) return c.json({ translations: [] });
  if (texts.length > MAX_TRANSLATE_ITEMS) {
    return c.json({ error: "한 번에 번역할 수 있는 항목 수를 초과했습니다" }, 400);
  }
  if (texts.reduce((n: number, t: string) => n + t.length, 0) > MAX_TRANSLATE_CHARS) {
    return c.json({ error: "번역할 텍스트가 너무 깁니다" }, 400);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[translate] GEMINI_API_KEY env var not set");
    return c.json({ error: "번역 기능이 설정되지 않았습니다" }, 500);
  }

  // Blank fields (e.g. an unused optional description) have nothing to translate —
  // asking Gemini to "translate" an empty string made it improvise a conversational
  // filler like "Here is the English translation for your latest text." instead of
  // just returning "", which then got saved as the actual field value across the
  // site. Skip them entirely and splice "" back in at their original positions.
  const nonEmptyIndices: number[] = [];
  const nonEmptyTexts: string[] = [];
  texts.forEach((t: string, i: number) => {
    if (t.trim()) {
      nonEmptyIndices.push(i);
      nonEmptyTexts.push(t);
    }
  });
  if (nonEmptyTexts.length === 0) {
    return c.json({ translations: texts.map(() => "") });
  }

  // Long, emotionally-toned artist-statement paragraphs were previously slipping a
  // chatty self-description ("I have maintained the reflective tone to...") in as
  // the first sentence of the actual translation, even though the prompt already
  // said not to — a single line of "no commentary" at the very end of a long batch
  // wasn't enough weight against the model's learned habit of prefacing literary
  // output with a note about its own approach. Short catalog fields never did this;
  // only the long, "make this sound artistic" paragraphs did. Naming the exact
  // pattern to avoid, and repeating the constraint near the actual instruction
  // instead of only at the end, is what actually suppresses it.
  const numbered = nonEmptyTexts.map((t, i) => `${i}: ${JSON.stringify(t)}`).join("\n");
  const prompt = `다음은 한국 현대미술 작가의 포트폴리오 웹사이트에 들어가는 한국어 문장들입니다. 각 문장을 자연스러운 영어로 번역하세요. 예술적/문학적 어조를 살리고, 줄바꿈(\\n)은 그대로 유지하세요.

중요: 번역문 앞이나 뒤에 절대 아무 설명도 붙이지 마세요. 예를 들어 "I have maintained the reflective tone to...", "I kept the artistic tone to convey..." 같이 스스로의 번역 방식을 설명하는 문장을 지어내지 마세요. 오직 원문을 번역한 결과 문장 자체만 출력하세요 — 번역기이지 안내자가 아닙니다.

각 줄은 "인덱스: JSON 문자열" 형식입니다:
${numbered}

아래 JSON 형식으로만 응답하세요:
{"translations": ["...", "...", ...]}
번역 배열의 길이와 순서는 입력과 정확히 같아야 합니다 (총 ${nonEmptyTexts.length}개). 다른 설명이나 안내 문구 없이 번역문만 담으세요.`;

  // Gemini's free/low-tier quota returns 429 (rate limited) and occasional 503
  // (model overloaded) under completely normal use — both are transient, not
  // real failures, and used to surface as an immediate "번역 요청이 실패했습니다"
  // with no retry at all, matching reports of it failing repeatedly then
  // randomly succeeding. Retry those a couple of times with backoff before
  // giving up; any other status is a real error and fails immediately.
  const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 3;

  try {
    let res: Response | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      if (res.ok) break;
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      console.error(`[translate] Gemini API error (attempt ${attempt}/${MAX_ATTEMPTS}):`, res.status, await res.text().catch(() => ""));
      if (isLastAttempt || !RETRYABLE_STATUS.has(res.status)) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
    if (!res!.ok) {
      return c.json({ error: "번역 요청이 실패했습니다" }, 502);
    }
    const data = await res.json();
    const textOut: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(textOut);
    const nonEmptyTranslations = parsed?.translations;
    if (!Array.isArray(nonEmptyTranslations) || nonEmptyTranslations.length !== nonEmptyTexts.length) {
      console.error("[translate] unexpected translation response shape:", textOut);
      return c.json({ error: "번역 응답 형식이 올바르지 않습니다" }, 502);
    }
    const translations = texts.map(() => "");
    nonEmptyIndices.forEach((origIdx, i) => { translations[origIdx] = nonEmptyTranslations[i]; });
    return c.json({ translations });
  } catch (err) {
    console.error("[translate] error:", err);
    return c.json({ error: "번역 중 오류가 발생했습니다" }, 500);
  }
});

/* ── unfurl: authenticated link-preview extraction (og:title/og:image/og:site_name) ──
   Lets the editor paste a press-article URL and auto-fill outlet/title/thumbnail
   instead of manually screenshotting and uploading a logo for every article. */
function extractMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");
}

const UNFURL_MAX_BYTES = 300_000;
const UNFURL_TIMEOUT_MS = 8000;

app.post(`${PREFIX}/portfolio/unfurl`, requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const url = body?.url;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return c.json({ error: "올바른 URL이 아닙니다" }, 400);
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch { return c.json({ error: "올바른 URL이 아닙니다" }, 400); }
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(parsed.hostname) || parsed.hostname.endsWith(".local")) {
    return c.json({ error: "허용되지 않는 주소입니다" }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UNFURL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JeonYeonmiBot/1.0; +https://jeonyeonmi.vercel.app)" },
    });
    if (!res.ok) return c.json({ error: `페이지를 가져올 수 없습니다 (${res.status})` }, 502);

    let html = "";
    const reader = res.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let received = 0;
      while (received < UNFURL_MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        received += value.byteLength;
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }

    const rawTitle = extractMeta(html, "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    const rawImage = extractMeta(html, "og:image") ?? "";
    const rawSite = extractMeta(html, "og:site_name") ?? parsed.hostname.replace(/^www\./, "");

    return c.json({
      title: decodeHtmlEntities(rawTitle).trim(),
      image: rawImage ? new URL(rawImage, url).toString() : "",
      siteName: decodeHtmlEntities(rawSite).trim(),
    });
  } catch (err) {
    console.error("[unfurl] error:", err);
    return c.json({ error: "미리보기를 가져오지 못했습니다" }, 500);
  } finally {
    clearTimeout(timeout);
  }
});

/* ── curator: public AI Q&A widget ──
   Answers visitor questions about the artist/work using the live portfolio_state
   row as the only source of truth (no separate copy to keep in sync), speaking as
   "호이" (the artist's husband/manager) rather than the artist herself or a neutral
   docent. Logs every exchange to curator_logs (service role bypasses RLS; anon can
   only SELECT it) so a separate weekly job can report the most common questions and
   flag the ones Gemini itself judged the knowledge base didn't cover. */
type PortfolioRowForCurator = {
  content?: Record<string, string>;
  slides?: { heading: string; headingEn?: string; body: string; bodyEn?: string }[];
  artworks?: { title: string; titleEn?: string; year: string; medium: string; mediumEn?: string; size: string; category: string; categoryEn?: string; series?: string; collected?: boolean; description?: string; descriptionEn?: string }[];
  current_exhibitions?: { title: string; titleEn?: string; venue: string; venueEn?: string; location: string; locationEn?: string; startDate: string; endDate: string; tag: string; visible?: boolean }[];
  exhibitions?: { year: string; title: string; titleEn?: string; venue: string; venueEn?: string; location: string; locationEn?: string; tag: string; award?: string; awardEn?: string }[];
  press?: { date: string; outlet: string; outletEn?: string; title: string; titleEn?: string }[];
  contacts?: { type: string; labelKo: string; labelEn: string; display: string; visible: boolean }[];
};

function buildCuratorKnowledge(row: PortfolioRowForCurator, lang: "ko" | "en"): string {
  const isKo = lang === "ko";
  const t = (ko?: string, en?: string) => (isKo ? ko : en || ko) ?? "";
  const lines: string[] = [];

  lines.push(`${t("작가명", "Artist")}: ${t(row.content?.heroName, row.content?.heroNameEn) || "전연미 (Jeon Yeon-mi)"}`);
  const desc = t(row.content?.heroDesc, row.content?.heroDescEn);
  if (desc) lines.push(`${t("소개", "Description")}: ${desc}`);

  if (row.slides?.length) {
    lines.push(`\n## ${t("작가노트", "Artist Statement")}`);
    for (const s of row.slides) {
      const heading = t(s.heading, s.headingEn).replace(/\n/g, " ");
      const body = t(s.body, s.bodyEn);
      if (heading || body) lines.push(`### ${heading}\n${body}`);
    }
  }

  if (row.artworks?.length) {
    lines.push(`\n## ${t("작품 목록", "Selected Works")}`);
    for (const a of row.artworks) {
      const title = t(a.title, a.titleEn);
      const medium = t(a.medium, a.mediumEn);
      const category = t(a.category, a.categoryEn);
      const collected = a.collected ? ` · ${t("컬렉션", "Collected")}` : "";
      const d = t(a.description, a.descriptionEn);
      lines.push(`- ${title} (${a.year}) · ${medium} · ${a.size} · ${category}${collected}${d ? `\n  ${d}` : ""}`);
    }
  }

  if (row.current_exhibitions?.filter((e) => e.visible !== false).length) {
    lines.push(`\n## ${t("현재·예정 전시", "Current & Upcoming Exhibitions")}`);
    for (const e of row.current_exhibitions.filter((e) => e.visible !== false)) {
      lines.push(`- ${e.startDate}–${e.endDate} ${t(e.title, e.titleEn)} — ${t(e.venue, e.venueEn)}, ${t(e.location, e.locationEn)} [${e.tag}]`);
    }
  }

  if (row.exhibitions?.length) {
    lines.push(`\n## ${t("전시 및 수상 이력", "Exhibition & Award History")}`);
    for (const e of row.exhibitions) {
      const award = t(e.award, e.awardEn);
      lines.push(`- ${e.year} ${t(e.title, e.titleEn)} — ${t(e.venue, e.venueEn)}, ${t(e.location, e.locationEn)} [${e.tag}]${award ? ` — ${award}` : ""}`);
    }
  }

  if (row.press?.length) {
    lines.push(`\n## ${t("언론 보도", "Press")}`);
    for (const p of row.press) lines.push(`- ${p.date} ${t(p.outlet, p.outletEn)} — ${t(p.title, p.titleEn)}`);
  }

  const visibleContacts = row.contacts?.filter((c) => c.visible) ?? [];
  if (visibleContacts.length) {
    lines.push(`\n## ${t("연락처", "Contact")}`);
    for (const ct of visibleContacts) lines.push(`- ${isKo ? ct.labelKo : ct.labelEn}: ${ct.display}`);
  }

  return lines.join("\n");
}

const curatorPersonaKo = (knowledge: string) => `당신은 전연미 작가의 남편이자 매니저인 '호이'입니다. 방문자에게 아내인 전연미 작가와 그 작품 세계 전반을 소개하는 역할을 합니다. "저는", "저희 집사람은", "제가 보기엔" 같은 1인칭으로, 아내의 작업을 옆에서 지켜본 사람의 다정하고 자연스러운 어투로 답하세요.

답변 원칙:
1. 아래 [참고 자료]에 있는 내용에만 근거해 답하세요. 자료에 없는 내용(가격, 판매처, 정확한 생년월일, 출신지 등 사적인 정보)은 지어내지 말고, "그 부분은 제가 정확히 알려드리기는 어렵네요"처럼 솔직하게 답하세요.
2. 친절하고 자연스러운 한국어 존댓말을 쓰되, 너무 딱딱한 보도자료 톤은 피하고 실제 대화하듯 답하세요.
3. 답변은 3~6문장 정도로, 너무 길지 않게 핵심만 전달하세요.
4. 관련된 작품이 있으면 작품명을 〈 〉로 표기해 언급하세요.

[참고 자료 시작]
${knowledge}
[참고 자료 끝]

아래 JSON 형식으로만 응답하세요: {"answer": "...", "sufficient": true 또는 false}
"sufficient"는 위 참고 자료만으로 충분히 답할 수 있었는지를 뜻합니다 (자료에 없어서 추측하거나 모른다고 답했다면 false).`;

const curatorPersonaEn = (knowledge: string) => `You are 'Hoi', the husband and manager of the artist Jeon Yeon-mi. You introduce the artist and her work to visitors, speaking in first person ("I", "my wife") the way someone close to her would — warm and natural, not like a press release.

Rules:
1. Answer only from the [Reference] below. Never invent facts not in it (price, buyers, exact birth year, hometown, etc.) — say honestly you can't say for sure.
2. Keep it natural, friendly English, 3-6 sentences.
3. Name specific works with 〈 〉 when relevant.

[Reference start]
${knowledge}
[Reference end]

Respond ONLY in this JSON shape: {"answer": "...", "sufficient": true or false}
"sufficient" means whether the reference above was enough to answer properly (false if you had to say you don't know or guess).`;

const curatorAttempts = new Map<string, { count: number; windowStart: number }>();
const CURATOR_WINDOW_MS = 10 * 60 * 1000;
const CURATOR_MAX_PER_WINDOW = 12;
let curatorDayCount = 0;
let curatorDayStart = Date.now();
const CURATOR_DAY_MAX = 500;

app.post(`${PREFIX}/curator/ask`, async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  if (now - curatorDayStart > 24 * 60 * 60 * 1000) { curatorDayStart = now; curatorDayCount = 0; }
  if (curatorDayCount >= CURATOR_DAY_MAX) {
    return c.json({ error: "오늘 사용량이 많아 잠시 후 다시 시도해주세요.", code: "day_limit" }, 429);
  }
  const attempt = curatorAttempts.get(ip);
  if (attempt && now - attempt.windowStart < CURATOR_WINDOW_MS && attempt.count >= CURATOR_MAX_PER_WINDOW) {
    return c.json({ error: "잠시 요청이 많았어요. 몇 분 후 다시 시도해주세요.", code: "rate_limited" }, 429);
  }
  curatorAttempts.set(ip, attempt && now - attempt.windowStart < CURATOR_WINDOW_MS
    ? { count: attempt.count + 1, windowStart: attempt.windowStart }
    : { count: 1, windowStart: now });

  const body = await c.req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const lang: "ko" | "en" = body?.lang === "en" ? "en" : "ko";
  const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];
  if (!question || question.length > 500) {
    return c.json({ error: "잘못된 요청" }, 400);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[curator] GEMINI_API_KEY env var not set");
    return c.json({ error: "안내 기능이 아직 설정되지 않았어요" }, 500);
  }

  const { data: row, error: readErr } = await supabaseAdmin
    .from("portfolio_state").select("*").eq("id", 1).maybeSingle();
  if (readErr) return c.json({ error: readErr.message }, 500);

  const knowledge = buildCuratorKnowledge((row ?? {}) as PortfolioRowForCurator, lang);
  const persona = lang === "ko" ? curatorPersonaKo(knowledge) : curatorPersonaEn(knowledge);
  const historyText = history.length
    ? "\n" + (lang === "ko" ? "이전 대화:\n" : "Previous turns:\n") +
      history.map((t: { role: string; text: string }) =>
        `${t.role === "user" ? (lang === "ko" ? "방문자" : "Visitor") : "Hoi"}: ${String(t.text).slice(0, 500)}`
      ).join("\n") + "\n"
    : "";
  const prompt = `${persona}${historyText}\n${lang === "ko" ? "방문자의 새 질문" : "New question"}: ${question}`;

  curatorDayCount++;
  const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS = 2;
  try {
    let res: Response | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      if (res.ok) break;
      if (attempt === MAX_ATTEMPTS || !RETRYABLE_STATUS.has(res.status)) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
    if (!res!.ok) {
      console.error("[curator] Gemini API error:", res!.status, await res!.text().catch(() => ""));
      return c.json({ error: "답변을 만드는 중 문제가 생겼어요" }, 502);
    }
    const data = await res!.json();
    const textOut: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let answer = "";
    let sufficient = true;
    try {
      const parsed = JSON.parse(textOut);
      answer = typeof parsed?.answer === "string" ? parsed.answer : "";
      sufficient = parsed?.sufficient !== false;
    } catch {
      answer = textOut;
    }
    if (!answer) return c.json({ error: "답변을 만드는 중 문제가 생겼어요" }, 502);

    supabaseAdmin.from("curator_logs").insert({ lang, question, answer, sufficient }).then(
      ({ error }) => { if (error) console.error("[curator] log insert error:", error.message); }
    );

    return c.json({ answer });
  } catch (err) {
    console.error("[curator] error:", err);
    return c.json({ error: "답변을 만드는 중 문제가 생겼어요" }, 500);
  }
});

Deno.serve(app.fetch);
