import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { createSessionToken, verifySessionToken, timingSafeEqual } from "./auth.tsx";
import { isSafeHref, clientIp, sha256Hex, assertPublicHttpUrl } from "./safety.ts";
import { buildSections, selectKnowledge, buildPrompt, getVisibleContacts, insufficientContactNote, parseCuratorOutput, type CuratorOutput, type PortfolioRowForCurator } from "./curator-prompt.ts";

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
  const ip = clientIp(c.req.raw.headers);
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
const SAVEABLE_COLUMNS = [
  "content", "current_exhibitions", "artworks", "series_list", "slides", "exhibitions",
  "activity_photos", "videos", "contacts", "press", "settings", "image_urls",
] as const;

// [column, link field] pairs whose values become hrefs/iframes on the public site.
const LINK_FIELDS: [string, string][] = [
  ["press", "url"], ["current_exhibitions", "url"], ["current_exhibitions", "mapUrl"],
  ["contacts", "href"], ["videos", "youtubeUrl"],
];

function findUnsafeLink(patch: Record<string, unknown>): string | null {
  for (const [col, field] of LINK_FIELDS) {
    const rows = patch[col];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const v = (row as Record<string, unknown> | null)?.[field];
      if (!isSafeHref(v)) return `${col}.${field}`;
    }
  }
  return null;
}
app.post(`${PREFIX}/portfolio/save`, requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.patch || typeof body.patch !== "object") {
    return c.json({ error: "잘못된 요청" }, 400);
  }
  const { patch: rawPatch, expectedUpdatedAt } = body as { patch: Record<string, unknown>; expectedUpdatedAt?: string };

  // Only the known content columns may be written — never id/updated_at or anything
  // added to the table later — and every editor-entered link must be a web/mail/tel
  // URL, since these render as hrefs on the public site.
  const patch: Record<string, unknown> = {};
  for (const col of SAVEABLE_COLUMNS) if (col in rawPatch) patch[col] = rawPatch[col];
  const badLink = findUnsafeLink(patch);
  if (badLink) return c.json({ error: `허용되지 않는 링크입니다: ${badLink}` }, 400);

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
  // Keys are things like "artwork-12", "activity-3-2-thumb", "hero" — nothing that
  // could add path segments or escape the intended folder.
  if (!(file instanceof File) || typeof key !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(key)) {
    return c.json({ error: "잘못된 요청" }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "파일이 너무 큽니다 (최대 10MB)" }, 413);
  }

  const namePart = typeof label === "string" && label.trim() ? `${slugify(label)}-${Date.now()}` : `${Date.now()}`;
  const path = `${key}/${namePart}.webp`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  // The client always converts to WebP before uploading; check the real bytes
  // (RIFF....WEBP) instead of trusting the declared type, and store as image/webp,
  // so this bucket can't be used to host HTML/SVG/anything else.
  const isWebp = bytes.length > 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!isWebp) return c.json({ error: "WebP 이미지만 업로드할 수 있습니다" }, 415);
  const { error } = await supabaseAdmin.storage
    .from("portfolio")
    .upload(path, bytes, { upsert: false, contentType: "image/webp" });
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

const UNFURL_MAX_REDIRECTS = 3;

app.post(`${PREFIX}/portfolio/unfurl`, requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const url = body?.url;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return c.json({ error: "올바른 URL이 아닙니다" }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UNFURL_TIMEOUT_MS);
  try {
    // Follow redirects by hand so every hop is re-checked against the private-address
    // rules — "redirect: follow" would let a public URL bounce the fetch to an internal one.
    let current = await assertPublicHttpUrl(url);
    let res: Response | null = null;
    for (let hop = 0; hop <= UNFURL_MAX_REDIRECTS; hop++) {
      res = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JeonYeonmiBot/1.0; +https://jeonyeonmi.vercel.app)" },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = await assertPublicHttpUrl(new URL(location, current).toString());
        res = null;
        continue;
      }
      break;
    }
    if (!res) return c.json({ error: "리다이렉트가 너무 많습니다" }, 502);
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
    const rawSite = extractMeta(html, "og:site_name") ?? current.hostname.replace(/^www\./, "");

    // The image URL is only ever displayed/stored, never fetched here — but still
    // limit it to web URLs so a data:/javascript: value can't ride along into the row.
    let image = "";
    if (rawImage) {
      try {
        const resolved = new URL(decodeHtmlEntities(rawImage), current);
        if (resolved.protocol === "http:" || resolved.protocol === "https:") image = resolved.toString();
      } catch { /* ignore an unparseable og:image */ }
    }

    return c.json({
      title: decodeHtmlEntities(rawTitle).trim(),
      image,
      siteName: decodeHtmlEntities(rawSite).trim(),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "";
    if (["invalid_url", "invalid_scheme", "credentials_in_url", "port_not_allowed", "host_not_allowed"].includes(reason)) {
      return c.json({ error: "허용되지 않는 주소입니다" }, 400);
    }
    console.error("[unfurl] error:", err);
    return c.json({ error: "미리보기를 가져오지 못했습니다" }, 500);
  } finally {
    clearTimeout(timeout);
  }
});

/* ── curator: public AI Q&A widget ──
   Answers visitor questions about the artist/work using the live portfolio_state
   row as the only source of truth (no separate copy to keep in sync), speaking as
   "호이" (the artist's manager) rather than the artist herself. Logs every exchange
   to curator_logs (service role bypasses RLS; anon has no access — see supabase/curator_security.sql) so a
   separate weekly job can report the most common questions and flag the ones
   Gemini itself judged the knowledge base didn't cover. Persona/knowledge assembly
   lives in ./curator-prompt.ts — this route is just request handling. */
const curatorAttempts = new Map<string, { count: number; windowStart: number }>();
const CURATOR_WINDOW_MS = 10 * 60 * 1000;
const CURATOR_MAX_PER_WINDOW = 12;
let curatorDayCount = 0;
let curatorDayStart = Date.now();
const CURATOR_DAY_MAX = 500;

/* Visitors are actively waiting on this one (unlike the editor-only translate
   batch job), and Gemini's shared "-latest" pool turned out to 503 ("high
   demand") often enough in practice that two quick retries against a single
   model weren't enough to hide it. Retries within a model, then falls
   through to the next model in the list on repeated failure — a pinned
   model's quota pool is independent of the "-latest" alias's, so this
   survives that alias having a bad afternoon without waiting for Google to
   fix it. gemini-flash-latest stays first for response quality/consistency
   with the translate endpoint; the pinned models behind it are simply
   whatever's still standing when it isn't. */
// gemini-2.5-flash / gemini-2.5-flash-lite were retired for new callers
// (404 "no longer available to new users") not long after this list was
// written — exactly the versioned-model-churn risk called out for the
// translate endpoint's own model choice. Google's own 404 body named their
// replacements. gemini-3.8-flash is deliberately left out here even though
// it was the named replacement: live 429 quota errors showed its
// quotaDimensions.model is "gemini-3.8-flash" even when we called it via
// the "gemini-flash-latest" alias — same free-tier daily quota pool, so
// listing both just burns two failed attempts on one exhausted quota
// before ever reaching the one model below that's actually independent.
const CURATOR_MODELS = ["gemini-flash-latest", "gemini-3.5-flash-lite"];
const CURATOR_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const CURATOR_ATTEMPTS_PER_MODEL = 2;
const CURATOR_CALL_TIMEOUT_MS = 20_000;

// "Thinking" tokens count against maxOutputTokens, and they vary a lot per question (0 to
// ~1000 observed). A 1024 cap once truncated a visible answer mid-JSON; 4096 leaves room for
// the largest thinking spikes plus the answer, while still bounding a worst-case call.
const CURATOR_MAX_OUTPUT_TOKENS = 4096;
// The docent answers from a short, fully-supplied reference, so extended reasoning adds
// cost and latency, not quality. Measured through /curator/lab on questions that had
// drawn 400-900 thinking tokens by default: "low" gave 0 thinking tokens, ~2.5s instead of
// ~5.5s per answer, identical answer quality, 100% parseable. (thinkingLevel "minimal" is
// rejected by these models.) If a future model rejects the setting, the call retries
// without it — see callGeminiWithFallback.
const CURATOR_THINKING_CONFIG = { thinkingLevel: "low" };

type GeminiResult = { data: Record<string, any>; model: string; parsed: CuratorOutput };

async function callGeminiWithFallback(prompt: string, apiKey: string): Promise<GeminiResult | null> {
  let thinkingConfigAccepted = true;
  for (const model of CURATOR_MODELS) {
    for (let attempt = 1; attempt <= CURATOR_ATTEMPTS_PER_MODEL; attempt++) {
      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: CURATOR_MAX_OUTPUT_TOKENS,
                ...(thinkingConfigAccepted ? { thinkingConfig: CURATOR_THINKING_CONFIG } : {}),
              },
            }),
            // A hung upstream call would otherwise hold the instance until the platform kills it.
            signal: AbortSignal.timeout(CURATOR_CALL_TIMEOUT_MS),
          }
        );
      } catch (err) {
        console.error(`[curator] Gemini fetch threw (model=${model}, attempt=${attempt}):`, err);
        continue;
      }
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const candidate = data?.candidates?.[0];
        const parsed = candidate?.finishReason === "MAX_TOKENS" ? null : parseCuratorOutput(candidate?.content?.parts?.[0]?.text ?? "");
        if (data && parsed) return { data, model, parsed };
        // Truncated or unusable output: never pass it on — try again (then the next model).
        console.error(`[curator] unusable Gemini output (model=${model}, attempt=${attempt}): finishReason=${candidate?.finishReason} usage=${JSON.stringify(data?.usageMetadata ?? {})}`);
        continue;
      }
      const errorBody = await res.text().catch(() => "");
      console.error(`[curator] Gemini API error (model=${model}, attempt=${attempt}):`, res.status, errorBody);
      if (res.status === 400 && thinkingConfigAccepted && /thinking/i.test(errorBody)) {
        // A newer model behind the "-latest" alias may not take this setting — drop it and redo this attempt.
        thinkingConfigAccepted = false;
        attempt--;
        continue;
      }
      if (!CURATOR_RETRYABLE_STATUS.has(res.status)) break; // not transient — move to the next model, not worth retrying this one
      if (attempt < CURATOR_ATTEMPTS_PER_MODEL) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }
  return null;
}

/* Rate limits live in Postgres (curator_usage + curator_hit RPC) rather than in
   function memory: serverless instances come and go and each keeps its own Map, so
   in-memory counters reset on every cold start and don't add up across instances.
   If the table/RPC isn't there (or errors), fall back to the in-memory counters
   so the widget keeps working instead of failing closed. */
async function bumpCuratorBucket(bucket: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc("curator_hit", { p_bucket: bucket });
  if (error || typeof data !== "number") return null;
  return data;
}

const CURATOR_MAX_PER_IP_PER_DAY = 40;

async function checkCuratorLimits(rawIp: string): Promise<{ body: { error: string; code: string } } | null> {
  const now = Date.now();
  // Raw IPs never reach the database — only a salted hash, bucketed per 10-minute window.
  const ipHash = (await sha256Hex(`${Deno.env.get("SESSION_SECRET") ?? ""}:${rawIp}`)).slice(0, 24);
  const dayBucket = `day:${new Date(now).toISOString().slice(0, 10)}`;
  const ipBucket = `ip:${ipHash}:${Math.floor(now / CURATOR_WINDOW_MS)}`;
  // Per-visitor first, and only count toward the daily total once that passes —
  // otherwise one visitor hammering past their own limit would burn the shared
  // daily budget with requests that were all rejected anyway.
  // A 10-minute window alone still lets one persistent visitor burn the whole daily budget
  // (12 per window x ~42 windows = 500 in about 7 hours), so each visitor also has a daily cap.
  const ipDayBucket = `ipday:${ipHash}:${dayBucket.slice(4)}`;
  const [ipHits, ipDayHits] = await Promise.all([bumpCuratorBucket(ipBucket), bumpCuratorBucket(ipDayBucket)]);
  const ipOk = ipHits !== null && ipDayHits !== null && ipHits <= CURATOR_MAX_PER_WINDOW && ipDayHits <= CURATOR_MAX_PER_IP_PER_DAY;
  const dayHits = ipOk ? await bumpCuratorBucket(dayBucket) : 0;

  const dayLimited = { error: "오늘 사용량이 많아 잠시 후 다시 시도해주세요.", code: "day_limit" };
  const ipLimited = { error: "잠시 요청이 많았어요. 몇 분 후 다시 시도해주세요.", code: "rate_limited" };
  const ipDayLimited = { error: "오늘 질문 가능 횟수를 모두 사용하셨어요. 내일 다시 이용해주세요.", code: "ip_day_limit" };

  if (dayHits !== null && ipHits !== null && ipDayHits !== null) {
    if (ipHits > CURATOR_MAX_PER_WINDOW) return { body: ipLimited };
    if (ipDayHits > CURATOR_MAX_PER_IP_PER_DAY) return { body: ipDayLimited };
    if (dayHits > CURATOR_DAY_MAX) return { body: dayLimited };
    return null;
  }

  console.error("[curator] curator_hit RPC unavailable — using in-memory limits");
  if (now - curatorDayStart > 24 * 60 * 60 * 1000) { curatorDayStart = now; curatorDayCount = 0; }
  if (curatorDayCount >= CURATOR_DAY_MAX) return { body: dayLimited };
  const attempt = curatorAttempts.get(rawIp);
  if (attempt && now - attempt.windowStart < CURATOR_WINDOW_MS && attempt.count >= CURATOR_MAX_PER_WINDOW) {
    return { body: ipLimited };
  }
  curatorAttempts.set(rawIp, attempt && now - attempt.windowStart < CURATOR_WINDOW_MS
    ? { count: attempt.count + 1, windowStart: attempt.windowStart }
    : { count: 1, windowStart: now });
  curatorDayCount++;
  return null;
}

// Housekeeping without a scheduler: now and then, drop old usage counters and
// curator_logs rows past the retention window (visitors' free-text questions
// shouldn't be kept forever).
type CuratorLogRow = {
  lang: string; question: string; answer: string; sufficient: boolean;
  session_id: string | null; page: string | null; work_id: number | null; model: string;
  prompt_tokens: number | null; output_tokens: number | null; thought_tokens: number | null;
  cached_tokens: number | null;
};
// The extra columns come from supabase/curator_analytics.sql; until that has been run, fall
// back to the four original columns instead of losing the log row.
async function insertCuratorLog(row: CuratorLogRow) {
  // Newest column set first, then progressively fewer, so a column that hasn't been
  // added yet only costs that column — not every extra field.
  const { cached_tokens: _cached, ...withoutCached } = row;
  const { lang, question, answer, sufficient } = row;
  const attempts: Record<string, unknown>[] = [row, withoutCached, { lang, question, answer, sufficient }];
  for (const [i, attempt] of attempts.entries()) {
    const { error } = await supabaseAdmin.from("curator_logs").insert(attempt);
    if (!error) return;
    if (!/column|schema cache/i.test(error.message) || i === attempts.length - 1) {
      console.error("[curator] log insert error:", error.message);
      return;
    }
  }
}

const CURATOR_LOG_RETENTION_DAYS = 90;
function maybeCleanupCuratorData() {
  if (Math.random() > 0.02) return;
  const day = 24 * 60 * 60 * 1000;
  supabaseAdmin.from("curator_usage").delete().lt("updated_at", new Date(Date.now() - 3 * day).toISOString()).then(() => {});
  supabaseAdmin.from("curator_logs").delete().lt("created_at", new Date(Date.now() - CURATOR_LOG_RETENTION_DAYS * day).toISOString()).then(() => {});
}

app.post(`${PREFIX}/curator/ask`, async (c) => {
  const body = await c.req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const lang: "ko" | "en" = body?.lang === "en" ? "en" : "ko";
  // Optional analytics context — kept only if it has the expected shape, never trusted further.
  const sessionId = typeof body?.session_id === "string" && /^[\w-]{8,64}$/.test(body.session_id) ? body.session_id : null;
  const page = typeof body?.page === "string" && body.page.startsWith("/") && body.page.length <= 200 ? body.page : null;
  const workMatch = page?.match(/\/works\/[^/]*?(\d+)$/);
  const workId = workMatch ? Number(workMatch[1]) : null;
  // Only well-formed turns get into the prompt — an arbitrary "role" (e.g. a forged
  // "guide" turn) or non-string text from a hand-built request is dropped.
  const history: { role: "user" | "guide"; text: string }[] = (Array.isArray(body?.history) ? body.history : [])
    .filter((t: unknown): t is { role: "user" | "guide"; text: string } => {
      const turn = t as { role?: unknown; text?: unknown } | null;
      return !!turn && (turn.role === "user" || turn.role === "guide") && typeof turn.text === "string";
    })
    .slice(-6);
  // Malformed requests are rejected before touching the counters, so they can't
  // be used to drain the daily budget.
  if (!question || question.length > 500) {
    return c.json({ error: "잘못된 요청" }, 400);
  }

  const limited = await checkCuratorLimits(clientIp(c.req.raw.headers));
  if (limited) return c.json(limited.body, 429);
  maybeCleanupCuratorData();

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[curator] GEMINI_API_KEY env var not set");
    return c.json({ error: "안내 기능이 아직 설정되지 않았어요" }, 500);
  }

  // Only the columns the prompt is built from — image_urls (a URL per uploaded image,
  // growing with the site) is never used here, so don't pull it on every question.
  const { data: row, error: readErr } = await supabaseAdmin
    .from("portfolio_state")
    .select("content,slides,artworks,current_exhibitions,exhibitions,press,contacts,settings")
    .eq("id", 1)
    .maybeSingle();
  if (readErr) {
    console.error("[curator] portfolio read error:", readErr.message);
    return c.json({ error: "답변을 만드는 중 문제가 생겼어요" }, 500);
  }

  // The editor can flip this off from the site itself (edit mode) if the widget
  // ever needs to come down in a hurry — checked here too, not just client-side,
  // so a cached/stale page can't keep calling Gemini after it's been disabled.
  if (row?.settings?.curatorEnabled === "false") {
    return c.json({ error: "현재 안내 기능이 꺼져 있어요", code: "disabled" }, 503);
  }

  const typedRow = (row ?? {}) as PortfolioRowForCurator;
  const sections = buildSections(typedRow, lang);
  const knowledge = selectKnowledge(question, sections);
  const historyText = history.length
    ? "\n" + (lang === "ko" ? "이전 대화:\n" : "Previous turns:\n") +
      history.map((t: { role: string; text: string }) =>
        `${t.role === "user" ? (lang === "ko" ? "방문자" : "Visitor") : "Hoi"}: ${String(t.text).slice(0, 500)}`
      ).join("\n") + "\n"
    : "";
  const prompt = buildPrompt(question, knowledge, historyText, lang);

  try {
    const gemini = await callGeminiWithFallback(prompt, apiKey);
    if (!gemini) {
      return c.json({ error: "답변을 만드는 중 문제가 생겼어요" }, 502);
    }
    const { answer, sufficient, suggestions } = gemini.parsed;
    // Thinking tokens are billed like output, so they're logged separately — that is
    // what makes real per-question spend visible instead of guessed.
    const usage = gemini.data?.usageMetadata ?? {};

    // The "please contact us" line is appended here, in code, only when Gemini
    // itself flagged the reference material as insufficient — not left to the
    // model's own judgment inside the answer text, which was showing up on
    // almost every reply regardless of whether it was actually needed.
    const finalAnswer = sufficient ? answer : answer + insufficientContactNote(getVisibleContacts(typedRow, lang), lang);

    insertCuratorLog({
      lang, question, answer, sufficient,
      session_id: sessionId, page, work_id: workId,
      model: gemini.model,
      prompt_tokens: Number.isInteger(usage.promptTokenCount) ? usage.promptTokenCount : null,
      output_tokens: Number.isInteger(usage.candidatesTokenCount) ? usage.candidatesTokenCount : null,
      thought_tokens: Number.isInteger(usage.thoughtsTokenCount) ? usage.thoughtsTokenCount : null,
      // Part of promptTokenCount that was served from Gemini's (implicit) cache, billed at ~10%.
      cached_tokens: Number.isInteger(usage.cachedContentTokenCount) ? usage.cachedContentTokenCount : null,
    });

    return c.json({ answer: finalAnswer, suggestions });
  } catch (err) {
    console.error("[curator] error:", err);
    return c.json({ error: "답변을 만드는 중 문제가 생겼어요" }, 500);
  }
});

/* ── curator report: read-only log access for the weekly summary job ──
   curator_logs is not readable with the public anon key (visitors' questions are
   private), so the report job authenticates with its own key instead. Grants read
   access to the logs and nothing else. Set with: supabase secrets set CURATOR_REPORT_KEY=... */
app.get(`${PREFIX}/curator/report`, async (c) => {
  const expected = Deno.env.get("CURATOR_REPORT_KEY");
  if (!expected) return c.json({ error: "리포트 키가 설정되지 않았습니다" }, 503);
  if (!timingSafeEqual(c.req.header("X-Report-Key") ?? "", expected)) {
    return c.json({ error: "인증이 필요합니다" }, 401);
  }
  const days = Math.min(90, Math.max(1, Number(c.req.query("days")) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const query = (cols: string) => supabaseAdmin
    .from("curator_logs").select(cols).gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
  let { data, error } = await query("id,created_at,lang,question,answer,sufficient,session_id,page,work_id,model,prompt_tokens,output_tokens,thought_tokens,cached_tokens");
  if (error) ({ data, error } = await query("id,created_at,lang,question,answer,sufficient,session_id,page,work_id,model,prompt_tokens,output_tokens,thought_tokens"));
  if (error) ({ data, error } = await query("id,created_at,lang,question,answer,sufficient")); // analytics columns not added yet
  if (error) return c.json({ error: "로그를 읽지 못했습니다" }, 500);
  return c.json({ days, count: data?.length ?? 0, rows: data ?? [] });
});

// List prices per 1M tokens (USD): gemini-flash-latest currently resolves to Gemini 3.8 Flash
// at its introductory rate (doubles from 2027-01-01); the fallback is 3.5 Flash-Lite.
// Thinking tokens bill at the output rate. This is an estimate from logged token counts.
const CURATOR_PRICES: Record<string, { in: number; out: number }> = {
  "gemini-flash-latest": { in: 0.75, out: 3.75 },
  "gemini-3.5-flash-lite": { in: 0.30, out: 2.50 },
};
async function estimateCuratorSpend() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("curator_logs")
    .select("created_at,model,prompt_tokens,output_tokens,thought_tokens,cached_tokens")
    .gte("created_at", since)
    .limit(5000);
  if (error) return { available: false as const, note: "run supabase/curator_analytics.sql to record token usage" };
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const acc = { last24h: { answers: 0, usd: 0 }, last7d: { answers: 0, usd: 0 }, promptTokens7d: 0, outputTokens7d: 0, thoughtTokens7d: 0, cachedTokens7d: 0, answersWithoutTokenData: 0 };
  for (const r of data ?? []) {
    if (r.prompt_tokens == null) { acc.answersWithoutTokenData++; continue; }
    const price = CURATOR_PRICES[r.model as string] ?? CURATOR_PRICES["gemini-flash-latest"];
    const cached = Math.min(r.cached_tokens ?? 0, r.prompt_tokens);
    // Cached input is billed at 10% of the normal input rate.
    const usd = ((r.prompt_tokens - cached) * price.in + cached * price.in * 0.1 + ((r.output_tokens ?? 0) + (r.thought_tokens ?? 0)) * price.out) / 1e6;
    acc.last7d.answers++; acc.last7d.usd += usd;
    if (new Date(r.created_at).getTime() >= dayAgo) { acc.last24h.answers++; acc.last24h.usd += usd; }
    acc.cachedTokens7d += cached; acc.promptTokens7d += r.prompt_tokens; acc.outputTokens7d += r.output_tokens ?? 0; acc.thoughtTokens7d += r.thought_tokens ?? 0;
  }
  const avg = (t: number, n: number) => (n ? Math.round(t / n) : null);
  return {
    available: true as const,
    ...acc,
    last24h: { ...acc.last24h, usd: Number(acc.last24h.usd.toFixed(4)) },
    last7d: { ...acc.last7d, usd: Number(acc.last7d.usd.toFixed(4)) },
    avgPromptTokens: avg(acc.promptTokens7d, acc.last7d.answers),
    avgOutputTokens: avg(acc.outputTokens7d, acc.last7d.answers),
    avgThoughtTokens: avg(acc.thoughtTokens7d, acc.last7d.answers),
    cacheHitShareOfPrompt: acc.promptTokens7d ? Number((acc.cachedTokens7d / acc.promptTokens7d).toFixed(3)) : null,
    avgCostPerAnswerUsd: acc.last7d.answers ? Number((acc.last7d.usd / acc.last7d.answers).toFixed(5)) : null,
  };
}

/* ── curator usage: read-only view of the rate-limit counters + what the function
   sees of the caller's network identity (same X-Report-Key as the report). Lets the
   owner check spend/traffic and verify the per-IP limiter is keyed on something a
   visitor can't just spoof. ── */
app.get(`${PREFIX}/curator/usage`, async (c) => {
  const expected = Deno.env.get("CURATOR_REPORT_KEY");
  if (!expected) return c.json({ error: "리포트 키가 설정되지 않았습니다" }, 503);
  if (!timingSafeEqual(c.req.header("X-Report-Key") ?? "", expected)) {
    return c.json({ error: "인증이 필요합니다" }, 401);
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("curator_usage")
    .select("bucket,count,updated_at")
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(200);
  const days = (data ?? []).filter((r) => r.bucket.startsWith("day:"));
  const spend = await estimateCuratorSpend();
  const ipBuckets = (data ?? []).filter((r) => r.bucket.startsWith("ip:"));
  return c.json({
    usageQueryError: error?.message ?? null,
    days,
    distinctIpBucketsLast24h: ipBuckets.length,
    topIpBuckets: ipBuckets.sort((x, y) => y.count - x.count).slice(0, 5),
    seenByFunction: {
      clientIp: clientIp(c.req.raw.headers),
      cfConnectingIp: c.req.header("cf-connecting-ip") ?? null,
      xForwardedFor: c.req.header("x-forwarded-for") ?? null,
      xRealIp: c.req.header("x-real-ip") ?? null,
    },
    spend,
    limits: { perIpPerWindow: CURATOR_MAX_PER_WINDOW, perIpPerDay: CURATOR_MAX_PER_IP_PER_DAY, windowMinutes: CURATOR_WINDOW_MS / 60000, perDay: CURATOR_DAY_MAX },
  });
});

/* ── curator lab: report-key-only test bench for the docent's model settings ──
   Runs the production prompt (built from the live portfolio row) through one Gemini call
   with an optional model / generationConfig override and returns the raw usage numbers
   (thinking tokens, cache hits, finishReason) — so cost and quality experiments don't
   need a redeploy per idea. Not rate limited, but only the report key opens it. */
app.post(`${PREFIX}/curator/lab`, async (c) => {
  const expected = Deno.env.get("CURATOR_REPORT_KEY");
  if (!expected) return c.json({ error: "리포트 키가 설정되지 않았습니다" }, 503);
  if (!timingSafeEqual(c.req.header("X-Report-Key") ?? "", expected)) return c.json({ error: "인증이 필요합니다" }, 401);
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return c.json({ error: "GEMINI_API_KEY 없음" }, 500);

  const body = await c.req.json().catch(() => null);
  const question = typeof body?.question === "string" && body.question.trim() ? body.question.trim().slice(0, 500) : "작가는 어떤 작업을 하나요?";
  const lang: "ko" | "en" = body?.lang === "en" ? "en" : "ko";
  const model = typeof body?.model === "string" && /^[a-z0-9.-]{3,60}$/.test(body.model) ? body.model : CURATOR_MODELS[0];
  const override = body?.generationConfig && typeof body.generationConfig === "object" ? body.generationConfig : {};

  const { data: row } = await supabaseAdmin
    .from("portfolio_state")
    .select("content,slides,artworks,current_exhibitions,exhibitions,press,contacts,settings")
    .eq("id", 1).maybeSingle();
  const sections = buildSections((row ?? {}) as PortfolioRowForCurator, lang);
  const prompt = buildPrompt(question, selectKnowledge(question, sections), "", lang);

  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: CURATOR_MAX_OUTPUT_TOKENS, thinkingConfig: CURATOR_THINKING_CONFIG, ...override },
    }),
    signal: AbortSignal.timeout(45_000),
  }).catch((err) => ({ ok: false, status: 0, text: async () => String(err) }) as unknown as Response);
  const elapsedMs = Date.now() - started;
  if (!res.ok) return c.json({ model, status: res.status, elapsedMs, error: (await res.text()).slice(0, 800) });
  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string = candidate?.content?.parts?.[0]?.text ?? "";
  return c.json({
    model, status: 200, elapsedMs, promptChars: prompt.length,
    finishReason: candidate?.finishReason ?? null,
    usage: data?.usageMetadata ?? null,
    parsed: parseCuratorOutput(text),
    rawTextHead: text.slice(0, 200),
  });
});

Deno.serve(app.fetch);
