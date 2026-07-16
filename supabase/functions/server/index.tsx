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

  const numbered = texts.map((t: string, i: number) => `${i}: ${JSON.stringify(t)}`).join("\n");
  const prompt = `다음은 한국 현대미술 작가의 포트폴리오 웹사이트에 들어가는 한국어 문장들입니다. 각 문장을 자연스러운 영어로 번역하세요. 예술적/문학적 어조를 살리고, 줄바꿈(\\n)은 그대로 유지하세요.

각 줄은 "인덱스: JSON 문자열" 형식입니다:
${numbered}

아래 JSON 형식으로만 응답하세요:
{"translations": ["...", "...", ...]}
번역 배열의 길이와 순서는 입력과 정확히 같아야 합니다 (총 ${texts.length}개).`;

  try {
    const res = await fetch(
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
    if (!res.ok) {
      console.error("[translate] Gemini API error:", res.status, await res.text().catch(() => ""));
      return c.json({ error: "번역 요청이 실패했습니다" }, 502);
    }
    const data = await res.json();
    const textOut: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(textOut);
    const translations = parsed?.translations;
    if (!Array.isArray(translations) || translations.length !== texts.length) {
      console.error("[translate] unexpected translation response shape:", textOut);
      return c.json({ error: "번역 응답 형식이 올바르지 않습니다" }, 502);
    }
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

Deno.serve(app.fetch);
