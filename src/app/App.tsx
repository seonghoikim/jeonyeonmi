import { useState, useEffect, useRef, useCallback } from "react";
import { loadPortfolio, savePortfolio, uploadImage, loginEditor, translateTexts, subscribePortfolio, isSupabaseReady, type PortfolioRow } from "../lib/supabase";
import { Menu, X, Edit3, Check, Languages } from "lucide-react";
import {
  MONO, serifOf, sansOf, hSize, GLOBAL_CSS,
  initContent, UI, initCurrentEx, initSeries, initArtworks, initSlides, initExhibitions, initActivityPhotos, initVideos, initContacts,
  type Lang, type ContentKey, type CurrentExhibition, type Artwork, type Series, type Slide, type ExhibitionEntry, type ActivityPhoto, type VideoEntry, type ContactItem,
} from "./data";
import { useGoogleAnalytics } from "./useGoogleAnalytics";
import { useSeoMeta } from "./useSeoMeta";
import { useModalLock } from "./useModalLock";
import { PortfolioContext, type PortfolioContextValue } from "./PortfolioContext";
import { Hero } from "./components/sections/Hero";
import { CurrentExhibitions } from "./components/sections/CurrentExhibitions";
import { Works } from "./components/sections/Works";
import { ArtistStatement } from "./components/sections/ArtistStatement";
import { Exhibitions } from "./components/sections/Exhibitions";
import { Activities } from "./components/sections/Activities";
import { Video } from "./components/sections/Video";
import { Contact } from "./components/sections/Contact";
import { Footer } from "./components/sections/Footer";
import { Lightbox } from "./components/sections/Lightbox";
import { PasswordModal } from "./components/sections/PasswordModal";
import { CvPrintView } from "./components/sections/CvPrintView";

export default function App() {
  useGoogleAnalytics();
  const [lang, setLang] = useState<Lang>(() => {
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
  const C = ({ field, multi = false, rows = 3, className = "" }: { field: ContentKey; multi?: boolean; rows?: number; className?: string; }) => {
    const enKey = (field + "En") as ContentKey;
    const af: ContentKey = lang === "en" && enKey in content ? enKey : field;
    const val = (content as Record<string, string>)[af] ?? "";
    if (!editMode) return <>{val}</>;
    if (multi) return <textarea value={val} rows={rows} onChange={(e) => updateContent(af, e.target.value)} className={`bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full ${className}`} style={SANS} />;
    return <input value={val} onChange={(e) => updateContent(af, e.target.value)} className={`bg-transparent border-b border-dashed border-accent/60 outline-none w-full ${className}`} />;
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

  const openLightbox = (src: string, showZoom = true) => { setLightboxSrc(src); setLbScale(1); setLbOffset({ x: 0, y: 0 }); setLbShowZoom(showZoom); };
  const lbStep = (s: number, dir: 1 | -1) => {
    const step = s >= 1 ? 0.05 : 0.15;
    return parseFloat((s + dir * step).toFixed(2));
  };
  const lbZoomIn = () => setLbScale((s) => Math.min(8, lbStep(s, 1)));
  const lbZoomOut = () => setLbScale((s) => Math.max(0.25, lbStep(s, -1)));
  const lbReset = () => { setLbScale(1); setLbOffset({ x: 0, y: 0 }); };

  const handleLbWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    setLbScale((s) => Math.max(0.25, Math.min(8, lbStep(s, dir))));
  };
  const handleLbMouseDown = (e: React.MouseEvent) => {
    setLbDragging(true);
    setLbDragStart({ x: e.clientX - lbOffset.x, y: e.clientY - lbOffset.y });
  };
  const handleLbMouseMove = (e: React.MouseEvent) => {
    if (!lbDragging) return;
    setLbOffset({ x: e.clientX - lbDragStart.x, y: e.clientY - lbDragStart.y });
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
      setLbScale(Math.max(0.25, Math.min(8, lbScaleAtPinch * (d / lbPinchDist))));
    } else if (e.touches.length === 1 && lbDragging) {
      setLbOffset({ x: e.touches[0].clientX - lbDragStart.x, y: e.touches[0].clientY - lbDragStart.y });
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
      if ((row.slides as Slide[])?.length) setSlides(row.slides as Slide[]);
      if ((row.exhibitions as ExhibitionEntry[])?.length) setExhibitionList(row.exhibitions as ExhibitionEntry[]);
      if ((row.activity_photos as ActivityPhoto[])?.length) setActivityPhotos(row.activity_photos as ActivityPhoto[]);
      if ((row.videos as VideoEntry[])?.length) setVideoList(row.videos as VideoEntry[]);
      if ((row.contacts as ContactItem[])?.length) setContactItems(row.contacts as ContactItem[]);
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
  useSeoMeta({ name: c("heroName"), description: c("heroDesc"), imageUrl: img("hero") });

  /* other state */
  const [currentExList, setCurrentExList] = useState(initCurrentEx);
  const [editingCurrentId, setEditingCurrentId] = useState<number | null>(null);
  const [showPastEx, setShowPastEx] = useState(true);

  const [artworkList, setArtworkList] = useState(initArtworks);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const [seriesList, setSeriesList] = useState(initSeries);
  const [selectedSeries, setSelectedSeries] = useState("전체");
  const [editingSeriesId, setEditingSeriesId] = useState<number | null>(null);
  const [heroAspectRatio, setHeroAspectRatio] = useState<number | null>(null);
  const [heroCaption, setHeroCaption] = useState("부유하는 기억 I, 2024");
  const [heroCaptionEn, setHeroCaptionEn] = useState("Floating Memory I, 2024");
  const [editingCaption, setEditingCaption] = useState(false);
  const [slides, setSlides] = useState(initSlides);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [exhibitionList, setExhibitionList] = useState(initExhibitions);
  const [exFilter, setExFilter] = useState<"전체" | "전시" | "수상" | "아트페어">("전체");
  const [exVisible, setExVisible] = useState(true);
  const [editingExId, setEditingExId] = useState<number | null>(null);
  const [activityPhotos, setActivityPhotos] = useState(initActivityPhotos);
  const [editingActivityCaption, setEditingActivityCaption] = useState<number | null>(null);
  const [highlightedPhotoId, setHighlightedPhotoId] = useState<number | null>(null);
  const [videoList, setVideoList] = useState(initVideos);
  const [editingVideoId, setEditingVideoId] = useState<number | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);
  const [fullscreenVideoYtId, setFullscreenVideoYtId] = useState<string | null>(null);
  const videoOverlayRef = useModalLock<HTMLDivElement>(!!fullscreenVideoYtId, () => setFullscreenVideoYtId(null));
  const [showCvPrint, setShowCvPrint] = useState(false);
  const [contactItems, setContactItems] = useState(initContacts);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
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
    activity_photos: activityPhotos, videos: videoList, contacts: contactItems,
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
    if (row.settings?.heroCaption) setHeroCaption(row.settings.heroCaption);
    if (row.settings?.heroCaptionEn) setHeroCaptionEn(row.settings.heroCaptionEn);
    if (row.image_urls && Object.keys(row.image_urls).length > 0) {
      setImageUrls(row.image_urls);
      const heroUrl = row.image_urls.hero;
      if (heroUrl) { const i = new window.Image(); i.onload = () => setHeroAspectRatio(i.naturalWidth / i.naturalHeight); i.src = heroUrl; }
    }
    if (row.updated_at) lastUpdatedAtRef.current = row.updated_at;
  }, []);

  /* ── DB: debounced auto-save (4 s after last change) — only while an editor session is active ── */
  useEffect(() => {
    if (isLoading || !editTokenRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      // If a save is already running, mark dirty and let it re-save on completion
      if (isSavingRef.current) { saveAgainRef.current = true; return; }
      // Loop: re-save if state changed while the previous save was in flight
      do {
        saveAgainRef.current = false;
        const token = editTokenRef.current;
        if (!token) break;
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
    }, 4000);
    return () => clearTimeout(saveTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, currentExList, artworkList, seriesList, slides, exhibitionList, activityPhotos, videoList, contactItems, heroCaption, heroCaptionEn, imageUrls, isLoading]);

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
     further save can fire from this tab, and require the password again to resume. ── */
  useEffect(() => {
    if (!editMode) { editTokenRef.current = null; setIsAuth(false); }
  }, [editMode]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h);
  }, []);
  useEffect(() => {
    if (currentSlide >= slides.length) setCurrentSlide(Math.max(0, slides.length - 1));
  }, [slides.length]);
  useEffect(() => {
    if (highlightedPhotoId != null) { const t = setTimeout(() => setHighlightedPhotoId(null), 2000); return () => clearTimeout(t); }
  }, [highlightedPhotoId]);

  const handleEditToggle = () => {
    if (editMode) { setEditMode(false); return; }
    if (isAuth) { setEditMode(true); return; }
    setShowPwModal(true);
  };
  const handleLangClick = () => {
    setLang((l) => l === "ko" ? "en" : "ko");
    const now = Date.now();
    langClickTs.current = [...langClickTs.current.filter((t) => now - t < 5000), now];
    if (langClickTs.current.length >= 5) {
      langClickTs.current = [];
      if (editMode) { setEditMode(false); }
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
  const changeExFilter = (f: "전체" | "전시" | "수상" | "아트페어") => {
    if (f === exFilter) return;
    setExVisible(false); setTimeout(() => { setExFilter(f); setExVisible(true); }, 220);
  };
  const goSlide = (dir: 1 | -1) => {
    if (isSliding) return;
    const next = currentSlide + dir;
    if (next < 0 || next >= slides.length) return;
    setIsSliding(true); setCurrentSlide(next); setTimeout(() => setIsSliding(false), 600);
  };
  const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); };
  const scrollToActivity = (activityId: number) => {
    document.getElementById(`activity-photo-${activityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedPhotoId(activityId);
  };

  const triggerUpload = (target: string, label?: string) => { pendingTarget.current = target; pendingLabel.current = label; fileInputRef.current?.click(); };

  const applyImageUrl = (key: string, url: string) => {
    setImageUrls((p) => ({ ...p, [key]: url }));
    if (key === "hero") {
      const i = new window.Image();
      i.onload = () => setHeroAspectRatio(i.naturalWidth / i.naturalHeight);
      i.src = url;
    }
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
      const url = await uploadImage(target, file, token, label);
      applyImageUrl(target, url);
    } catch (err) {
      console.error("[Upload] failed:", err);
      // Show image temporarily (base64) so user sees it, but mark as upload-failed
      // by NOT storing in imageUrls — show alert instead
      alert(`이미지 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}\n\n다시 시도하거나 이미지를 작게 줄여서 올려주세요.`);
    }
    setUploadingTarget(null);
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
  const addExhibition = () => { const newId = Math.max(0, ...exhibitionList.map((e) => e.id)) + 1; setExhibitionList((p) => [{ id: newId, year: String(new Date().getFullYear()), title: "새 항목", titleEn: "New Item", venue: "장소", venueEn: "Venue", location: "서울", tag: "전시" }, ...p]); setEditingExId(newId); };
  const updateEx = (id: number, f: keyof ExhibitionEntry, v: string | number | undefined) => setExhibitionList((p) => p.map((e) => e.id === id ? { ...e, [f]: v } : e));
  const deleteEx = (id: number) => { if (!window.confirm("이 항목을 삭제하시겠습니까?")) return; setExhibitionList((p) => p.filter((e) => e.id !== id)); if (editingExId === id) setEditingExId(null); };
  const addCurrentEx = () => { const newId = Math.max(0, ...currentExList.map((e) => e.id)) + 1; setCurrentExList((p) => [...p, { id: newId, title: "새 전시", titleEn: "New Exhibition", venue: "장소", venueEn: "Venue", location: "서울", locationEn: "Seoul", startDate: "2025.01.01", endDate: "2025.02.01", status: "예정", visible: true }]); setEditingCurrentId(newId); };
  const toggleCurrentExVisible = (id: number) => setCurrentExList((p) => p.map((e) => e.id === id ? { ...e, visible: !e.visible } : e));
  const updateCurrentEx = (id: number, f: keyof CurrentExhibition, v: string) => setCurrentExList((p) => p.map((e) => e.id === id ? { ...e, [f]: v } : e));
  const deleteCurrentEx = (id: number) => { if (!window.confirm("이 전시를 삭제하시겠습니까?")) return; setCurrentExList((p) => p.filter((e) => e.id !== id)); if (editingCurrentId === id) setEditingCurrentId(null); };
  const addActivityPhoto = () => { const newId = Math.max(0, ...activityPhotos.map((p) => p.id)) + 1; setActivityPhotos((p) => [...p, { id: newId, caption: "새 사진", captionEn: "New Photo" }]); };
  const deleteActivityPhoto = (id: number) => { if (!window.confirm("이 사진을 삭제하시겠습니까?")) return; setActivityPhotos((p) => p.filter((ph) => ph.id !== id)); };
  const updateActivityPhoto = (id: number, f: keyof ActivityPhoto, v: string) => setActivityPhotos((p) => p.map((ph) => ph.id === id ? { ...ph, [f]: v } : ph));
  const addVideo = () => { const newId = Math.max(0, ...videoList.map((v) => v.id)) + 1; setVideoList((p) => [...p, { id: newId, youtubeUrl: "", title: "새 영상", titleEn: "New Video", description: "설명", descriptionEn: "Description" }]); setEditingVideoId(newId); };
  const updateVideoField = (id: number, f: keyof VideoEntry, v: string) => setVideoList((p) => p.map((vid) => vid.id === id ? { ...vid, [f]: v } : vid));
  const deleteVideo = (id: number) => { if (!window.confirm("이 영상을 삭제하시겠습니까?")) return; setVideoList((p) => p.filter((v) => v.id !== id)); if (editingVideoId === id) setEditingVideoId(null); };
  const updateContact = (id: string, patch: Partial<ContactItem>) => setContactItems((p) => p.map((c) => c.id === id ? { ...c, ...patch } : c));
  const toggleContactVisibility = (id: string) => setContactItems((p) => p.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));

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

  const navItems: [string, string][] = [["current-exhibitions", u.navCurrent], ["works", u.navWorks], ["statement", u.navStatement], ["exhibitions", u.navExhibitions], ["contact", u.navContact]];

  const contextValue: PortfolioContextValue = {
    lang, u, MONO, SERIF, SANS, hSize,
    content, updateContent, c, C,
    editMode, img, uploadingTarget,
    dragSrc, dragOverKey, setDragOverKey,
    scrollTo, scrollToActivity, triggerUpload, openLightbox,
    contactItems,
  };

  return (
    <PortfolioContext.Provider value={contextValue}>
      <div className="app-root min-h-screen bg-background text-foreground" style={SANS}>
        <style>{GLOBAL_CSS}</style>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

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
          <Lightbox
            src={lightboxSrc}
            scale={lbScale}
            offset={lbOffset}
            dragging={lbDragging}
            showZoom={lbShowZoom}
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
            onDoubleClick={() => lbScale === 1 ? setLbScale(2) : lbReset()}
          />
        )}

        {/* ── Password modal ── */}
        {showPwModal && (
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
        )}

        {/* ── Edit banner ── */}
        {editMode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-accent text-accent-foreground px-5 py-2.5 shadow-lg" style={MONO}>
            <Edit3 size={13} /><span className="text-xs tracking-widest hidden sm:inline">{u.editBanner}</span>
            <button onClick={() => setEditMode(false)} className="ml-2 sm:ml-4 flex items-center gap-1.5 text-xs bg-accent-foreground/15 hover:bg-accent-foreground/25 px-3 py-1 transition-colors"><Check size={11} />{u.editDone}</button>
          </div>
        )}

        {/* ── NAV ── */}
        <nav className={`nav-bar fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-background/95 backdrop-blur-sm border-b border-border" : ""}`}
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
                <button onClick={translateAll} disabled={isTranslating} title="전체 번역" className="flex items-center gap-1.5 text-xs tracking-widest border border-accent text-accent px-2.5 py-1.5 hover:bg-accent/10 transition-colors disabled:opacity-50" style={MONO}>
                  <Languages size={13} /><span className="hidden sm:inline">{isTranslating ? "번역 중…" : "전체 번역"}</span>
                </button>
              )}
              <button onClick={handleLangClick} className={`text-xs tracking-widest border px-2.5 py-1.5 transition-all ${editMode ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`} style={MONO}>{u.langLabel}</button>
              <button className="lg:hidden text-foreground p-1" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
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
          onDownloadCv={() => setShowCvPrint(true)}
        />

        <CvPrintView
          show={showCvPrint}
          onClose={() => setShowCvPrint(false)}
          lang={lang}
          u={u}
          name={lang === "ko" ? content.heroName : content.heroNameEn}
          contacts={contactItems.filter((item) => item.visible)}
          current={currentExList.filter((ex) => ex.status !== "지난전시" && ex.visible)}
          history={exhibitionList}
        />

        <Activities
          activityPhotos={activityPhotos}
          setActivityPhotos={setActivityPhotos}
          editingActivityCaption={editingActivityCaption}
          setEditingActivityCaption={setEditingActivityCaption}
          highlightedPhotoId={highlightedPhotoId}
          addActivityPhoto={addActivityPhoto}
          deleteActivityPhoto={deleteActivityPhoto}
          updateActivityPhoto={updateActivityPhoto}
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
      </div>
    </PortfolioContext.Provider>
  );
}
