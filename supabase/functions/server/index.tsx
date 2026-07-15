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

app.post(`${PREFIX}/portfolio/upload`, requireAuth, async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  const key = form?.get("key");
  if (!(file instanceof File) || typeof key !== "string" || !key) {
    return c.json({ error: "잘못된 요청" }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "파일이 너무 큽니다 (최대 10MB)" }, 413);
  }

  const path = `${key}/${Date.now()}.webp`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from("portfolio")
    .upload(path, bytes, { upsert: true, contentType: file.type || "image/webp" });
  if (error) return c.json({ error: error.message }, 500);

  const { data } = supabaseAdmin.storage.from("portfolio").getPublicUrl(path);
  return c.json({ url: data.publicUrl });
});

/* ── translate: authenticated batch KO→EN translation via MyMemory (free, no API key) ──
   MyMemory has no batch endpoint, so each text is a separate request; run with limited
   concurrency to stay well under its anonymous rate limit (5000 chars/day per IP — add
   an email via `de=` below to raise that to 50000/day, see https://mymemory.translated.net/doc/spec.php). */
const MAX_TRANSLATE_ITEMS = 200;
const MAX_TRANSLATE_CHARS = 20000;
const TRANSLATE_CONCURRENCY = 5;

async function translateOne(text: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ko|en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory API error: ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (typeof translated !== "string") throw new Error("번역 응답 형식이 올바르지 않습니다");
  return translated;
}

async function translateAllWithConcurrency(texts: string[], limit: number): Promise<string[]> {
  const results: string[] = new Array(texts.length);
  let next = 0;
  async function worker() {
    while (next < texts.length) {
      const i = next++;
      results[i] = await translateOne(texts[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, texts.length) }, worker));
  return results;
}

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

  try {
    const translations = await translateAllWithConcurrency(texts, TRANSLATE_CONCURRENCY);
    return c.json({ translations });
  } catch (err) {
    console.error("[translate] error:", err);
    return c.json({ error: "번역 중 오류가 발생했습니다" }, 500);
  }
});

Deno.serve(app.fetch);
