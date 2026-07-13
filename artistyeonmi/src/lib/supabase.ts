import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

const SUPABASE_URL = `https://${projectId}.supabase.co`;

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

/* ── Upload image → Supabase Storage as WebP, return public URL ── */
export async function uploadImage(key: string, file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");

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

  const path = `${key}/${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from("portfolio")
    .upload(path, webp, { upsert: true, contentType: "image/webp" });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return supabase.storage.from("portfolio").getPublicUrl(path).data.publicUrl;
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

export async function savePortfolio(
  patch: Omit<Partial<PortfolioRow>, "id" | "updated_at">
): Promise<void> {
  if (!supabase) return;

  // Strip base64 data URLs — too large for DB, cause timeouts.
  const safeImageUrls = patch.image_urls
    ? Object.fromEntries(
        Object.entries(patch.image_urls).filter(([, v]) => v.startsWith("http"))
      )
    : {};

  // Merge image_urls with whatever is currently in DB so concurrent sessions
  // (e.g. Figma desktop + mobile web) don't overwrite each other's uploads.
  let mergedImageUrls = safeImageUrls;
  const { data: current } = await supabase
    .from("portfolio_state")
    .select("image_urls")
    .eq("id", 1)
    .maybeSingle();
  if (current?.image_urls && typeof current.image_urls === "object") {
    // DB values are the base; local values win for keys this session owns
    mergedImageUrls = { ...current.image_urls as Record<string, string>, ...safeImageUrls };
  }

  const { error } = await supabase
    .from("portfolio_state")
    .upsert({ ...patch, image_urls: mergedImageUrls, id: 1, updated_at: new Date().toISOString() });
  if (error) console.error("[DB] save error:", error.message);
}
