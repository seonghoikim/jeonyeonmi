import type { SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

const SUPABASE_URL = `https://${projectId}.supabase.co`;
// Supabase strips only "/functions/v1" and forwards "/<function-name>/<rest>" to the
// function's own router, so the Hono app's routes are themselves prefixed with the
// deployed function's name ("make-server-9c6a1cce" — see supabase/functions/server).
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1/make-server-9c6a1cce`;

// supabase-js (auth + realtime + storage clients, the bulk of the main bundle) is only
// needed for the realtime channel, which only editors use — so it is loaded on demand
// there, and the one public read every visitor needs goes through plain fetch instead.
// Singleton — prevent multiple GoTrueClient instances in the same browser context.
const key = "__portfolio_supabase__";
declare global { interface Window { [key]: SupabaseClient | undefined } }
async function getSupabaseClient(): Promise<SupabaseClient> {
  const existing = window[key];
  if (existing) return existing;
  const { createClient } = await import("@supabase/supabase-js");
  const client = window[key] ?? createClient(SUPABASE_URL, publicAnonKey);
  window[key] = client;
  return client;
}
export const isSupabaseReady = true;

/* ── Resize + WebP conversion (client-side via Canvas) ── */
// Resizes to at most maxPx on the longest side before encoding as WebP (JPEG where WebP encoding is unsupported).
// Keeps portfolio images well under 500KB while preserving quality.
export async function toWebP(file: File, quality = 0.85, maxPx = 2000): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width: w, height: h } = bitmap;
  const scale = Math.min(1, maxPx / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, q: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  return (async () => {
    const webp = await encode("image/webp", quality);
    if (webp && webp.type === "image/webp") {
      return new File([webp], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
    }
    // Safari/iOS can't encode WebP: toBlob quietly hands back a lossless PNG instead (5–10MB
    // for a painting). Fall back to JPEG, flattening any transparency onto white first.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const jpeg = await encode("image/jpeg", quality);
    if (!jpeg || jpeg.type !== "image/jpeg") throw new Error("image conversion failed");
    return new File([jpeg], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  })();
}

// Supabase's Edge Function gateway itself requires a valid Supabase JWT in the
// Authorization header (independent of our own login), so every call passes the
// public anon key there; our own editor session token rides in a separate header
// so the two don't collide.
const gatewayHeaders = () => ({ Authorization: `Bearer ${publicAnonKey}` });

// Grid cards (Works/CurrentExhibitions) render up to ~450px wide — on a 2x/retina
// display that needs a ~900px source to look crisp, so the thumbnail can't be much
// smaller than that without looking soft, even though it's still under 1/4 the
// pixel area of the 2000px full image.
const THUMB_MAX_PX = 900;
const THUMB_QUALITY = 0.8;

/* ── Editor login: password is verified server-side, never shipped to the client ── */
export async function loginEditor(password: string): Promise<string> {
  const res = await fetch(`${FUNCTIONS_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...gatewayHeaders() },
    body: JSON.stringify({ password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `로그인 실패 (${res.status})`);
  return body.token as string;
}

async function uploadOne(key: string, file: File, token: string, label?: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("key", key);
  // Used server-side to build a descriptive filename (e.g. floating-memory-i-<ts>.webp)
  // instead of a bare timestamp — pass the English title/caption when available.
  if (label) form.append("label", label);
  const res = await fetch(`${FUNCTIONS_URL}/portfolio/upload`, {
    method: "POST",
    headers: { ...gatewayHeaders(), "X-Edit-Token": token },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Storage upload failed (${res.status})`);
  return body.url as string;
}

/* ── Upload image → Supabase Storage as WebP, return both a full-size URL and a
   small grid/list-thumbnail URL ──
   Every grid/list view (Works, Activities, exhibition posters/thumbnails) used to
   point at the same up-to-2000px full image as the detail/lightbox view, so a
   single page load could pull down dozens of full-resolution images — this is what
   blew through the Supabase free plan's cached-egress quota. Uploading a second,
   much smaller variant under "<key>-thumb" (same upload endpoint, just a different
   storage key, so no server/Edge Function change needed) lets grid views request a
   file an order of magnitude smaller.
   Goes through the Edge Function (service role) since the storage bucket blocks
   anon INSERT/UPDATE — requires a valid editor session token. */
export async function uploadImage(key: string, file: File, token: string, label?: string): Promise<{ url: string; thumbUrl: string }> {
  // Convert to WebP with resize. If the first attempt fails (e.g. very large HEIC),
  // retry at half the max size before giving up.
  let full: File;
  try {
    full = await toWebP(file, 0.85, 2000);
  } catch {
    try {
      full = await toWebP(file, 0.82, 1200); // retry at smaller size
    } catch (e) {
      throw new Error(`이미지 변환 실패 (지원하지 않는 형식일 수 있습니다): ${e}`);
    }
  }
  // Thumbnail is derived from the already-resized full file (cheap re-encode, not
  // the original — avoids re-decoding a potentially huge source image twice).
  const thumb = await toWebP(full, THUMB_QUALITY, THUMB_MAX_PX);

  // Independent uploads to two different storage keys — run them concurrently.
  const [url, thumbUrl] = await Promise.all([
    uploadOne(key, full, token, label),
    uploadOne(`${key}-thumb`, thumb, token, label),
  ]);
  return { url, thumbUrl };
}

// One-time backfill for images uploaded before thumbnails existed: fetches the
// already-stored full-size file, derives a thumb from it, and uploads just that —
// the full image is untouched, so this is safe to run repeatedly/partially.
export async function backfillThumbnail(key: string, imageUrl: string, token: string, label?: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`원본 이미지를 가져오지 못했습니다 (${res.status})`);
  const blob = await res.blob();
  const file = new File([blob], "source.webp", { type: blob.type || "image/webp" });
  const thumb = await toWebP(file, THUMB_QUALITY, THUMB_MAX_PX);
  return uploadOne(`${key}-thumb`, thumb, token, label);
}

/* ── Batch KO→EN translation via the Edge Function (Claude) ──
   Returns translations in the same order as the input texts. */
export async function translateTexts(texts: string[], token: string): Promise<string[]> {
  if (texts.length === 0) return [];
  const res = await fetch(`${FUNCTIONS_URL}/portfolio/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...gatewayHeaders(), "X-Edit-Token": token },
    body: JSON.stringify({ texts }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `번역 실패 (${res.status})`);
  return body.translations as string[];
}

/* ── Curator widget: public AI Q&A about the artist/work (no editor token — anyone
   can ask). Server builds the knowledge base from the live portfolio_state row. ── */
export type CuratorTurn = { role: "user" | "guide"; text: string };

export async function askCurator(
  question: string, history: CuratorTurn[], lang: "ko" | "en", context?: { sessionId?: string; page?: string }
): Promise<{ answer: string; suggestions: string[] }> {
  const res = await fetch(`${FUNCTIONS_URL}/curator/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...gatewayHeaders() },
    // session_id ties one visitor's questions together in curator_logs; page says where
    // they were (e.g. a /works/... page) — both optional analytics context.
    body: JSON.stringify({ question, history, lang, session_id: context?.sessionId, page: context?.page }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `curator request failed (${res.status})`);
  return { answer: body.answer as string, suggestions: Array.isArray(body.suggestions) ? body.suggestions : [] };
}

/* ── Press link preview: server-side og:title/og:image/og:site_name extraction ──
   Avoids CORS (fetching another site's HTML from the browser is blocked) and lets the
   editor paste a URL instead of manually cropping/uploading a logo for every article. */
export async function unfurlPress(url: string, token: string): Promise<{ title: string; image: string; siteName: string }> {
  const res = await fetch(`${FUNCTIONS_URL}/portfolio/unfurl`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...gatewayHeaders(), "X-Edit-Token": token },
    body: JSON.stringify({ url }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `미리보기 가져오기 실패 (${res.status})`);
  return body as { title: string; image: string; siteName: string };
}

/* ── DB operations ── */
export type PortfolioRow = {
  id: number;
  content: Record<string, string>;
  current_exhibitions: unknown[];
  artworks: unknown[];
  series_list: unknown[];
  slides: unknown[];
  exhibitions: unknown[];
  activity_photos: unknown[];
  videos: unknown[];
  contacts: unknown[];
  press: unknown[];
  settings: Record<string, string>;
  image_urls: Record<string, string>;
  updated_at: string;
};

// null means the load itself failed (network/DB error) — distinct from {} (no row yet),
// so the app can refuse to edit/save over real content with its built-in sample data.
export async function loadPortfolio(): Promise<Partial<PortfolioRow> | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_state?id=eq.1&select=*`, {
      headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) { console.error("[DB] load error:", res.status); return null; }
    const rows = (await res.json()) as PortfolioRow[];
    return rows[0] ?? {};
  } catch (err) {
    console.error("[DB] load threw:", err);
    return null;
  }
}

export type SaveResult =
  | { ok: true; row: PortfolioRow }
  | { ok: false; conflict: true; latest: PortfolioRow }
  | { ok: false; conflict?: false; error: string };

// Strip base64 data URLs — too large for DB, cause timeouts. Merging against the
// current DB row happens server-side now (see supabase/functions/server/index.tsx).
export async function savePortfolio(
  patch: Omit<Partial<PortfolioRow>, "id" | "updated_at">,
  token: string,
  expectedUpdatedAt?: string
): Promise<SaveResult> {
  const safeImageUrls = patch.image_urls
    ? Object.fromEntries(Object.entries(patch.image_urls).filter(([, v]) => v.startsWith("http")))
    : undefined;

  const res = await fetch(`${FUNCTIONS_URL}/portfolio/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...gatewayHeaders(), "X-Edit-Token": token },
    body: JSON.stringify({ patch: { ...patch, image_urls: safeImageUrls }, expectedUpdatedAt }),
  });
  const body = await res.json().catch(() => ({}));

  if (res.status === 409 && body?.conflict) return { ok: false, conflict: true, latest: body.latest };
  if (!res.ok) { console.error("[DB] save error:", body?.error); return { ok: false, error: body?.error ?? `save failed (${res.status})` }; }
  return { ok: true, row: body.data };
}

/* ── Realtime: notify other open tabs/devices when the shared row changes ── */
export function subscribePortfolio(onChange: (row: PortfolioRow) => void): () => void {
  let cancelled = false;
  let cleanup: (() => void) | null = null;
  getSupabaseClient()
    .then((client) => {
      if (cancelled) return; // unsubscribed before the library finished loading
      const channel = client
        .channel("portfolio_state_changes")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "portfolio_state", filter: "id=eq.1" },
          (payload) => onChange(payload.new as PortfolioRow)
        )
        .subscribe();
      cleanup = () => { client.removeChannel(channel); };
    })
    .catch((err) => console.error("[DB] realtime unavailable:", err));
  return () => { cancelled = true; cleanup?.(); };
}
