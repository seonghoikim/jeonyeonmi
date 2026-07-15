import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

const SUPABASE_URL = `https://${projectId}.supabase.co`;
// Supabase strips only "/functions/v1" and forwards "/<function-name>/<rest>" to the
// function's own router, so the Hono app's routes are themselves prefixed with the
// deployed function's name ("make-server-9c6a1cce" — see supabase/functions/server).
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1/make-server-9c6a1cce`;

// Singleton — prevent multiple GoTrueClient instances in the same browser context
const key = "__portfolio_supabase__";
declare global { interface Window { [key]: ReturnType<typeof createClient> | undefined } }
export const supabase: ReturnType<typeof createClient> =
  (window[key] as ReturnType<typeof createClient>) ??
  (() => { const c = createClient(SUPABASE_URL, publicAnonKey); window[key] = c; return c; })();
export const isSupabaseReady = true;

/* ── Resize + WebP conversion (client-side via Canvas) ── */
// Resizes to at most maxPx on the longest side before encoding as WebP.
// Keeps portfolio images well under 500KB while preserving quality.
export async function toWebP(file: File, quality = 0.85, maxPx = 2000): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width: w, height: h } = bitmap;
  const scale = Math.min(1, maxPx / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("WebP conversion failed"));
        const name = file.name.replace(/\.[^.]+$/, ".webp");
        resolve(new File([blob], name, { type: "image/webp" }));
      },
      "image/webp",
      quality
    );
  });
}

// Supabase's Edge Function gateway itself requires a valid Supabase JWT in the
// Authorization header (independent of our own login), so every call passes the
// public anon key there; our own editor session token rides in a separate header
// so the two don't collide.
const gatewayHeaders = () => ({ Authorization: `Bearer ${publicAnonKey}` });

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

/* ── Upload image → Supabase Storage as WebP, return public URL ──
   Goes through the Edge Function (service role) since the storage bucket
   blocks anon INSERT/UPDATE — requires a valid editor session token. */
export async function uploadImage(key: string, file: File, token: string, label?: string): Promise<string> {
  // Convert to WebP with resize. If the first attempt fails (e.g. very large HEIC),
  // retry at half the max size before giving up.
  let webp: File;
  try {
    webp = await toWebP(file, 0.85, 2000);
  } catch {
    try {
      webp = await toWebP(file, 0.82, 1200); // retry at smaller size
    } catch (e) {
      throw new Error(`이미지 변환 실패 (지원하지 않는 형식일 수 있습니다): ${e}`);
    }
  }

  const form = new FormData();
  form.append("file", webp);
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
  settings: Record<string, string>;
  image_urls: Record<string, string>;
  updated_at: string;
};

export async function loadPortfolio(): Promise<Partial<PortfolioRow>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("portfolio_state")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) { console.error("[DB] load error:", error.message); return {}; }
  return data ?? {};
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
  const channel = supabase
    .channel("portfolio_state_changes")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "portfolio_state", filter: "id=eq.1" },
      (payload) => onChange(payload.new as PortfolioRow)
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
