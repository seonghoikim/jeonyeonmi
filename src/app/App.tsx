import { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from "react";
import { loadPortfolio, savePortfolio, uploadImage, backfillThumbnail, loginEditor, translateTexts, unfurlPress, subscribePortfolio, isSupabaseReady, type PortfolioRow } from "../lib/supabase";
import { Menu, X, Edit3, Check, Languages } from "lucide-react";
import {
  MONO, serifOf, sansOf, hSize, GLOBAL_CSS, artworkSlug, artworkIdFromSlug,
  initContent, UI, initCurrentEx, initSeries, initArtworks, initSlides, initExhibitions, initActivityPhotos, initVideos, initContacts, initPress,
  type Lang, type ContentKey, type CurrentExhibition, type Artwork, type Series, type Slide, type ExhibitionEntry, type ActivityPhoto, type VideoEntry, type ContactItem, type PressEntry,
} from "./data";
import { useGoogleAnalytics } from "./useGoogleAnalytics";
import { useSeoMeta } from "./useSeoMeta";
import { useStructuredData } from "./useStructuredData";
import { useModalLock } from "./useModalLock";
import { PortfolioContext, usePortfolioContext, type PortfolioContextValue } from "./PortfolioContext";
import { Hero } from "./components/sections/Hero";
import { CurrentExhibitions } from "./components/sections/CurrentExhibitions";
import { Works } from "./components/sections/Works";
// Below-the-fold sections and editor-only UI (upload/reorder/password modal) are
// dead weight for every anonymous visitor's initial bundle — split them into their
// own chunks that load in parallel once the above-the-fold JS has taken over.
const ArtistStatement = lazy(() => import("./components/sections/ArtistStatement").then((m) => ({ default: m.ArtistStatement })));
const Exhibitions = lazy(() => import("./components/sections/Exhibitions").then((m) => ({ default: m.Exhibitions })));
const Press = lazy(() => import("./components/sections/Press").then((m) => ({ default: m.Press })));
const Activities = lazy(() => import("./components/sections/Activities").then((m) => ({ default: m.Activities })));
const Video = lazy(() => import("./components/sections/Video").then((m) => ({ default: m.Video })));
const Contact = lazy(() => import("./components/sections/Contact").then((m) => ({ default: m.Contact })));
const Footer = lazy(() => import("./components/sections/Footer").then((m) => ({ default: m.Footer })));
const Lightbox = lazy(() => import("./components/sections/Lightbox").then((m) => ({ default: m.Lightbox })));
const PasswordModal = lazy(() => import("./components/sections/PasswordModal").then((m) => ({ default: m.PasswordModal })));

// Module-scope (not defined inside App's render) so its identity is stable across
// re-renders. It used to be a closure defined inline in App() and handed out via
// context as `C` — since App re-renders on every keystroke, that recreated a brand
// new component function each time, which made React unmount/remount the underlying
// <input>/<textarea> on every keystroke and drop focus/cursor position.
function InlineField({ field, multi = false, rows = 3, className = "" }: { field: ContentKey; multi?: boolean; rows?: number; className?: string; }) {
  const { content, lang, editMode, updateContent, SANS } = usePortfolioContext();
  const enKey = (field + "En") as ContentKey;
  const af: ContentKey = lang === "en" && enKey in content ? enKey : field;
  const val = content[af] ?? "";
  if (!editMode) return <>{val}</>;
  if (multi) return <textarea value={val} rows={rows} onChange={(e) => updateContent(af, e.target.value)} className={`bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full ${className}`} style={SANS} />;
  return <input value={val} onChange={(e) => updateContent(af, e.target.value)} className={`bg-transparent border-b border-dashed border-accent/60 outline-none w-full ${className}`} />;
}

// "/works/:slug" or "/en/works/:slug" -> the artwork id, so a deep link, a page
// reload, and browser back/forward all resolve the same way.
function parseWorkIdFromPath(pathname: string): number | null {
  const m = pathname.match(/^\/(?:en\/)?works\/([^/]+)\/?$/);
  return m ? artworkIdFromSlug(m[1]) : null;
}

export default function App() {
  useGoogleAnalytics();
  // /en is a real, crawlable, bookmarkable/shareable URL for the English version (with its
  // own hreflang entry) — it always wins over locale/timezone guessing. Anywhere else, keep
  // guessing from the visitor's timezone as before.
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/en")) return "en";
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Seoul" ? "ko" : "en";
    } catch {
      return "ko";
    }
  });
  const u = UI[lang];
  const SERIF = serifOf(lang);
  const SANS = sansOf(lang);

  /* page content */
  const [content, setContent] = useState(initContent);
  const updateContent = (field: ContentKey, value: string) => setContent((p) => ({ ...p, [field]: value }));
  const c = (field: string): string => {
    const enKey = (field + "En") as ContentKey;
    if (lang === "en" && enKey in content) return (content as Record<string, string>)[enKey] ?? "";
    return (content as Record<string, string>)[field] ?? "";
  };

  /* auth */
  const [isAuth, setIsAuth] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwErrorMsg, setPwErrorMsg] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const editTokenRef = useRef<string | null>(null); // in-memory only — never persisted

  /* lightbox */
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lbScale, setLbScale] = useState(1);
  const [lbOffset, setLbOffset] = useState({ x: 0, y: 0 });
  const [lbDragging, setLbDragging] = useState(false);
  const [lbDragStart, setLbDragStart] = useState({ x: 0, y: 0 });
  const [lbPinchDist, setLbPinchDist] = useState<number | null>(null);
  const [lbScaleAtPinch, setLbScaleAtPinch] = useState(1);

  const [lbShowZoom, setLbShowZoom] = useState(true);
  const lbImgRef = useRef<HTMLImageElement>(null);
  const lbContainerRef = useRef<HTMLDivElement>(null);
  const lbBaseSizeRef = useRef({ width: 0, height: 0 }); // rendered image size at scale=1

  // Keeps the zoomed image from being panned/scrolled entirely off-screen with
  // no way back — clamps so the container is always at least partially covered.
  const clampLbOffset = (x: number, y: number, scale: number) => {
    if (scale <= 1) return { x: 0, y: 0 };
    const container = lbContainerRef.current;
    const { width: bw, height: bh } = lbBaseSizeRef.current;
    if (!container || bw === 0 || bh === 0) return { x, y };
    const overflowX = Math.max(0, (bw * scale - container.clientWidth) / 2);
    const overflowY = Math.max(0, (bh * scale - container.clientHeight) / 2);
    return {
      x: Math.min(overflowX, Math.max(-overflowX, x)),
      y: Math.min(overflowY, Math.max(-overflowY, y)),
    };
  };

  // Measure the image's rendered (unscaled) box once it loads — used as the
  // baseline for pan-clamping math above.
  useLayoutEffect(() => {
    if (!lightboxSrc) return;
    const measure = () => {
      const img = lbImgRef.current;
      if (img) lbBaseSizeRef.current = { width: img.offsetWidth, height: img.offsetHeight };
    };
    measure();
    const img = lbImgRef.current;
    img?.addEventListener("load", measure);
    return () => img?.removeEventListener("load", measure);
  }, [lightboxSrc]);

  const openLightbox = (src: string, showZoom = true) => { setLightboxSrc(src); setLbScale(1); setLbOffset({ x: 0, y: 0 }); setLbShowZoom(showZoom); };
  const lbStep = (s: number, dir: 1 | -1) => {
    const step = s >= 1 ? 0.05 : 0.15;
    return parseFloat((s + dir * step).toFixed(2));
  };
  const applyLbScale = (newScale: number) => {
    const clamped = Math.max(0.25, Math.min(8, newScale));
    setLbScale(clamped);
    setLbOffset((prev) => clampLbOffset(prev.x, prev.y, clamped));
  };
  const lbZoomIn = () => applyLbScale(lbStep(lbScale, 1));
  const lbZoomOut = () => applyLbScale(lbStep(lbScale, -1));
  const lbReset = () => { setLbScale(1); setLbOffset({ x: 0, y: 0 }); };

  const handleLbWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    applyLbScale(lbStep(lbScale, dir));
  };
  const handleLbMouseDown = (e: React.MouseEvent) => {
    setLbDragging(true);
    setLbDragStart({ x: e.clientX - lbOffset.x, y: e.clientY - lbOffset.y });
  };
  const handleLbMouseMove = (e: React.MouseEvent) => {
    if (!lbDragging) return;
    setLbOffset(clampLbOffset(e.clientX - lbDragStart.x, e.clientY - lbDragStart.y, lbScale));
  };
  const handleLbMouseUp = () => setLbDragging(false);

  const handleLbTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setLbPinchDist(d); setLbScaleAtPinch(lbScale);
    } else {
      setLbDragging(true);
      setLbDragStart({ x: e.touches[0].clientX - lbOffset.x, y: e.touches[0].clientY - lbOffset.y });
    }
  };
  const handleLbTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lbPinchDist !== null) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const newScale = Math.max(0.25, Math.min(8, lbScaleAtPinch * (d / lbPinchDist)));
      setLbScale(newScale);
      setLbOffset((prev) => clampLbOffset(prev.x, prev.y, newScale));
    } else if (e.touches.length === 1 && lbDragging) {
      setLbOffset(clampLbOffset(e.touches[0].clientX - lbDragStart.x, e.touches[0].clientY - lbDragStart.y, lbScale));
    }
  };
  const handleLbTouchEnd = () => { setLbDragging(false); setLbPinchDist(null); };

  /* lightbox zoom keyboard shortcuts — Escape-to-close and scroll lock live in
     Lightbox itself via useModalLock */
  useEffect(() => {
    if (!lightboxSrc) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "=" || e.key === "+") lbZoomIn();
      if (e.key === "-") lbZoomOut();
      if (e.key === "0") lbReset();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightboxSrc, lbScale]);

  /* ── DB: initial load ── */
  useEffect(() => {
    if (!isSupabaseReady) { setIsLoading(false); return; }
    loadPortfolio().then((row) => {
      if (!row) { setIsLoading(false); return; }
      if (row.content && Object.keys(row.content).length > 0) setContent((p) => ({ ...p, ...row.content }));
      if ((row.current_exhibitions as CurrentExhibition[])?.length) setCurrentExList(row.current_exhibitions as CurrentExhibition[]);
      if ((row.artworks as Artwork[])?.length) setArtworkList(row.artworks as Artwork[]);
      if ((row.series_list as Series[])?.length) setSeriesList(row.series_list as Series[]);
      if ((row.slides as Slide[])?.length) {
        const loadedSlides = row.slides as Slide[];
        setSlides(loadedSlides);
        setCurrentSlide(Math.floor(Math.random() * loadedSlides.length));
      }
      if ((row.exhibitions as ExhibitionEntry[])?.length) setExhibitionList(row.exhibitions as ExhibitionEntry[]);
      if ((row.activity_photos as ActivityPhoto[])?.length) setActivityPhotos(row.activity_photos as ActivityPhoto[]);
      if ((row.videos as VideoEntry[])?.length) setVideoList(row.videos as VideoEntry[]);
      if ((row.contacts as ContactItem[])?.length) setContactItems(row.contacts as ContactItem[]);
      if ((row.press as PressEntry[])?.length) setPressList(row.press as PressEntry[]);
      if (row.settings?.heroCaption) setHeroCaption(row.settings.heroCaption);
      if (row.settings?.heroCaptionEn) setHeroCaptionEn(row.settings.heroCaptionEn);
      if (row.image_urls && Object.keys(row.image_urls).length > 0) {
        setImageUrls(row.image_urls);
        const heroUrl = row.image_urls.hero;
        if (heroUrl) { const i = new window.Image(); i.onload = () => setHeroAspectRatio(i.naturalWidth / i.naturalHeight); i.src = heroUrl; }
      }
      if (row.updated_at) lastUpdatedAtRef.current = row.updated_at;
      setIsLoading(false);
    });
  }, []);

  /* ── DB / image state ── */
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isSavingRef = useRef(false);   // lock: prevent concurrent saves
  const saveAgainRef = useRef(false);  // flag: state changed while saving
  const saveDataRef = useRef<Parameters<typeof savePortfolio>[0]>({}); // always latest
  const lastUpdatedAtRef = useRef<string | undefined>(undefined); // last known DB updated_at, for conflict checks
  const img = useCallback((key: string) => imageUrls[key] ?? null, [imageUrls]);
  // Grid/list views: prefer the small "<key>-thumb" variant, falling back to the
  // full image for anything uploaded before thumbnails existed.
  const imgThumb = useCallback((key: string) => imageUrls[`${key}-thumb`] ?? imageUrls[key] ?? null, [imageUrls]);
  useSeoMeta({ name: c("heroName"), description: c("heroDesc"), imageUrl: img("hero"), lang });

  /* other state */
  const [currentExList, setCurrentExList] = useState(initCurrentEx);
  const [editingCurrentId, setEditingCurrentId] = useState<number | null>(null);
  const [showPastEx, setShowPastEx] = useState(true);

  const [artworkList, setArtworkList] = useState(initArtworks);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(
    () => (typeof window === "undefined" ? null : parseWorkIdFromPath(window.location.pathname))
  );
  const [seriesList, setSeriesList] = useState(initSeries);
  const [selectedSeries, setSelectedSeries] = useState("전체");
  const [editingSeriesId, setEditingSeriesId] = useState<number | null>(null);
  const [heroAspectRatio, setHeroAspectRatio] = useState<number | null>(null);
  const [heroCaption, setHeroCaption] = useState("부유하는 기억 I, 2024");
  const [heroCaptionEn, setHeroCaptionEn] = useState("Floating Memory I, 2024");
  const [editingCaption, setEditingCaption] = useState(false);
  const [slides, setSlides] = useState(initSlides);
  // Random rather than always slide 0 — otherwise a visitor who never manually
  // navigates would only ever see the first artist statement, and the rest
  // would go unread.
  const [currentSlide, setCurrentSlide] = useState(() => Math.floor(Math.random() * initSlides.length));
  const [isSliding, setIsSliding] = useState(false);
  const [exhibitionList, setExhibitionList] = useState(initExhibitions);
  const [exFilter, setExFilter] = useState<"전체" | "개인전" | "단체전" | "아트페어" | "공모전">("전체");
  const [exVisible, setExVisible] = useState(true);
  const [editingExId, setEditingExId] = useState<number | null>(null);
  const [activityPhotos, setActivityPhotos] = useState(initActivityPhotos);
  const [highlightedPhotoId, setHighlightedPhotoId] = useState<number | null>(null);
  const [uploadingExtraFor, setUploadingExtraFor] = useState<number | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const pendingMultiTarget = useRef<number | null>(null);
  const [videoList, setVideoList] = useState(initVideos);
  const [editingVideoId, setEditingVideoId] = useState<number | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);
  const [fullscreenVideoYtId, setFullscreenVideoYtId] = useState<string | null>(null);
  const videoOverlayRef = useModalLock<HTMLDivElement>(!!fullscreenVideoYtId, () => setFullscreenVideoYtId(null));
  const [contactItems, setContactItems] = useState(initContacts);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [pressList, setPressList] = useState(initPress);
  const [editingPressId, setEditingPressId] = useState<number | null>(null);
  const [fetchingPressId, setFetchingPressId] = useState<number | null>(null);
  useStructuredData({ lang, artistName: content.heroName, artistNameEn: content.heroNameEn, artworkList, imageUrls, currentExList, exhibitionList });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTarget = useRef<string | null>(null);
  const pendingLabel = useRef<string | undefined>(undefined);
  const langClickTs = useRef<number[]>([]);
  const dragSrc = useRef<number | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* ── DB: keep latest save data in ref (no stale closures) ── */
  // Runs on every render so saveDataRef always has current values
  // when the debounce timer fires, regardless of when it was set.
  saveDataRef.current = {
    content, current_exhibitions: currentExList, artworks: artworkList,
    series_list: seriesList, slides, exhibitions: exhibitionList,
    activity_photos: activityPhotos, videos: videoList, contacts: contactItems, press: pressList,
    settings: { heroCaption, heroCaptionEn }, image_urls: imageUrls,
  };

  /* ── DB: apply a row fetched remotely (initial 409-conflict reload or Realtime push) ── */
  const applyRemoteRow = useCallback((row: Partial<PortfolioRow>) => {
    if (row.content && Object.keys(row.content).length > 0) setContent((p) => ({ ...p, ...row.content }));
    if ((row.current_exhibitions as CurrentExhibition[])?.length) setCurrentExList(row.current_exhibitions as CurrentExhibition[]);
    if ((row.artworks as Artwork[])?.length) setArtworkList(row.artworks as Artwork[]);
    if ((row.series_list as Series[])?.length) setSeriesList(row.series_list as Series[]);
    if ((row.slides as Slide[])?.length) setSlides(row.slides as Slide[]);
    if ((row.exhibitions as ExhibitionEntry[])?.length) setExhibitionList(row.exhibitions as ExhibitionEntry[]);
    if ((row.activity_photos as ActivityPhoto[])?.length) setActivityPhotos(row.activity_photos as ActivityPhoto[]);
    if ((row.videos as VideoEntry[])?.length) setVideoList(row.videos as VideoEntry[]);
    if ((row.contacts as ContactItem[])?.length) setContactItems(row.contacts as ContactItem[]);
    if ((row.press as PressEntry[])?.length) setPressList(row.press as PressEntry[]);
    if (row.settings?.heroCaption) setHeroCaption(row.settings.heroCaption);
    if (row.settings?.heroCaptionEn) setHeroCaptionEn(row.settings.heroCaptionEn);
    if (row.image_urls && Object.keys(row.image_urls).length > 0) {
      setImageUrls(row.image_urls);
      const heroUrl = row.image_urls.hero;
      if (heroUrl) { const i = new window.Image(); i.onload = () => setHeroAspectRatio(i.naturalWidth / i.naturalHeight); i.src = heroUrl; }
    }
    if (row.updated_at) lastUpdatedAtRef.current = row.updated_at;
  }, []);

  /* ── DB: perform (or join) a save right now, using whatever token is still valid.
     Shared by the debounce timer below and by the "exit edit mode" flush, so that
     leaving edit mode right after a keystroke can't drop the pending change (the
     token is nulled out the instant editMode flips false — see exitEditMode). ── */
  const flushSave = useCallback(async (token: string) => {
    clearTimeout(saveTimerRef.current);
    // If a save is already running, mark dirty and let it re-save on completion
    if (isSavingRef.current) { saveAgainRef.current = true; return; }
    // Loop: re-save if state changed while the previous save was in flight
    do {
      saveAgainRef.current = false;
      isSavingRef.current = true;
      setIsSaving(true);
      const result = await savePortfolio(saveDataRef.current, token, lastUpdatedAtRef.current); // always uses latest data
      if (result.ok) {
        lastUpdatedAtRef.current = result.row.updated_at;
      } else if (result.conflict) {
        // Someone else saved a newer version first — reload it instead of overwriting.
        applyRemoteRow(result.latest);
        alert("다른 곳에서 방금 저장한 최신 내용을 불러왔습니다. 변경사항을 다시 입력해주세요.");
      } else {
        console.error("[DB] save error:", result.error);
      }
      isSavingRef.current = false;
    } while (saveAgainRef.current);
    setIsSaving(false);
  }, [applyRemoteRow]);

  /* ── DB: debounced auto-save (4 s after last change) — only while an editor session is active ── */
  useEffect(() => {
    if (isLoading || !editTokenRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (editTokenRef.current) flushSave(editTokenRef.current);
    }, 4000);
    return () => clearTimeout(saveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, currentExList, artworkList, seriesList, slides, exhibitionList, activityPhotos, videoList, contactItems, pressList, heroCaption, heroCaptionEn, imageUrls, isLoading]);

  /* ── Realtime: keep other open tabs/devices in sync ── */
  useEffect(() => {
    if (!isSupabaseReady) return;
    const unsubscribe = subscribePortfolio((row) => {
      if (isSavingRef.current) return; // don't clobber a save in flight
      if (row.updated_at && row.updated_at === lastUpdatedAtRef.current) return; // echo of our own save
      applyRemoteRow(row);
    });
    return unsubscribe;
  }, [applyRemoteRow]);

  /* ── Leaving edit mode fully ends the editor session: drop the token so no
     further save can fire from this tab, and require the password again to resume.
     exitEditMode() below flushes any pending debounced save *before* this runs,
     since the token it needs is nulled out here as soon as editMode flips false. ── */
  useEffect(() => {
    if (!editMode) { editTokenRef.current = null; setIsAuth(false); }
  }, [editMode]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h);
  }, []);

  // Keep language and the open artwork (if any) in sync with browser back/forward
  // navigation between /, /en, and /(en/)works/:slug.
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      setLang(path.startsWith("/en") ? "en" : "ko");
      setSelectedWorkId(parseWorkIdFromPath(path));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Mirrors the open artwork modal into the URL — /works/:slug (or /en/works/:slug)
  // while a work is open, back to the base path when closed — so an individual
  // artwork has a real, shareable, bookmarkable URL instead of just client state.
  // Guards against fighting the popstate handler above: if the address bar already
  // matches where this effect wants to go (e.g. because popstate just set it),
  // it's a no-op.
  const prevSelectedWorkIdRef = useRef<number | null>(selectedWorkId);
  useEffect(() => {
    const prevId = prevSelectedWorkIdRef.current;
    prevSelectedWorkIdRef.current = selectedWorkId;
    const rootPath = lang === "en" ? "/en" : "/";

    if (selectedWorkId == null) {
      if (prevId != null) window.history.pushState(null, "", rootPath + window.location.search);
      return;
    }
    const work = artworkList.find((w) => w.id === selectedWorkId);
    if (!work) return; // artwork data hasn't loaded yet (e.g. a fresh deep link) — resolves once artworkList updates
    const targetPath = `${lang === "en" ? "/en" : ""}/works/${artworkSlug(work)}`;
    if (window.location.pathname === targetPath) return;
    window.history[prevId == null ? "pushState" : "replaceState"](null, "", targetPath + window.location.search);
  }, [selectedWorkId, lang, artworkList]);

  // Swap <title>/description/OG/Twitter to the open artwork's own info while its
  // /works/:slug URL is active, and restore the site-level values (mirroring
  // useSeoMeta's own output) on close — so a bookmark or share of that URL reflects
  // the artwork, not just the artist bio.
  useEffect(() => {
    const work = selectedWorkId != null ? artworkList.find((w) => w.id === selectedWorkId) : null;
    if (!work) return;
    const setMeta = (selector: string, value: string) => document.querySelector(selector)?.setAttribute("content", value);
    const title = `${lang === "ko" ? work.title : work.titleEn} — ${c("heroName")}`;
    const description = (lang === "ko" ? work.description : work.descriptionEn) || c("heroDesc");
    document.title = title;
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    const workImg = img(`artwork-${work.id}`);
    if (workImg) { setMeta('meta[property="og:image"]', workImg); setMeta('meta[name="twitter:image"]', workImg); }
    return () => {
      const siteTitle = `${c("heroName")} — ${lang === "en" ? "Artist Portfolio" : "작가 포트폴리오"}`;
      document.title = siteTitle;
      setMeta('meta[name="description"]', c("heroDesc"));
      setMeta('meta[property="og:title"]', siteTitle);
      setMeta('meta[property="og:description"]', c("heroDesc"));
      setMeta('meta[name="twitter:title"]', siteTitle);
      setMeta('meta[name="twitter:description"]', c("heroDesc"));
      const heroImg = img("hero");
      if (heroImg) { setMeta('meta[property="og:image"]', heroImg); setMeta('meta[name="twitter:image"]', heroImg); }
    };
  }, [selectedWorkId, artworkList, lang]);

  /* mobile nav menu: close on outside click or on scroll */
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnScroll = () => setMenuOpen(false);
    const closeOnOutsideClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("scroll", closeOnScroll);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [menuOpen]);
  useEffect(() => {
    if (currentSlide >= slides.length) setCurrentSlide(Math.max(0, slides.length - 1));
  }, [slides.length]);
  useEffect(() => {
    if (highlightedPhotoId != null) { const t = setTimeout(() => setHighlightedPhotoId(null), 2000); return () => clearTimeout(t); }
  }, [highlightedPhotoId]);

  // Flushes any pending debounced save (using the still-live token) before
  // actually exiting edit mode, so a change made in the last 4s isn't dropped.
  const exitEditMode = () => {
    if (editTokenRef.current) flushSave(editTokenRef.current);
    setEditMode(false);
  };
  const handleEditToggle = () => {
    if (editMode) { exitEditMode(); return; }
    if (isAuth) { setEditMode(true); return; }
    setShowPwModal(true);
  };
  const handleLangClick = () => {
    setLang((l) => {
      const next = l === "ko" ? "en" : "ko";
      // Keep the URL in sync with the displayed language (/ = ko, /en = en) so the
      // language toggle is also a real, shareable, bookmarkable navigation — not just
      // a client-side flag search engines and link-shares never see.
      const path = next === "en" ? "/en" : "/";
      window.history.pushState({}, "", path + window.location.search + window.location.hash);
      return next;
    });
    const now = Date.now();
    langClickTs.current = [...langClickTs.current.filter((t) => now - t < 5000), now];
    if (langClickTs.current.length >= 5) {
      langClickTs.current = [];
      if (editMode) { exitEditMode(); }
      else if (isAuth) { setEditMode(true); }
      else { setShowPwModal(true); }
    }
  };
  const handlePwSubmit = async () => {
    if (pwSubmitting) return;
    setPwSubmitting(true);
    setPwErrorMsg("");
    try {
      editTokenRef.current = await loginEditor(pwInput);
      setIsAuth(true); setEditMode(true); setShowPwModal(false); setPwInput("");
    } catch (err) {
      setPwErrorMsg(err instanceof Error ? err.message : u.pwError);
    }
    setPwSubmitting(false);
  };
  const changeExFilter = (f: "전체" | "개인전" | "단체전" | "아트페어" | "공모전") => {
    if (f === exFilter) return;
    setExVisible(false); setTimeout(() => { setExFilter(f); setExVisible(true); }, 220);
  };
  const goSlide = (dir: 1 | -1) => {
    if (isSliding || slides.length === 0) return;
    const next = (currentSlide + dir + slides.length) % slides.length;
    setIsSliding(true); setCurrentSlide(next); setTimeout(() => setIsSliding(false), 600);
  };
  // Below-the-fold sections are React.lazy — their DOM node may not exist yet the
  // instant a nav link is clicked (its chunk is still downloading), so retry across a
  // few frames instead of silently no-op'ing on a null getElementById.
  const scrollToId = (id: string, opts: ScrollIntoViewOptions, tries = 30) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView(opts); return; }
    if (tries > 0) requestAnimationFrame(() => scrollToId(id, opts, tries - 1));
  };
  const scrollTo = (id: string) => { scrollToId(id, { behavior: "smooth" }); setMenuOpen(false); };
  const scrollToActivity = (activityId: number) => {
    scrollToId(`activity-photo-${activityId}`, { behavior: "smooth", block: "center" });
    setHighlightedPhotoId(activityId);
  };

  const triggerUpload = (target: string, label?: string) => { pendingTarget.current = target; pendingLabel.current = label; fileInputRef.current?.click(); };

  const applyImageUrl = (key: string, url: string, thumbUrl?: string) => {
    setImageUrls((p) => ({ ...p, [key]: url, ...(thumbUrl ? { [`${key}-thumb`]: thumbUrl } : {}) }));
    if (key === "hero") {
      const i = new window.Image();
      i.onload = () => setHeroAspectRatio(i.naturalWidth / i.naturalHeight);
      i.src = url;
    }
  };

  // Images uploaded before thumbnails existed only have the full-size file — grids
  // would keep pulling those down at full size until re-uploaded. This backfills a
  // "<key>-thumb" for every such key, one at a time, from inside an authenticated
  // edit-mode session (this sandbox has no network path to Supabase to run it itself).
  // If every image already has a thumb (e.g. after a prior run, or after bumping
  // THUMB_MAX_PX/quality in supabase.ts), the same button regenerates all of them —
  // upload uses upsert, so overwriting an existing thumb is safe.
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null);
  const allImageKeys = Object.keys(imageUrls).filter((k) => !k.endsWith("-thumb"));
  const keysNeedingThumbs = allImageKeys.filter((k) => !imageUrls[`${k}-thumb`]);
  const isRegenerate = keysNeedingThumbs.length === 0;
  const backfillTargets = isRegenerate ? allImageKeys : keysNeedingThumbs;
  const runThumbnailBackfill = async () => {
    const token = editTokenRef.current;
    if (!token) { alert("편집 권한이 필요합니다. 다시 로그인해주세요."); return; }
    const keys = backfillTargets;
    setBackfillProgress({ done: 0, total: keys.length });
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const thumbUrl = await backfillThumbnail(key, imageUrls[key], token);
        setImageUrls((p) => ({ ...p, [`${key}-thumb`]: thumbUrl }));
      } catch (err) {
        console.error(`[Backfill] failed for ${key}:`, err);
      }
      setBackfillProgress({ done: i + 1, total: keys.length });
    }
    setTimeout(() => setBackfillProgress(null), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const target = pendingTarget.current; if (!target) return;
    const label = pendingLabel.current;
    e.target.value = "";
    const token = editTokenRef.current;
    if (!token) { alert("편집 권한이 필요합니다. 다시 로그인해주세요."); return; }
    setUploadingTarget(target);
    try {
      const { url, thumbUrl } = await uploadImage(target, file, token, label);
      applyImageUrl(target, url, thumbUrl);
    } catch (err) {
      console.error("[Upload] failed:", err);
      // Show image temporarily (base64) so user sees it, but mark as upload-failed
      // by NOT storing in imageUrls — show alert instead
      alert(`이미지 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}\n\n다시 시도하거나 이미지를 작게 줄여서 올려주세요.`);
    }
    setUploadingTarget(null);
  };

  const triggerMultiUpload = (photoId: number) => { pendingMultiTarget.current = photoId; multiFileInputRef.current?.click(); };

  const handleMultiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const photoId = pendingMultiTarget.current;
    e.target.value = "";
    if (!files || files.length === 0 || photoId === null) return;
    const token = editTokenRef.current;
    if (!token) { alert("편집 권한이 필요합니다. 다시 로그인해주세요."); return; }
    const photo = activityPhotos.find((p) => p.id === photoId);
    let nextSubId = Math.max(0, ...(photo?.extraPhotoIds ?? [])) + 1;
    setUploadingExtraFor(photoId);
    const addedIds: number[] = [];
    for (const file of Array.from(files)) {
      const subId = nextSubId++;
      try {
        const { url, thumbUrl } = await uploadImage(`activity-${photoId}-${subId}`, file, token, photo?.captionEn);
        applyImageUrl(`activity-${photoId}-${subId}`, url, thumbUrl);
        addedIds.push(subId);
      } catch (err) {
        console.error("[Upload] extra activity photo failed:", err);
        alert(`이미지 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      }
    }
    if (addedIds.length) {
      setActivityPhotos((p) => p.map((ph) => ph.id === photoId ? { ...ph, extraPhotoIds: [...(ph.extraPhotoIds ?? []), ...addedIds] } : ph));
    }
    setUploadingExtraFor(null);
  };

  /* CRUD */
  const updateWork = (id: number, f: keyof Artwork, v: string | boolean) => setArtworkList((p) => p.map((w) => w.id === id ? { ...w, [f]: v } : w));
  const addArtwork = () => { const newId = Math.max(0, ...artworkList.map((w) => w.id)) + 1; setArtworkList((p) => [...p, { id: newId, title: "새 작품", titleEn: "New Work", year: String(new Date().getFullYear()), medium: "재료", mediumEn: "Medium", size: "크기", image: "", category: "회화", categoryEn: "Painting", series: "", collected: false }]); setSelectedWorkId(newId); };
  const deleteWork = (id: number) => { if (!window.confirm("이 작품을 삭제하시겠습니까?")) return; setArtworkList((p) => p.filter((w) => w.id !== id)); if (selectedWorkId === id) setSelectedWorkId(null); };
  const addSeries = () => { const newId = Math.max(0, ...seriesList.map((s) => s.id)) + 1; setSeriesList((p) => [...p, { id: newId, name: "새 시리즈", nameEn: "New Series" }]); setEditingSeriesId(newId); };
  const updateSeries = (id: number, f: keyof Series, v: string) => setSeriesList((p) => p.map((s) => s.id === id ? { ...s, [f]: v } : s));
  const deleteSeries = (id: number) => { if (!window.confirm("이 시리즈를 삭제하시겠습니까?")) return; const s = seriesList.find((s) => s.id === id); setSeriesList((p) => p.filter((s) => s.id !== id)); if (selectedSeries === s?.name) setSelectedSeries("전체"); };
  const updateSlide = (id: number, f: keyof Slide, v: string) => setSlides((p) => p.map((s) => s.id === id ? { ...s, [f]: v } : s));
  const addSlide = () => { const newId = Math.max(0, ...slides.map((s) => s.id)) + 1; setSlides((p) => [...p, { id: newId, heading: "새 작가노트", headingEn: "New Statement", body: "내용을 입력하세요.", bodyEn: "Enter content here." }]); setCurrentSlide(slides.length); };
  const deleteSlide = (id: number) => { if (!window.confirm("이 작가노트 슬라이드를 삭제하시겠습니까?")) return; setSlides((p) => p.filter((s) => s.id !== id)); setCurrentSlide((p) => Math.max(0, p - 1)); };
  const addExhibition = () => { const newId = Math.max(0, ...exhibitionList.map((e) => e.id)) + 1; setExhibitionList((p) => [{ id: newId, year: String(new Date().getFullYear()), title: "새 항목", titleEn: "New Item", venue: "장소", venueEn: "Venue", location: "서울", tag: "개인전" }, ...p]); setEditingExId(newId); };
  const updateEx = (id: number, f: keyof ExhibitionEntry, v: string | number | undefined) => setExhibitionList((p) => p.map((e) => e.id === id ? { ...e, [f]: v } : e));
  const deleteEx = (id: number) => { if (!window.confirm("이 항목을 삭제하시겠습니까?")) return; setExhibitionList((p) => p.filter((e) => e.id !== id)); if (editingExId === id) setEditingExId(null); };
  const addCurrentEx = () => { const newId = Math.max(0, ...currentExList.map((e) => e.id)) + 1; setCurrentExList((p) => [...p, { id: newId, title: "새 전시", titleEn: "New Exhibition", venue: "장소", venueEn: "Venue", location: "서울", locationEn: "Seoul", startDate: "2025.01.01", endDate: "2025.02.01", status: "예정", tag: "개인전", visible: true }]); setEditingCurrentId(newId); };
  const toggleCurrentExVisible = (id: number) => setCurrentExList((p) => p.map((e) => e.id === id ? { ...e, visible: !e.visible } : e));
  const updateCurrentEx = (id: number, f: keyof CurrentExhibition, v: string) => setCurrentExList((p) => p.map((e) => e.id === id ? { ...e, [f]: v } : e));
  const deleteCurrentEx = (id: number) => { if (!window.confirm("이 전시를 삭제하시겠습니까?")) return; setCurrentExList((p) => p.filter((e) => e.id !== id)); if (editingCurrentId === id) setEditingCurrentId(null); };
  const addActivityPhoto = () => { const newId = Math.max(0, ...activityPhotos.map((p) => p.id)) + 1; setActivityPhotos((p) => [...p, { id: newId, caption: "새 사진", captionEn: "New Photo" }]); };
  const deleteActivityPhoto = (id: number) => { if (!window.confirm("이 사진을 삭제하시겠습니까?")) return; setActivityPhotos((p) => p.filter((ph) => ph.id !== id)); };
  const updateActivityPhoto = (id: number, f: keyof ActivityPhoto, v: string) => setActivityPhotos((p) => p.map((ph) => ph.id === id ? { ...ph, [f]: v } : ph));
  // Swaps just the two underlying image URLs so no re-upload is needed — the
  // "cover" slot is always physically stored at the `activity-{id}` key.
  const setPhotoAsCover = (photoId: number, subId: number) => {
    const coverKey = `activity-${photoId}`;
    const extraKey = `activity-${photoId}-${subId}`;
    setImageUrls((prev) => {
      const next = { ...prev };
      const coverUrl = next[coverKey];
      const extraUrl = next[extraKey];
      if (extraUrl) next[coverKey] = extraUrl; else delete next[coverKey];
      if (coverUrl) next[extraKey] = coverUrl; else delete next[extraKey];
      return next;
    });
  };
  const deleteExtraPhoto = (photoId: number, subId: number) => {
    if (!window.confirm("이 사진을 삭제하시겠습니까?")) return;
    setActivityPhotos((p) => p.map((ph) => ph.id === photoId ? { ...ph, extraPhotoIds: (ph.extraPhotoIds ?? []).filter((id) => id !== subId) } : ph));
  };
  const reorderExtraPhotos = (photoId: number, newIds: number[]) => setActivityPhotos((p) => p.map((ph) => ph.id === photoId ? { ...ph, extraPhotoIds: newIds } : ph));
  const addVideo = () => { const newId = Math.max(0, ...videoList.map((v) => v.id)) + 1; setVideoList((p) => [...p, { id: newId, youtubeUrl: "", title: "새 영상", titleEn: "New Video", description: "설명", descriptionEn: "Description" }]); setEditingVideoId(newId); };
  const updateVideoField = (id: number, f: keyof VideoEntry, v: string) => setVideoList((p) => p.map((vid) => vid.id === id ? { ...vid, [f]: v } : vid));
  const deleteVideo = (id: number) => { if (!window.confirm("이 영상을 삭제하시겠습니까?")) return; setVideoList((p) => p.filter((v) => v.id !== id)); if (editingVideoId === id) setEditingVideoId(null); };
  const updateContact = (id: string, patch: Partial<ContactItem>) => setContactItems((p) => p.map((c) => c.id === id ? { ...c, ...patch } : c));
  const toggleContactVisibility = (id: string) => setContactItems((p) => p.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
  const addPress = () => { const newId = Math.max(0, ...pressList.map((p) => p.id)) + 1; setPressList((p) => [{ id: newId, url: "", outlet: "", outletEn: "", title: "새 보도자료", titleEn: "New Press Item", date: String(new Date().getFullYear()), image: "", type: "기사" }, ...p]); setEditingPressId(newId); };
  const updatePress = (id: number, f: keyof PressEntry, v: string) => setPressList((p) => p.map((item) => item.id === id ? { ...item, [f]: v } : item));
  const deletePress = (id: number) => { if (!window.confirm("이 보도자료를 삭제하시겠습니까?")) return; setPressList((p) => p.filter((item) => item.id !== id)); if (editingPressId === id) setEditingPressId(null); };
  const fetchPressPreview = async (id: number, url: string) => {
    const token = editTokenRef.current;
    if (!token) { alert("편집 권한이 필요합니다. 다시 로그인해주세요."); return; }
    if (!url.trim()) { alert(u.pressNoUrl); return; }
    setFetchingPressId(id);
    try {
      const { title, image, siteName } = await unfurlPress(url.trim(), token);
      setPressList((p) => p.map((item) => item.id === id ? {
        ...item,
        title: title || item.title,
        outlet: siteName || item.outlet,
        image: image || item.image,
      } : item));
    } catch (err) {
      console.error("[Press] unfurl failed:", err);
      // Surface the server's actual reason (e.g. a specific HTTP status, or the site
      // blocking non-browser fetches) instead of always showing the same canned text —
      // otherwise every failure looks identical and there's no way to tell what happened.
      const detail = err instanceof Error && err.message ? err.message : null;
      alert(detail ? `${u.pressFetchError}\n(${detail})` : u.pressFetchError);
    }
    setFetchingPressId(null);
  };

  /* ── Translate all empty EN fields from their KO counterpart, in one batched call ── */
  const translateAll = async () => {
    const token = editTokenRef.current;
    if (!token) { alert("편집 권한이 필요합니다. 다시 로그인해주세요."); return; }
    if (isTranslating) return;

    const jobs: { ko: string; apply: (en: string) => void }[] = [];
    const addJob = (ko: string | undefined, en: string | undefined, apply: (en: string) => void) => {
      if (ko && ko.trim() && !(en && en.trim())) jobs.push({ ko, apply });
    };

    const contentRec = content as Record<string, string>;
    for (const key of Object.keys(contentRec)) {
      if (key.endsWith("En")) continue;
      const enKey = key + "En";
      if (!(enKey in contentRec)) continue;
      addJob(contentRec[key], contentRec[enKey], (en) => updateContent(enKey as ContentKey, en));
    }
    currentExList.forEach((ex) => {
      addJob(ex.title, ex.titleEn, (en) => updateCurrentEx(ex.id, "titleEn", en));
      addJob(ex.venue, ex.venueEn, (en) => updateCurrentEx(ex.id, "venueEn", en));
      addJob(ex.location, ex.locationEn, (en) => updateCurrentEx(ex.id, "locationEn", en));
    });
    artworkList.forEach((w) => {
      addJob(w.title, w.titleEn, (en) => updateWork(w.id, "titleEn", en));
      addJob(w.medium, w.mediumEn, (en) => updateWork(w.id, "mediumEn", en));
      addJob(w.category, w.categoryEn, (en) => updateWork(w.id, "categoryEn", en));
      addJob(w.description, w.descriptionEn, (en) => updateWork(w.id, "descriptionEn", en));
    });
    seriesList.forEach((s) => {
      addJob(s.name, s.nameEn, (en) => updateSeries(s.id, "nameEn", en));
    });
    slides.forEach((sl) => {
      addJob(sl.heading, sl.headingEn, (en) => updateSlide(sl.id, "headingEn", en));
      addJob(sl.body, sl.bodyEn, (en) => updateSlide(sl.id, "bodyEn", en));
    });
    exhibitionList.forEach((ex) => {
      addJob(ex.title, ex.titleEn, (en) => updateEx(ex.id, "titleEn", en));
      addJob(ex.venue, ex.venueEn, (en) => updateEx(ex.id, "venueEn", en));
    });
    activityPhotos.forEach((p) => {
      addJob(p.caption, p.captionEn, (en) => updateActivityPhoto(p.id, "captionEn", en));
    });
    videoList.forEach((v) => {
      addJob(v.title, v.titleEn, (en) => updateVideoField(v.id, "titleEn", en));
      addJob(v.description, v.descriptionEn, (en) => updateVideoField(v.id, "descriptionEn", en));
    });
    pressList.forEach((p) => {
      addJob(p.title, p.titleEn, (en) => updatePress(p.id, "titleEn", en));
      addJob(p.outlet, p.outletEn, (en) => updatePress(p.id, "outletEn", en));
    });

    if (jobs.length === 0) { alert("번역할 내용이 없습니다 — 비어있는 영문 항목이 없어요."); return; }

    setIsTranslating(true);
    try {
      const translations = await translateTexts(jobs.map((j) => j.ko), token);
      jobs.forEach((job, i) => { if (translations[i]) job.apply(translations[i]); });
    } catch (err) {
      alert(`번역 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    }
    setIsTranslating(false);
  };

  const filteredWorks = selectedSeries === "전체" ? artworkList : artworkList.filter((a) => { const s = seriesList.find((s) => s.name === selectedSeries); return s ? a.series === s.name : false; });
  const filteredEx = exFilter === "전체" ? exhibitionList : exhibitionList.filter((e) => e.tag === exFilter);

  const navItems: [string, string][] = [
    ["current-exhibitions", u.navCurrent], ["statement", u.navStatement], ["works", u.navWorks], ["exhibitions", u.navExhibitions],
    // Press hides itself entirely with no items outside edit mode (see Press.tsx) — skip its nav link too, or it'd point nowhere.
    ...(pressList.length > 0 || editMode ? [["press", u.navPress] as [string, string]] : []),
    ["activities", u.navActivities], ["videos", u.navVideo], ["contact", u.navContact],
  ];

  const contextValue: PortfolioContextValue = {
    lang, u, MONO, SERIF, SANS, hSize,
    content, updateContent, c, C: InlineField,
    editMode, img, imgThumb, uploadingTarget,
    dragSrc, dragOverKey, setDragOverKey,
    scrollTo, scrollToActivity, triggerUpload, openLightbox,
    contactItems,
  };

  return (
    <PortfolioContext.Provider value={contextValue}>
      <div className="app-root min-h-screen bg-background text-foreground" style={SANS}>
        <style>{GLOBAL_CSS}</style>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <input ref={multiFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMultiFileChange} />

        {/* ── Video fullscreen overlay ── */}
        {fullscreenVideoYtId && (
          <div ref={videoOverlayRef} tabIndex={-1} className="fixed inset-0 z-[350] bg-black flex flex-col outline-none">
            <div className="flex items-center justify-end px-4 py-2.5 shrink-0">
              <button onClick={() => setFullscreenVideoYtId(null)}
                className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-3 py-1.5 border border-white/20 hover:border-white/40 transition-colors" style={MONO}>
                <X size={13} />{u.lbClose}
              </button>
            </div>
            <div className="flex-1">
              <iframe
                src={`https://www.youtube.com/embed/${fullscreenVideoYtId}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        )}

        {/* ── DB loading overlay ── */}
        {isLoading && (
          <div className="fixed inset-0 z-[400] bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border border-accent/40 border-t-accent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground tracking-widest" style={MONO}>loading…</span>
            </div>
          </div>
        )}

        {/* ── Lightbox ── */}
        {lightboxSrc && (
          <Suspense fallback={null}>
          <Lightbox
            src={lightboxSrc}
            scale={lbScale}
            offset={lbOffset}
            dragging={lbDragging}
            showZoom={lbShowZoom}
            imgRef={lbImgRef}
            containerRef={lbContainerRef}
            onClose={() => setLightboxSrc(null)}
            onZoomIn={lbZoomIn}
            onZoomOut={lbZoomOut}
            onReset={lbReset}
            onWheel={handleLbWheel}
            onMouseDown={handleLbMouseDown}
            onMouseMove={handleLbMouseMove}
            onMouseUp={handleLbMouseUp}
            onTouchStart={handleLbTouchStart}
            onTouchMove={handleLbTouchMove}
            onTouchEnd={handleLbTouchEnd}
            onDoubleClick={() => lbScale === 1 ? applyLbScale(2) : lbReset()}
          />
          </Suspense>
        )}

        {/* ── Password modal ── */}
        {showPwModal && (
          <Suspense fallback={null}>
          <PasswordModal
            pwInput={pwInput}
            setPwInput={setPwInput}
            pwErrorMsg={pwErrorMsg}
            setPwErrorMsg={setPwErrorMsg}
            showPw={showPw}
            setShowPw={setShowPw}
            pwSubmitting={pwSubmitting}
            onSubmit={handlePwSubmit}
            onCancel={() => { setShowPwModal(false); setPwInput(""); setPwErrorMsg(""); }}
          />
          </Suspense>
        )}

        {/* ── Edit banner ── */}
        {editMode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-accent text-accent-foreground px-5 py-2.5 shadow-lg" style={MONO}>
            <Edit3 size={13} /><span className="text-xs tracking-widest hidden sm:inline">{u.editBanner}</span>
            {(backfillTargets.length > 0 || backfillProgress) && (
              <button onClick={runThumbnailBackfill} disabled={!!backfillProgress} className="ml-2 sm:ml-4 flex items-center gap-1.5 text-xs bg-accent-foreground/15 hover:bg-accent-foreground/25 px-3 py-1 transition-colors disabled:opacity-60" style={MONO}>
                {backfillProgress ? `${u.thumbBackfilling} ${backfillProgress.done}/${backfillProgress.total}` : `${isRegenerate ? u.thumbRegenerate : u.thumbBackfill} (${backfillTargets.length})`}
              </button>
            )}
            <button onClick={exitEditMode} className="ml-2 sm:ml-4 flex items-center gap-1.5 text-xs bg-accent-foreground/15 hover:bg-accent-foreground/25 px-3 py-1 transition-colors"><Check size={11} />{u.editDone}</button>
          </div>
        )}

        {/* ── NAV ── */}
        <nav ref={navRef} className={`nav-bar fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled || menuOpen ? "bg-background/95 backdrop-blur-sm border-b border-border" : ""}`}
          style={{ height: "64px" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between h-full">
            <button onClick={() => scrollTo("hero")} style={{ ...SERIF, fontWeight: 400, letterSpacing: lang === "en" ? "0.08em" : "0.05em", fontSize: lang === "en" ? "1.1rem" : "1rem" }} className="text-foreground hover:text-accent transition-colors shrink-0">
              {c("heroName")}
            </button>
            <div className="hidden lg:flex items-center gap-7">
              {navItems.map(([id, label]) => <button key={id} onClick={() => scrollTo(id)} className="text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase" style={MONO}>{label}</button>)}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {isSupabaseReady && (
                <span className={`text-xs transition-all duration-500 ${isSaving ? "text-accent/70 opacity-100" : "opacity-0"}`} style={MONO}>
                  {isSaving ? "saving…" : ""}
                </span>
              )}
              {editMode && (
                <button onClick={translateAll} disabled={isTranslating} title="전체 번역" aria-label="전체 번역" className="flex items-center gap-1.5 text-xs tracking-widest border border-accent text-accent px-2.5 py-1.5 hover:bg-accent/10 transition-colors disabled:opacity-50" style={MONO}>
                  <Languages size={13} /><span className="hidden sm:inline">{isTranslating ? "번역 중…" : "전체 번역"}</span>
                </button>
              )}
              <button onClick={handleLangClick} aria-label={u.langSwitch} className={`text-xs tracking-widest border px-2.5 py-1.5 transition-all ${editMode ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`} style={MONO}>{u.langLabel}</button>
              <button className="lg:hidden text-foreground p-1" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? u.menuClose : u.menuOpen}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
            </div>
          </div>
          {menuOpen && (
            <div className="lg:hidden bg-background/98 border-t border-border px-6 py-6 flex flex-col gap-5">
              {navItems.map(([id, label]) => <button key={id} onClick={() => scrollTo(id)} className="text-left text-foreground text-sm tracking-widest uppercase" style={MONO}>{label}</button>)}
            </div>
          )}
        </nav>

        <Hero
          heroAspectRatio={heroAspectRatio}
          heroCaption={heroCaption}
          heroCaptionEn={heroCaptionEn}
          setHeroCaption={setHeroCaption}
          setHeroCaptionEn={setHeroCaptionEn}
          editingCaption={editingCaption}
          setEditingCaption={setEditingCaption}
        />

        {/* ── Featured-in wordmark bar — press has no dedicated logo asset, so this
             lists the outlet names themselves rather than image logos ── */}
        {pressList.length > 0 && (
          <div className="border-t border-border py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5">
              <span className="text-xs text-muted-foreground tracking-widest uppercase shrink-0" style={MONO}>{u.pressFeaturedIn}</span>
              {Array.from(new Set(pressList.map((p) => (lang === "ko" ? p.outlet : (p.outletEn || p.outlet))))).map((name) => (
                <span key={name} className="text-sm text-foreground/70 font-light">{name}</span>
              ))}
            </div>
          </div>
        )}

        <CurrentExhibitions
          currentExList={currentExList}
          setCurrentExList={setCurrentExList}
          editingCurrentId={editingCurrentId}
          setEditingCurrentId={setEditingCurrentId}
          showPastEx={showPastEx}
          setShowPastEx={setShowPastEx}
          addCurrentEx={addCurrentEx}
          toggleCurrentExVisible={toggleCurrentExVisible}
          updateCurrentEx={updateCurrentEx}
          deleteCurrentEx={deleteCurrentEx}
        />

        <Suspense fallback={null}>
        <ArtistStatement
          slides={slides}
          currentSlide={currentSlide}
          setCurrentSlide={setCurrentSlide}
          isSliding={isSliding}
          addSlide={addSlide}
          deleteSlide={deleteSlide}
          updateSlide={updateSlide}
          goSlide={goSlide}
        />
        </Suspense>

        <Works
          artworkList={artworkList}
          setArtworkList={setArtworkList}
          selectedWorkId={selectedWorkId}
          setSelectedWorkId={setSelectedWorkId}
          seriesList={seriesList}
          setSeriesList={setSeriesList}
          selectedSeries={selectedSeries}
          setSelectedSeries={setSelectedSeries}
          editingSeriesId={editingSeriesId}
          setEditingSeriesId={setEditingSeriesId}
          filteredWorks={filteredWorks}
          addArtwork={addArtwork}
          deleteWork={deleteWork}
          updateWork={updateWork}
          addSeries={addSeries}
          updateSeries={updateSeries}
          deleteSeries={deleteSeries}
        />

        <Suspense fallback={null}>
        <Exhibitions
          exhibitionList={exhibitionList}
          setExhibitionList={setExhibitionList}
          filteredEx={filteredEx}
          exFilter={exFilter}
          exVisible={exVisible}
          editingExId={editingExId}
          setEditingExId={setEditingExId}
          activityPhotos={activityPhotos}
          changeExFilter={changeExFilter}
          addExhibition={addExhibition}
          updateEx={updateEx}
          deleteEx={deleteEx}
        />

        <Press
          pressList={pressList}
          setPressList={setPressList}
          editingPressId={editingPressId}
          setEditingPressId={setEditingPressId}
          fetchingPressId={fetchingPressId}
          addPress={addPress}
          updatePress={updatePress}
          deletePress={deletePress}
          fetchPressPreview={fetchPressPreview}
        />

        <Activities
          activityPhotos={activityPhotos}
          setActivityPhotos={setActivityPhotos}
          highlightedPhotoId={highlightedPhotoId}
          addActivityPhoto={addActivityPhoto}
          deleteActivityPhoto={deleteActivityPhoto}
          updateActivityPhoto={updateActivityPhoto}
          triggerMultiUpload={triggerMultiUpload}
          uploadingExtraFor={uploadingExtraFor}
          setPhotoAsCover={setPhotoAsCover}
          deleteExtraPhoto={deleteExtraPhoto}
          reorderExtraPhotos={reorderExtraPhotos}
        />

        <Video
          videoList={videoList}
          setVideoList={setVideoList}
          editingVideoId={editingVideoId}
          setEditingVideoId={setEditingVideoId}
          playingVideoId={playingVideoId}
          setPlayingVideoId={setPlayingVideoId}
          setFullscreenVideoYtId={setFullscreenVideoYtId}
          addVideo={addVideo}
          updateVideoField={updateVideoField}
          deleteVideo={deleteVideo}
        />

        <Contact
          contactItems={contactItems}
          setContactItems={setContactItems}
          editingContactId={editingContactId}
          setEditingContactId={setEditingContactId}
          updateContact={updateContact}
          toggleContactVisibility={toggleContactVisibility}
        />

        <Footer />
        </Suspense>
      </div>
    </PortfolioContext.Provider>
  );
}
