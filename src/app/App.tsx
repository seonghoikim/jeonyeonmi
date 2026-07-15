import { useState, useEffect, useRef, useCallback } from "react";
import { loadPortfolio, savePortfolio, uploadImage, loginEditor, subscribePortfolio, isSupabaseReady, type PortfolioRow } from "../lib/supabase";
import {
  Menu, X, ArrowUpRight, Mail, Instagram, Phone, Upload,
  Edit3, Check, Plus, Trash2, ChevronLeft, ChevronRight,
  Lock, Eye, EyeOff, Play, Link2, Globe,
  Maximize2, ZoomIn, ZoomOut, RotateCcw, GripVertical,
} from "lucide-react";

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

/* ─── font helpers ───────────────────────────────────── */
const MONO = { fontFamily: "'DM Mono', monospace" };
// Heading: same family as body but ultra-light + wide tracking for distinction
const serifOf = (lang: Lang) =>
  lang === "ko"
    ? { fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 200, letterSpacing: "0.04em" }
    : { fontFamily: "'Inter', sans-serif", fontWeight: 200, letterSpacing: "0.08em" };
const sansOf = (lang: Lang) =>
  lang === "ko"
    ? { fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300 }
    : { fontFamily: "'Inter', sans-serif", fontWeight: 300 };
const hSize = (ko: string, en: string, lang: Lang) => (lang === "ko" ? ko : en);

const getYoutubeId = (url: string) =>
  url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/)?.[1] ?? null;

/* ─── types ─────────────────────────────────────────── */
type Lang = "ko" | "en";
type ContentKey = keyof typeof initContent;
type CurrentExhibition = { id: number; title: string; titleEn: string; venue: string; venueEn: string; location: string; locationEn: string; startDate: string; endDate: string; status: "진행중" | "예정" | "지난전시"; visible: boolean; url?: string; };
type Artwork = { id: number; title: string; titleEn: string; year: string; medium: string; mediumEn: string; size: string; image: string; category: string; categoryEn: string; series: string; collected: boolean; };
type Series = { id: number; name: string; nameEn: string; };
type Slide = { id: number; heading: string; headingEn: string; body: string; bodyEn: string; };
type ExhibitionEntry = { id: number; year: string; title: string; titleEn: string; venue: string; venueEn: string; location: string; tag: "전시" | "수상" | "아트페어"; activityId?: number; };
type ActivityPhoto = { id: number; caption: string; captionEn: string; };
type VideoEntry = { id: number; youtubeUrl: string; title: string; titleEn: string; description: string; descriptionEn: string; };
type ContactItem = { id: string; type: "email" | "phone" | "instagram" | "blog"; labelKo: string; labelEn: string; display: string; href: string; visible: boolean; };

/* ─── page content ───────────────────────────────────── */
const initContent = {
  heroName: "전연미", heroNameEn: "Jeon Yeon-mi",
  heroSub: "JEON YEON-MI", heroSubEn: "JEON YEON-MI",
  heroDesc: "형태와 기억 사이, 보이지 않는 경계를 탐구하는 한국 현대미술 작가",
  heroDescEn: "A Korean contemporary artist exploring invisible boundaries between form and memory.",
  heroCta: "작품 보기", heroCtaEn: "View Works",
  s01label: "01 — 현재 전시 · 예정", s01labelEn: "01 — Current · Upcoming",
  s01heading: "전시 일정", s01headingEn: "Exhibition Schedule",
  s02label: "02 — 작품", s02labelEn: "02 — Works",
  s02heading: "Selected Works", s02headingEn: "Selected Works",
  s03label: "03 — 작가노트", s03labelEn: "03 — Statement",
  s03heading: "Artist Statement", s03headingEn: "Artist Statement",
  s04label: "04 — 전시 및 수상", s04labelEn: "04 — Exhibitions & Awards",
  s04heading: "전시 및 수상이력", s04headingEn: "Exhibitions & Awards",
  s05label: "05 — 활동", s05labelEn: "05 — Activities",
  s05heading: "Activities", s05headingEn: "Activities",
  s06label: "06 — 영상", s06labelEn: "06 — Video",
  s06heading: "Video", s06headingEn: "Video",
  s07label: "07 — 연락처", s07labelEn: "07 — Contact",
  s07heading: "작품 문의 및\n협업 제안", s07headingEn: "Inquiries &\nCollaboration",
  s07desc: "전시, 아트페어, 기관 협업, 작품 구입에 관한 문의는 아래 연락처를 통해 주시기 바랍니다.",
  s07descEn: "For exhibition, art fair, institutional collaboration, and artwork purchase inquiries, please use the contacts below.",
  footerCopyright: "© 2024 전연미. All rights reserved.",
  footerCopyrightEn: "© 2024 Jeon Yeon-mi. All rights reserved.",
  footerLocation: "서울특별시 종로구",
  footerLocationEn: "Jongno-gu, Seoul",
};

/* ─── UI labels ──────────────────────────────────────── */
const UI = {
  ko: {
    langLabel: "EN",
    navCurrent: "현재 전시", navWorks: "작품", navStatement: "작가노트", navExhibitions: "전시이력", navContact: "연락처",
    currentAdd: "전시 추가", currentUpload: "포스터 교체", currentUploading: "업로드 중…",
    statusOngoing: "진행중", statusUpcoming: "예정", statusPast: "지난전시", viewMore: "자세히 보기",
    showPastEx: "지난 전시 보기", hidePastEx: "접기",
    worksCollected: "컬렉션", worksNotCollected: "미수집", fieldCollected: "소장",
    worksAdd: "작품 추가", worksAll: "전체", seriesAdd: "시리즈 추가",
    worksUpload: "이미지 교체", worksUploading: "업로드 중…",
    worksInquiry: "작품 문의 →", worksDelete: "삭제", worksNoImg: "이미지 없음",
    worksViewOriginal: "원본 보기",
    fieldYear: "연도", fieldMedium: "재료", fieldSize: "크기", fieldCategory: "분류", fieldSeries: "시리즈",
    statAddSlide: "슬라이드 추가", statFirstSlide: "첫 슬라이드 추가",
    statNone: "작가노트가 없습니다", statDeleteSlide: "이 슬라이드 삭제",
    statUpload: "이미지 교체", statUploading: "업로드 중…",
    exAdd: "항목 추가", exAll: "전체", exExhibition: "전시", exAward: "수상", exFair: "아트페어", exNoLink: "연결 없음",
    activityAdd: "사진 추가", activityUpload: "사진 업로드", activityUploading: "업로드 중…", activityViewOriginal: "원본 보기",
    videoAdd: "영상 추가", videoUrlPh: "YouTube URL 입력",
    contactHide: "숨기기", contactShow: "보이기",
    contactEditDisplay: "표시 텍스트", contactEditHref: "링크 URL",
    editLabel: "편집", editDone: "완료", editBanner: "편집 모드 — 항목을 클릭해 수정하세요",
    pwTitle: "편집 모드 잠금 해제", pwPlaceholder: "비밀번호 입력",
    pwConfirm: "확인", pwError: "비밀번호가 올바르지 않습니다", pwCancel: "취소",
    lbClose: "닫기", lbReset: "원래 크기",
    lbHint: "스크롤 = 확대/축소 · 드래그 = 이동 · 0 = 초기화 · ESC = 닫기",
  },
  en: {
    langLabel: "KO",
    navCurrent: "Now", navWorks: "Works", navStatement: "Statement", navExhibitions: "Exhibitions", navContact: "Contact",
    currentAdd: "Add Exhibition", currentUpload: "Replace Poster", currentUploading: "Uploading…",
    statusOngoing: "Ongoing", statusUpcoming: "Upcoming", statusPast: "Past", viewMore: "View More",
    showPastEx: "Past Exhibitions", hidePastEx: "Hide",
    worksCollected: "Collected", worksNotCollected: "Available", fieldCollected: "Collection",
    worksAdd: "Add Work", worksAll: "All", seriesAdd: "Add Series",
    worksUpload: "Replace Image", worksUploading: "Uploading…",
    worksInquiry: "Inquire →", worksDelete: "Delete", worksNoImg: "No image",
    worksViewOriginal: "View Original",
    fieldYear: "Year", fieldMedium: "Medium", fieldSize: "Size", fieldCategory: "Category", fieldSeries: "Series",
    statAddSlide: "Add Slide", statFirstSlide: "Add First Slide",
    statNone: "No statements yet", statDeleteSlide: "Delete this slide",
    statUpload: "Replace Image", statUploading: "Uploading…",
    exAdd: "Add Item", exAll: "All", exExhibition: "Exhibition", exAward: "Award", exFair: "ArtFair", exNoLink: "No link",
    activityAdd: "Add Photo", activityUpload: "Upload Photo", activityUploading: "Uploading…", activityViewOriginal: "View Original",
    videoAdd: "Add Video", videoUrlPh: "Enter YouTube URL",
    contactHide: "Hide", contactShow: "Show",
    contactEditDisplay: "Display text", contactEditHref: "Link URL",
    editLabel: "Edit", editDone: "Done", editBanner: "Edit Mode — click items to edit",
    pwTitle: "Unlock Edit Mode", pwPlaceholder: "Enter password",
    pwConfirm: "Confirm", pwError: "Incorrect password", pwCancel: "Cancel",
    lbClose: "Close", lbReset: "Reset",
    lbHint: "scroll = zoom · drag = pan · 0 = reset · esc = close",
  },
} as const;

/* ─── initial data ───────────────────────────────────── */
const initCurrentEx: CurrentExhibition[] = [
  { id: 1, title: "형태와 기억 사이", titleEn: "Between Form and Memory", venue: "국립현대미술관", venueEn: "MMCA", location: "서울", locationEn: "Seoul", startDate: "2024.11.15", endDate: "2025.03.02", status: "진행중", visible: true },
  { id: 2, title: "Seoul Art Week 2025", titleEn: "Seoul Art Week 2025", venue: "DDP 동대문디자인플라자", venueEn: "DDP Dongdaemun Design Plaza", location: "서울", locationEn: "Seoul", startDate: "2025.04.10", endDate: "2025.04.20", status: "예정", visible: true },
  { id: 3, title: "Asia Contemporary Art Show", titleEn: "Asia Contemporary Art Show", venue: "홍콩 컨벤션센터", venueEn: "Hong Kong Convention Centre", location: "홍콩", locationEn: "Hong Kong", startDate: "2025.05.30", endDate: "2025.06.02", status: "예정", visible: true },
  { id: 4, title: "침묵의 언어", titleEn: "Language of Silence", venue: "아트선재센터", venueEn: "Art Sonje Center", location: "서울", locationEn: "Seoul", startDate: "2023.09.01", endDate: "2023.10.28", status: "지난전시", visible: true },
  { id: 5, title: "Boundaries Unseen", titleEn: "Boundaries Unseen", venue: "Galerie Templon", venueEn: "Galerie Templon", location: "파리, 프랑스", locationEn: "Paris, France", startDate: "2023.04.06", endDate: "2023.05.20", status: "지난전시", visible: true },
  { id: 6, title: "Seoul Contemporary", titleEn: "Seoul Contemporary", venue: "KIAF SEOUL", venueEn: "KIAF SEOUL", location: "서울", locationEn: "Seoul", startDate: "2022.09.02", endDate: "2022.09.05", status: "지난전시", visible: true },
];
const initSeries: Series[] = [
  { id: 1, name: "부유하는 기억", nameEn: "Floating Memory" },
  { id: 2, name: "경계의 언어", nameEn: "Language of Borders" },
  { id: 3, name: "잔향", nameEn: "Reverberation" },
];
const initArtworks: Artwork[] = [
  { id: 1, title: "부유하는 기억 I", titleEn: "Floating Memory I", year: "2024", medium: "캔버스에 유채", mediumEn: "Oil on canvas", size: "130 × 162 cm", image: "", category: "회화", categoryEn: "Painting", series: "부유하는 기억", collected: false },
  { id: 2, title: "조용한 파동", titleEn: "Silent Wave", year: "2024", medium: "캔버스에 아크릴", mediumEn: "Acrylic on canvas", size: "97 × 130 cm", image: "", category: "회화", categoryEn: "Painting", series: "경계의 언어", collected: true },
  { id: 3, title: "경계 사이에서", titleEn: "Between Borders", year: "2023", medium: "캔버스에 혼합재료", mediumEn: "Mixed media on canvas", size: "162 × 130 cm", image: "", category: "혼합매체", categoryEn: "Mixed Media", series: "경계의 언어", collected: false },
  { id: 4, title: "소리 없는 대화", titleEn: "Soundless Dialogue", year: "2023", medium: "종이에 수채", mediumEn: "Watercolor on paper", size: "76 × 56 cm", image: "", category: "수채화", categoryEn: "Watercolor", series: "경계의 언어", collected: true },
  { id: 5, title: "잔향 II", titleEn: "Reverberation II", year: "2022", medium: "캔버스에 유채", mediumEn: "Oil on canvas", size: "200 × 160 cm", image: "", category: "회화", categoryEn: "Painting", series: "잔향", collected: false },
  { id: 6, title: "흔적의 지층", titleEn: "Stratum of Traces", year: "2022", medium: "캔버스에 혼합재료", mediumEn: "Mixed media on canvas", size: "130 × 97 cm", image: "", category: "혼합매체", categoryEn: "Mixed Media", series: "잔향", collected: true },
];
const initSlides: Slide[] = [
  { id: 1, heading: "기억과 형태,\n그 경계에서", headingEn: "Between Memory\nand Form", body: "나의 작업은 기억이 물리적 형태로 변환되는 순간을 포착하는 것으로부터 시작된다. 우리가 경험하는 모든 것들은 시간 속에서 서서히 형태를 잃어가지만, 그 흔적만은 예상치 못한 방식으로 캔버스 위에 남는다.", bodyEn: "My work begins with capturing the moment when memory transforms into physical form. Everything we experience gradually loses its shape over time, yet its traces remain on the canvas in unexpected ways." },
  { id: 2, heading: "색과 감각의\n퇴적층", headingEn: "Strata of Color\nand Sensation", body: "나는 붓질 하나하나가 단순한 물감의 흔적이 아닌, 특정 감각의 퇴적층이라고 믿는다. 색은 감정의 온도이고, 형태는 기억의 윤곽이다.", bodyEn: "I believe each brushstroke is not merely a trace of paint but a sedimentary layer of sensation. Color is the temperature of emotion, and form is the outline of memory." },
  { id: 3, heading: "보이지 않는 것에\n형태를 부여하며", headingEn: "Giving Form to\nthe Invisible", body: "작업을 통해 나는 보이지 않는 것을 보이게 하고, 말해지지 않은 것들에 형태를 부여하려 한다. 관람자가 작품 앞에 서는 순간, 그 침묵 속에서 자신만의 기억과 감각을 발견하기를 바란다.", bodyEn: "Through my work I seek to make the invisible visible — to give form to what remains unspoken. When a viewer stands before the work, I hope they discover their own memory within that silence." },
];
const initExhibitions: ExhibitionEntry[] = [
  { id: 1, year: "2024", title: "형태와 기억 사이", titleEn: "Between Form and Memory", venue: "국립현대미술관", venueEn: "MMCA", location: "서울", tag: "전시", activityId: 1 },
  { id: 2, year: "2024", title: "한국 현대회화의 지금", titleEn: "Korean Contemporary Painting Now", venue: "부산시립미술관", venueEn: "Busan Museum of Art", location: "부산", tag: "전시", activityId: 4 },
  { id: 3, year: "2023", title: "Boundaries Unseen", titleEn: "Boundaries Unseen", venue: "Galerie Templon", venueEn: "Galerie Templon", location: "파리, 프랑스", tag: "전시" },
  { id: 4, year: "2023", title: "제23회 이중섭미술상 수상", titleEn: "23rd Lee Jung-seob Art Award", venue: "조선일보미술관", venueEn: "Chosun Ilbo Art Museum", location: "서울", tag: "수상", activityId: 3 },
  { id: 5, year: "2023", title: "침묵의 언어", titleEn: "Language of Silence", venue: "아트선재센터", venueEn: "Art Sonje Center", location: "서울", tag: "전시", activityId: 3 },
  { id: 6, year: "2022", title: "Seoul Contemporary", titleEn: "Seoul Contemporary", venue: "KIAF SEOUL", venueEn: "KIAF SEOUL", location: "서울", tag: "전시" },
  { id: 7, year: "2021", title: "감각의 지형", titleEn: "Topography of Sensation", venue: "대구미술관", venueEn: "Daegu Art Museum", location: "대구", tag: "전시" },
  { id: 8, year: "2019", title: "제10회 송은미술대상 우수상", titleEn: "10th Songeun Art Award", venue: "송은아트스페이스", venueEn: "Songeun Art Space", location: "서울", tag: "수상" },
];
const initActivityPhotos: ActivityPhoto[] = [
  { id: 1, caption: "2024 개인전 설치 작업", captionEn: "2024 Solo Exhibition Installation" },
  { id: 2, caption: "작가 작업실에서", captionEn: "In the Artist's Studio" },
  { id: 3, caption: "아트선재센터 오프닝", captionEn: "Art Sonje Center Opening" },
  { id: 4, caption: "부산시립미술관 단체전", captionEn: "Busan Museum of Art Group Exhibition" },
];
const initVideos: VideoEntry[] = [
  { id: 1, youtubeUrl: "", title: "작가 인터뷰 — 부유하는 기억", titleEn: "Artist Interview — Floating Memory", description: "국립현대미술관 개인전 작가 인터뷰", descriptionEn: "Artist interview at MMCA solo exhibition" },
  { id: 2, youtubeUrl: "", title: "전시 설치 과정", titleEn: "Exhibition Installation Process", description: "2024 개인전 설치 작업 과정", descriptionEn: "Installation process for 2024 solo exhibition" },
];
const initContacts: ContactItem[] = [
  { id: "email", type: "email", labelKo: "이메일", labelEn: "Email", display: "studio@jeonyeonmi.com", href: "mailto:studio@jeonyeonmi.com", visible: true },
  { id: "phone", type: "phone", labelKo: "전화", labelEn: "Phone", display: "+82 10-0000-0000", href: "tel:+821000000000", visible: true },
  { id: "instagram", type: "instagram", labelKo: "인스타그램", labelEn: "Instagram", display: "@jeonyeonmi_art", href: "https://instagram.com/jeonyeonmi_art", visible: true },
  { id: "blog", type: "blog", labelKo: "네이버 블로그", labelEn: "Naver Blog", display: "blog.naver.com/jeonyeonmi", href: "https://blog.naver.com/jeonyeonmi", visible: true },
];

/* ─── global CSS ─────────────────────────────────────── */
const GLOBAL_CSS = `
/* scrollbar hide */
.hide-sb { scrollbar-width: none; -ms-overflow-style: none; }
.hide-sb::-webkit-scrollbar { display: none; }

/* copy protection */
.app-root { user-select: none; -webkit-user-select: none; -moz-user-select: none; }
.app-root input, .app-root textarea { user-select: text; -webkit-user-select: text; }
.app-root img { -webkit-user-drag: none; user-drag: none; }

/* landscape mobile: side-by-side hero and slides */
@media (orientation: landscape) and (max-width: 1023px) {
  .hero-section { flex-direction: row !important; }
  .hero-panel { padding-top: 4rem !important; min-height: 100dvh; justify-content: center !important; }
  .slide-row { flex-direction: row !important; }
}
/* very short screens (landscape phones) */
@media (max-height: 520px) {
  .nav-bar { height: 44px !important; }
  .slide-img-area { min-height: 200px !important; }
  .slide-img-area img { max-height: 220px !important; }
  .slide-text-area { max-height: 220px !important; }
  .current-ex-img { height: 260px !important; }
  .hero-panel { padding-bottom: 2rem !important; }
}
/* lightbox smooth */
.lb-img { transition: transform 0.12s ease-out; }
.lb-img.dragging { transition: none; }
/* drag & drop */
.drag-item { cursor: default; }
.drag-item[draggable="true"] { cursor: grab; }
.drag-item[draggable="true"]:active { cursor: grabbing; }
.drag-item.drag-over { outline: 2px solid var(--accent); outline-offset: -2px; }
.drag-item.drag-ghost { opacity: 0.35; }
/* image placeholder shimmer */
@keyframes img-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.img-placeholder {
  background: linear-gradient(90deg,
    var(--secondary) 25%,
    color-mix(in slab, var(--secondary), var(--foreground) 6%) 50%,
    var(--secondary) 75%);
  background-size: 200% 100%;
  animation: img-shimmer 1.8s ease-in-out infinite;
}
`;

/* ═══════════════════════════════════════════════════════ */
const GA_ID = "G-MYX4F18WM9";

function useGoogleAnalytics() {
  useEffect(() => {
    if (document.getElementById("ga-script")) return;
    const s = document.createElement("script");
    s.id = "ga-script";
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    s.async = true;
    document.head.appendChild(s);
    const i = document.createElement("script");
    i.id = "ga-init";
    i.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`;
    document.head.appendChild(i);
  }, []);
}

export default function App() {
  useGoogleAnalytics();
  const [lang, setLang] = useState<Lang>("ko");
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

  /* lightbox keyboard */
  useEffect(() => {
    if (!lightboxSrc) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setLightboxSrc(null); setFullscreenVideoYtId(null); }
      if (e.key === "=" || e.key === "+") lbZoomIn();
      if (e.key === "-") lbZoomOut();
      if (e.key === "0") lbReset();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightboxSrc, lbScale]);

  /* copy protection */
  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault();
    const preventDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement).closest('[draggable="true"]')) return;
      e.preventDefault();
    };
    const preventKeys = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? "";
      const isEditable = tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable;
      if (!isEditable) {
        if ((e.ctrlKey || e.metaKey) && ["c", "a", "s", "u", "p"].includes(e.key.toLowerCase())) e.preventDefault();
      }
      if (e.key === "F12") e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("dragstart", preventDrag);
    document.addEventListener("keydown", preventKeys);
    return () => {
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("dragstart", preventDrag);
      document.removeEventListener("keydown", preventKeys);
    };
  }, []);

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

  /* other state */
  const [currentExList, setCurrentExList] = useState(initCurrentEx);
  const [editingCurrentId, setEditingCurrentId] = useState<number | null>(null);
  const [showPastEx, setShowPastEx] = useState(true);

  const [artworkList, setArtworkList] = useState(initArtworks);
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  const selectedWork = artworkList.find((w) => w.id === selectedWorkId) ?? null;
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
  const [contactItems, setContactItems] = useState(initContacts);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTarget = useRef<string | null>(null);
  const langClickTs = useRef<number[]>([]);
  const dragSrc = useRef<number | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
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

  const triggerUpload = (target: string) => { pendingTarget.current = target; fileInputRef.current?.click(); };

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
    e.target.value = "";
    const token = editTokenRef.current;
    if (!token) { alert("편집 권한이 필요합니다. 다시 로그인해주세요."); return; }
    setUploadingTarget(target);
    try {
      const url = await uploadImage(target, file, token);
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
  const deleteWork = (id: number) => { setArtworkList((p) => p.filter((w) => w.id !== id)); if (selectedWorkId === id) setSelectedWorkId(null); };
  const addSeries = () => { const newId = Math.max(0, ...seriesList.map((s) => s.id)) + 1; setSeriesList((p) => [...p, { id: newId, name: "새 시리즈", nameEn: "New Series" }]); setEditingSeriesId(newId); };
  const updateSeries = (id: number, f: keyof Series, v: string) => setSeriesList((p) => p.map((s) => s.id === id ? { ...s, [f]: v } : s));
  const deleteSeries = (id: number) => { const s = seriesList.find((s) => s.id === id); setSeriesList((p) => p.filter((s) => s.id !== id)); if (selectedSeries === s?.name) setSelectedSeries("전체"); };
  const updateSlide = (id: number, f: keyof Slide, v: string) => setSlides((p) => p.map((s) => s.id === id ? { ...s, [f]: v } : s));
  const addSlide = () => { const newId = Math.max(0, ...slides.map((s) => s.id)) + 1; setSlides((p) => [...p, { id: newId, heading: "새 작가노트", headingEn: "New Statement", body: "내용을 입력하세요.", bodyEn: "Enter content here." }]); setCurrentSlide(slides.length); };
  const deleteSlide = (id: number) => { setSlides((p) => p.filter((s) => s.id !== id)); setCurrentSlide((p) => Math.max(0, p - 1)); };
  const addExhibition = () => { const newId = Math.max(0, ...exhibitionList.map((e) => e.id)) + 1; setExhibitionList((p) => [{ id: newId, year: String(new Date().getFullYear()), title: "새 항목", titleEn: "New Item", venue: "장소", venueEn: "Venue", location: "서울", tag: "전시" }, ...p]); setEditingExId(newId); };
  const updateEx = (id: number, f: keyof ExhibitionEntry, v: string | number | undefined) => setExhibitionList((p) => p.map((e) => e.id === id ? { ...e, [f]: v } : e));
  const deleteEx = (id: number) => { setExhibitionList((p) => p.filter((e) => e.id !== id)); if (editingExId === id) setEditingExId(null); };
  const addCurrentEx = () => { const newId = Math.max(0, ...currentExList.map((e) => e.id)) + 1; setCurrentExList((p) => [...p, { id: newId, title: "새 전시", titleEn: "New Exhibition", venue: "장소", venueEn: "Venue", location: "서울", locationEn: "Seoul", startDate: "2025.01.01", endDate: "2025.02.01", status: "예정", visible: true }]); setEditingCurrentId(newId); };
  const toggleCurrentExVisible = (id: number) => setCurrentExList((p) => p.map((e) => e.id === id ? { ...e, visible: !e.visible } : e));
  const updateCurrentEx = (id: number, f: keyof CurrentExhibition, v: string) => setCurrentExList((p) => p.map((e) => e.id === id ? { ...e, [f]: v } : e));
  const deleteCurrentEx = (id: number) => { setCurrentExList((p) => p.filter((e) => e.id !== id)); if (editingCurrentId === id) setEditingCurrentId(null); };
  const addActivityPhoto = () => { const newId = Math.max(0, ...activityPhotos.map((p) => p.id)) + 1; setActivityPhotos((p) => [...p, { id: newId, caption: "새 사진", captionEn: "New Photo" }]); };
  const deleteActivityPhoto = (id: number) => setActivityPhotos((p) => p.filter((ph) => ph.id !== id));
  const updateActivityPhoto = (id: number, f: keyof ActivityPhoto, v: string) => setActivityPhotos((p) => p.map((ph) => ph.id === id ? { ...ph, [f]: v } : ph));
  const addVideo = () => { const newId = Math.max(0, ...videoList.map((v) => v.id)) + 1; setVideoList((p) => [...p, { id: newId, youtubeUrl: "", title: "새 영상", titleEn: "New Video", description: "설명", descriptionEn: "Description" }]); setEditingVideoId(newId); };
  const updateVideoField = (id: number, f: keyof VideoEntry, v: string) => setVideoList((p) => p.map((vid) => vid.id === id ? { ...vid, [f]: v } : vid));
  const deleteVideo = (id: number) => { setVideoList((p) => p.filter((v) => v.id !== id)); if (editingVideoId === id) setEditingVideoId(null); };
  const updateContact = (id: string, patch: Partial<ContactItem>) => setContactItems((p) => p.map((c) => c.id === id ? { ...c, ...patch } : c));
  const toggleContactVisibility = (id: string) => setContactItems((p) => p.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));

  const filteredWorks = selectedSeries === "전체" ? artworkList : artworkList.filter((a) => { const s = seriesList.find((s) => s.name === selectedSeries); return s ? a.series === s.name : false; });
  const filteredEx = exFilter === "전체" ? exhibitionList : exhibitionList.filter((e) => e.tag === exFilter);

  const navItems: [string, string][] = [["current-exhibitions", u.navCurrent], ["works", u.navWorks], ["statement", u.navStatement], ["exhibitions", u.navExhibitions], ["contact", u.navContact]];
  const contactIcon = (type: ContactItem["type"]) => {
    if (type === "email") return <Mail size={16} />;
    if (type === "phone") return <Phone size={16} />;
    if (type === "instagram") return <Instagram size={16} />;
    return <Globe size={16} />;
  };

  return (
    <div className="app-root min-h-screen bg-background text-foreground" style={SANS}
      onCopy={(e) => e.preventDefault()}>
      <style>{GLOBAL_CSS}</style>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* ── Video fullscreen overlay ── */}
      {fullscreenVideoYtId && (
        <div className="fixed inset-0 z-[350] bg-black flex flex-col">
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
        <div className="fixed inset-0 z-[300] bg-black/97 flex flex-col select-none"
          onContextMenu={(e) => e.preventDefault()}>
          {/* toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-1">
              {lbShowZoom && (<>
                <button onClick={lbZoomOut} disabled={lbScale <= 0.25}
                  className="p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-white/50 w-12 text-center" style={MONO}>{Math.round(lbScale * 100)}%</span>
                <button onClick={lbZoomIn} disabled={lbScale >= 8}
                  className="p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ZoomIn size={16} />
                </button>
                <button onClick={lbReset} className="p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors ml-1" title={u.lbReset}>
                  <RotateCcw size={14} />
                </button>
                <span className="text-xs text-white/30 ml-3 hidden sm:block" style={MONO}>{u.lbHint}</span>
              </>)}
            </div>
            <button onClick={() => setLightboxSrc(null)}
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white px-3 py-1.5 border border-white/20 hover:border-white/40 transition-colors" style={MONO}>
              <X size={13} />{u.lbClose}
            </button>
          </div>
          {/* canvas */}
          <div className="flex-1 overflow-hidden flex items-center justify-center"
            style={{ cursor: lbDragging ? "grabbing" : lbScale > 1 ? "grab" : "default", touchAction: "none" }}
            onWheel={lbShowZoom ? handleLbWheel : (e) => e.preventDefault()}
            onMouseDown={handleLbMouseDown}
            onMouseMove={handleLbMouseMove}
            onMouseUp={handleLbMouseUp}
            onMouseLeave={handleLbMouseUp}
            onTouchStart={handleLbTouchStart}
            onTouchMove={handleLbTouchMove}
            onTouchEnd={handleLbTouchEnd}
            onDoubleClick={() => lbScale === 1 ? setLbScale(2) : lbReset()}>
            <img src={lightboxSrc} alt=""
              draggable={false}
              className={`pointer-events-none select-none lb-img ${lbDragging ? "dragging" : ""}`}
              style={{
                transform: `translate(${lbOffset.x}px, ${lbOffset.y}px) scale(${lbScale})`,
                transformOrigin: "center center",
                maxWidth: lbScale <= 1 ? "min(92vw, 1200px)" : "none",
                maxHeight: lbScale <= 1 ? "calc(100dvh - 60px)" : "none",
              }} />
          </div>
          {/* hint overlay on first open */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="text-xs text-white/20" style={MONO}>{Math.round(lbScale * 100)}% · double-tap to zoom</span>
          </div>
        </div>
      )}

      {/* ── Password modal ── */}
      {showPwModal && (
        <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-card border border-border p-8 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-6"><Lock size={14} className="text-accent" /><h3 className="text-sm font-light" style={SERIF}>{u.pwTitle}</h3></div>
            <div className="relative mb-3">
              <input type={showPw ? "text" : "password"} value={pwInput} onChange={(e) => { setPwInput(e.target.value); setPwErrorMsg(""); }} onKeyDown={(e) => e.key === "Enter" && handlePwSubmit()} placeholder={u.pwPlaceholder} className="w-full bg-secondary border border-border text-foreground text-sm px-4 py-3 pr-10 outline-none focus:border-accent transition-colors" style={MONO} autoFocus />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
            {pwErrorMsg && <p className="text-xs text-red-400 mb-3" style={MONO}>{pwErrorMsg}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={handlePwSubmit} disabled={pwSubmitting} className="flex-1 bg-accent text-accent-foreground text-xs tracking-widest py-2.5 hover:bg-accent/90 transition-colors disabled:opacity-50" style={MONO}>{u.pwConfirm}</button>
              <button onClick={() => { setShowPwModal(false); setPwInput(""); setPwErrorMsg(""); }} className="flex-1 border border-border text-muted-foreground text-xs tracking-widest py-2.5 hover:border-foreground/30 hover:text-foreground transition-colors" style={MONO}>{u.pwCancel}</button>
            </div>
          </div>
        </div>
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

      {/* ── HERO ── */}
      <section id="hero" className="hero-section min-h-screen flex flex-col md:flex-row" style={{ paddingTop: 0 }}>
        <div className="hero-panel flex flex-col justify-end px-6 lg:px-12 pb-12 sm:pb-16 pt-16 md:pt-0 shrink-0 order-2 md:order-1"
          style={{ flex: heroAspectRatio ? `0 0 ${Math.max(28, Math.min(48, Math.round(100 / (1 + heroAspectRatio * 1.4))))}%` : "0 0 42%", transition: "flex-basis 0.6s cubic-bezier(0.4,0,0.2,1)" }}>
          <span className="text-xs tracking-[0.25em] text-accent uppercase mb-3" style={MONO}>
            {editMode ? (
              <div className="flex flex-col gap-1">
                <input value={content.heroSub} onChange={(e) => updateContent("heroSub", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 outline-none text-accent w-full text-xs tracking-[0.25em]" style={MONO} placeholder="KO" />
                <input value={content.heroSubEn} onChange={(e) => updateContent("heroSubEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 outline-none text-accent/60 w-full text-xs tracking-[0.25em]" style={MONO} placeholder="EN" />
              </div>
            ) : (lang === "ko" ? content.heroSub : content.heroSubEn)}
          </span>
          <h1 className="font-light text-foreground leading-none mb-6 whitespace-nowrap"
            style={{ ...SERIF, fontSize: lang === "en" ? "clamp(1.8rem, 5.5vw, 5rem)" : "clamp(2.5rem, 10vw, 7rem)", letterSpacing: lang === "en" ? "0.06em" : "0.01em" }}>
            {editMode
              ? <input value={lang === "ko" ? content.heroName : content.heroNameEn} onChange={(e) => updateContent(lang === "ko" ? "heroName" : "heroNameEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 outline-none w-full" style={{ ...SERIF, letterSpacing: lang === "en" ? "0.01em" : "-0.02em" }} />
              : c("heroName")}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xs font-light mb-10" style={SANS}>
            {editMode
              ? <textarea value={lang === "ko" ? content.heroDesc : content.heroDescEn} onChange={(e) => updateContent(lang === "ko" ? "heroDesc" : "heroDescEn", e.target.value)} rows={3} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-sm text-muted-foreground leading-relaxed" style={SANS} />
              : c("heroDesc")}
          </p>
          <button onClick={() => scrollTo("works")} className="flex items-center gap-2 text-xs tracking-widest text-foreground border border-border px-5 py-3 hover:border-accent hover:text-accent transition-all w-fit" style={MONO}>
            {c("heroCta")} <ArrowUpRight size={14} />
          </button>
        </div>
        <div className={`hero-image relative min-h-[50vh] md:min-h-screen bg-card overflow-hidden flex-1 order-1 md:order-2 ${editMode && !editingCaption ? "cursor-pointer" : ""}`}
          style={{ transition: "flex 0.6s cubic-bezier(0.4,0,0.2,1)" }}
          onClick={() => { if (editMode && !editingCaption) triggerUpload("hero"); }}>
          {img("hero")
            ? <img src={img("hero")!} alt="hero" className="absolute inset-0 w-full h-full object-cover opacity-70 hover:opacity-80 transition-opacity duration-700" />
            : <div className="absolute inset-0 img-placeholder" />}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
          {editMode && !editingCaption && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 hover:bg-background/60 transition-colors">
              <div className="flex flex-col items-center gap-2 text-foreground"><Upload size={28} /><span className="text-xs tracking-widest" style={MONO}>{uploadingTarget === "hero" ? u.worksUploading : u.worksUpload}</span></div>
            </div>
          )}
          <div className="absolute bottom-6 right-6" onClick={(e) => e.stopPropagation()}>
            {editMode && editingCaption ? (
              <div className="flex flex-col gap-1 items-end">
                <input value={heroCaption} onChange={(e) => setHeroCaption(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setEditingCaption(false)} className="bg-background/80 border border-accent text-foreground text-xs tracking-widest px-2 py-1 outline-none w-52 text-right" style={MONO} placeholder="KO" autoFocus />
                <input value={heroCaptionEn} onChange={(e) => setHeroCaptionEn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setEditingCaption(false)} className="bg-background/80 border border-accent/60 text-muted-foreground text-xs tracking-widest px-2 py-1 outline-none w-52 text-right" style={MONO} placeholder="EN" />
                <button onClick={() => setEditingCaption(false)} className="text-xs text-accent/60 hover:text-accent mt-0.5" style={MONO}><Check size={11} className="inline" /> 완료</button>
              </div>
            ) : (
              <button onClick={() => editMode && setEditingCaption(true)} className={`text-xs tracking-widest text-muted-foreground block transition-all ${editMode ? "border-b border-dashed border-accent/50 hover:text-accent pb-0.5" : ""}`} style={MONO}>
                {lang === "ko" ? heroCaption : heroCaptionEn}{editMode && <Edit3 size={10} className="inline ml-1 opacity-60" />}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── CURRENT EXHIBITIONS ── */}
      <section id="current-exhibitions" className="py-16 sm:py-20 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 sm:px-6 lg:px-12 flex items-end justify-between mb-10">
            <div>
              <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s01label" /></div>
              <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s01heading" /></h2>
            </div>
            {editMode && <button onClick={addCurrentEx} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.currentAdd}</span></button>}
          </div>

          {/* active / upcoming cards */}
          {(() => {
            const activeList = editMode
              ? currentExList.filter((e) => e.status !== "지난전시")
              : currentExList.filter((e) => e.status !== "지난전시" && e.visible);
            return (
              <div className="flex gap-px overflow-x-auto hide-sb pl-4 sm:pl-6 lg:pl-12 pr-4 sm:pr-6 lg:pr-12 pb-2" style={{ scrollSnapType: "x mandatory" }}>
                {activeList.map((ex, idx) => {
                  const isEditing = editMode && editingCurrentId === ex.id;
                  const exImg = img(`current-${ex.id}`);
                  const statusLabel = ex.status === "진행중" ? u.statusOngoing : u.statusUpcoming;
                  const statusCls = ex.status === "진행중" ? "bg-accent text-accent-foreground" : "bg-background/90 border border-border text-muted-foreground";
                  return (
                    <div key={ex.id}
                      draggable={editMode}
                      onDragStart={() => { dragSrc.current = idx; }}
                      onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("cur-" + idx); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragSrc.current !== null && dragSrc.current !== idx) {
                          setCurrentExList(prev => {
                            const filtered = editMode ? prev.filter(e => e.status !== "지난전시") : prev.filter(e => e.status !== "지난전시" && e.visible);
                            const full = [...prev];
                            const fromId = filtered[dragSrc.current!].id;
                            const toId = filtered[idx].id;
                            const fromFullIdx = full.findIndex(e => e.id === fromId);
                            const toFullIdx = full.findIndex(e => e.id === toId);
                            return moveItem(full, fromFullIdx, toFullIdx);
                          });
                        }
                        dragSrc.current = null; setDragOverKey(null);
                      }}
                      onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                      className={`shrink-0 bg-background border flex flex-col overflow-hidden transition-all ${ex.visible ? "border-border" : "border-dashed border-border/40 opacity-50"}`}
                      style={{ width: "clamp(240px, 72vw, 300px)", scrollSnapAlign: "start", outline: dragOverKey === "cur-" + idx ? "2px solid var(--accent)" : "none" }}>
                      <div className={`current-ex-img relative overflow-hidden bg-card ${editMode ? "cursor-pointer" : ""}`} style={{ height: "340px" }} onClick={() => editMode && triggerUpload(`current-${ex.id}`)}>
                        {exImg ? <img src={exImg} alt={ex.title} className="w-full h-full object-cover" loading="lazy" decoding="async" /> : <div className="w-full h-full bg-secondary flex items-center justify-center"><span className="text-xs text-muted-foreground" style={MONO}>{u.currentUpload}</span></div>}
                        {!isEditing && (
                          <div className="absolute top-3 left-3 flex gap-1.5">
                            <span className={`text-xs px-2.5 py-1 tracking-widest font-medium ${statusCls}`} style={MONO}>{statusLabel}</span>
                            {!ex.visible && editMode && <span className="text-xs px-2 py-1 bg-background/80 border border-dashed border-border text-muted-foreground" style={MONO}>숨김</span>}
                          </div>
                        )}
                        {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={20} /><span className="text-xs" style={MONO}>{uploadingTarget === `current-${ex.id}` ? u.currentUploading : u.currentUpload}</span></div></div>}
                        {editMode && <div className="absolute top-1.5 left-1.5 z-10 text-accent/60 cursor-grab"><GripVertical size={14} /></div>}
                      </div>
                      <div className="p-5 flex flex-col gap-3 flex-1">
                        {isEditing ? (
                          <div className="space-y-2 flex-1">
                            {/* status cycle */}
                            <button onClick={() => { const cycle = { "진행중": "예정", "예정": "지난전시", "지난전시": "진행중" } as const; updateCurrentEx(ex.id, "status", cycle[ex.status]); }}
                              className={`text-xs px-2 py-0.5 border mb-2 ${ex.status === "진행중" ? "border-accent text-accent" : ex.status === "예정" ? "border-border text-muted-foreground" : "border-border/40 text-muted-foreground/50"}`} style={MONO}>
                              {ex.status === "진행중" ? u.statusOngoing : ex.status === "예정" ? u.statusUpcoming : u.statusPast} ⇄
                            </button>
                            <input value={ex.title} onChange={(e) => updateCurrentEx(ex.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-base font-light text-foreground outline-none" style={SERIF} placeholder="전시명 KO" />
                            <input value={ex.titleEn} onChange={(e) => updateCurrentEx(ex.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} placeholder="Title EN" />
                            <div className="flex gap-2">
                              <input value={ex.venue} onChange={(e) => updateCurrentEx(ex.id, "venue", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="장소 KO" />
                              <input value={ex.venueEn} onChange={(e) => updateCurrentEx(ex.id, "venueEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="Venue EN" />
                            </div>
                            <div className="flex gap-2">
                              <input value={ex.location} onChange={(e) => updateCurrentEx(ex.id, "location", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="지역 KO" />
                              <input value={ex.locationEn} onChange={(e) => updateCurrentEx(ex.id, "locationEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="Location EN" />
                            </div>
                            <div className="flex gap-2">
                              <input value={ex.startDate} onChange={(e) => updateCurrentEx(ex.id, "startDate", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="시작일" />
                              <input value={ex.endDate} onChange={(e) => updateCurrentEx(ex.id, "endDate", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="종료일" />
                            </div>
                            <input value={ex.url ?? ""} onChange={(e) => updateCurrentEx(ex.id, "url", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="링크 URL (선택)" />
                          </div>
                        ) : (
                          <div className="flex-1">
                            <h3 className={`font-light text-foreground mb-1 leading-snug ${hSize("text-sm sm:text-base", "text-base sm:text-lg", lang)}`} style={SERIF}>{lang === "ko" ? ex.title : ex.titleEn}</h3>
                            <p className="text-xs text-accent mb-3" style={MONO}>{lang === "ko" ? ex.titleEn : ex.title}</p>
                            <p className="text-xs text-muted-foreground mb-1">{lang === "ko" ? ex.venue : ex.venueEn}</p>
                            <p className="text-xs text-muted-foreground mb-1">{lang === "ko" ? ex.location : ex.locationEn}</p>
                            <p className="text-xs text-muted-foreground" style={MONO}>{ex.startDate} — {ex.endDate}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                          {!isEditing && (ex.url
                            ? <a href={ex.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors" style={MONO}>{u.viewMore} <ArrowUpRight size={11} /></a>
                            : <button onClick={() => scrollTo("works")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors" style={MONO}>{u.viewMore} <ArrowUpRight size={11} /></button>
                          )}
                          {editMode && (
                            <div className="flex gap-1 ml-auto">
                              <button onClick={() => toggleCurrentExVisible(ex.id)} className={`p-1.5 transition-colors ${ex.visible ? "text-muted-foreground hover:text-foreground" : "text-accent"}`} title={ex.visible ? "숨기기" : "보이기"}>
                                {ex.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>
                              <button onClick={() => setEditingCurrentId(isEditing ? null : ex.id)} className={`p-1.5 transition-colors ${isEditing ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>{isEditing ? <Check size={13} /> : <Edit3 size={13} />}</button>
                              <button onClick={() => deleteCurrentEx(ex.id)} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {editMode && <button onClick={addCurrentEx} className="shrink-0 border border-dashed border-border hover:border-accent transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-accent" style={{ width: "clamp(240px, 72vw, 300px)", height: "520px", scrollSnapAlign: "start" }}><Plus size={24} /><span className="text-xs tracking-widest" style={MONO}>{u.currentAdd}</span></button>}
              </div>
            );
          })()}

          {/* past exhibitions */}
          {(() => {
            const pastList = editMode
              ? currentExList.filter((e) => e.status === "지난전시")
              : currentExList.filter((e) => e.status === "지난전시" && e.visible);
            if (pastList.length === 0 && !editMode) return null;
            return (
              <div className="px-4 sm:px-6 lg:px-12 mt-8">
                <button onClick={() => setShowPastEx((p) => !p)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-0" style={MONO}>
                  <span className="w-4 h-px bg-muted-foreground/40" />
                  {showPastEx ? u.hidePastEx : u.showPastEx}
                  <span className="text-muted-foreground/40">({pastList.length})</span>
                  <ChevronRight size={12} className={`transition-transform duration-200 ${showPastEx ? "rotate-90" : ""}`} />
                </button>
                {showPastEx && (
                  <div className="mt-4 border-t border-border/40">
                    {pastList.map((ex, pidx) => {
                      const isEditing = editMode && editingCurrentId === ex.id;
                      const pastThumb = img(`current-${ex.id}`);
                      return (
                        <div key={ex.id}
                          draggable={editMode}
                          onDragStart={() => { dragSrc.current = pidx; }}
                          onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== pidx) setDragOverKey("past-" + pidx); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragSrc.current !== null && dragSrc.current !== pidx) {
                              setCurrentExList(prev => {
                                const full = [...prev];
                                const fromId = pastList[dragSrc.current!].id;
                                const toId = pastList[pidx].id;
                                const fromIdx = full.findIndex(e => e.id === fromId);
                                const toIdx = full.findIndex(e => e.id === toId);
                                return moveItem(full, fromIdx, toIdx);
                              });
                            }
                            dragSrc.current = null; setDragOverKey(null);
                          }}
                          onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                          className={`group flex items-center gap-3 sm:gap-5 py-3 border-b border-border/30 hover:bg-secondary/20 transition-colors px-2 -mx-2 ${ex.visible ? "" : "opacity-40"}`}
                          style={{ outline: dragOverKey === "past-" + pidx ? "2px solid var(--accent)" : "none" }}>
                          {editMode && <div className="text-accent/40 cursor-grab shrink-0"><GripVertical size={13} /></div>}
                          <span className="text-xs text-muted-foreground/50 w-16 shrink-0" style={MONO}>{ex.startDate.slice(0, 7)}</span>
                          {/* thumbnail */}
                          <div className="shrink-0 overflow-hidden bg-secondary" style={{ width: 52, height: 68 }}>
                            {pastThumb
                              ? <img src={pastThumb} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                              : <div className="w-full h-full flex items-center justify-center"><span className="text-muted-foreground/20 text-xs">✦</span></div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="space-y-2">
                                <button onClick={() => { const cycle = { "진행중": "예정", "예정": "지난전시", "지난전시": "진행중" } as const; updateCurrentEx(ex.id, "status", cycle[ex.status]); }} className="text-xs px-2 py-0.5 border border-border/40 text-muted-foreground/50 mb-1" style={MONO}>{u.statusPast} ⇄</button>
                                <input value={ex.title} onChange={(e) => updateCurrentEx(ex.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" style={SERIF} />
                                <input value={ex.titleEn} onChange={(e) => updateCurrentEx(ex.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} />
                                <div className="flex gap-2">
                                  <input value={ex.venue} onChange={(e) => updateCurrentEx(ex.id, "venue", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="KO" />
                                  <input value={ex.venueEn} onChange={(e) => updateCurrentEx(ex.id, "venueEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="EN" />
                                </div>
                                <div className="flex gap-2">
                                  <input value={ex.location} onChange={(e) => updateCurrentEx(ex.id, "location", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="지역 KO" />
                                  <input value={ex.locationEn} onChange={(e) => updateCurrentEx(ex.id, "locationEn", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="EN" />
                                </div>
                                <div className="flex gap-2">
                                  <input value={ex.startDate} onChange={(e) => updateCurrentEx(ex.id, "startDate", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} />
                                  <input value={ex.endDate} onChange={(e) => updateCurrentEx(ex.id, "endDate", e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} />
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm font-light text-foreground/80 leading-snug" style={SERIF}>{lang === "ko" ? ex.title : ex.titleEn}</p>
                                <p className="text-xs text-muted-foreground/50 mt-0.5">{lang === "ko" ? ex.venue : ex.venueEn} · {lang === "ko" ? ex.location : ex.locationEn}</p>
                                <p className="text-xs text-muted-foreground/30 mt-0.5" style={MONO}>{ex.startDate} — {ex.endDate}</p>
                              </>
                            )}
                          </div>
                          {editMode && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => toggleCurrentExVisible(ex.id)} className={`p-1.5 transition-colors ${ex.visible ? "text-muted-foreground hover:text-foreground" : "text-accent"}`}>{ex.visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                              <button onClick={() => setEditingCurrentId(isEditing ? null : ex.id)} className={`p-1.5 transition-colors ${isEditing ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>{isEditing ? <Check size={12} /> : <Edit3 size={12} />}</button>
                              <button onClick={() => deleteCurrentEx(ex.id)} className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── WORKS ── */}
      <section id="works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 sm:mb-16 gap-6">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s02label" /></div>
            <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl lg:text-5xl", "text-4xl sm:text-5xl lg:text-6xl", lang)}`} style={SERIF}><C field="s02heading" /></h2>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setSelectedSeries("전체")}
              draggable={false}
              className={`text-xs tracking-wider px-3 sm:px-4 py-2 border transition-all ${selectedSeries === "전체" ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`}
              style={MONO}>{u.worksAll}</button>
            {seriesList.map((s, idx) => {
              const name = lang === "ko" ? s.name : s.nameEn;
              const isActive = selectedSeries === s.name;
              const isEditingThis = editMode && editingSeriesId === s.id;
              return (
                <div key={s.id} className="relative flex items-center group/series"
                  draggable={editMode}
                  onDragStart={() => { dragSrc.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("ser-" + idx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragSrc.current !== null && dragSrc.current !== idx) {
                      setSeriesList(prev => moveItem(prev, dragSrc.current!, idx));
                    }
                    dragSrc.current = null; setDragOverKey(null);
                  }}
                  onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                  style={{ outline: dragOverKey === "ser-" + idx ? "2px solid var(--accent)" : "none" }}>
                  {isEditingThis ? (
                    <div className="flex items-center gap-1 border border-accent px-2 py-1">
                      <input value={s.name} onChange={(e) => updateSeries(s.id, "name", e.target.value)} className="bg-transparent text-xs text-accent outline-none w-16 sm:w-20" style={MONO} autoFocus />
                      <span className="text-muted-foreground/40 text-xs">/</span>
                      <input value={s.nameEn} onChange={(e) => updateSeries(s.id, "nameEn", e.target.value)} className="bg-transparent text-xs text-muted-foreground outline-none w-16 sm:w-20" style={MONO} />
                      <button onClick={() => setEditingSeriesId(null)} className="ml-1 text-accent"><Check size={11} /></button>
                      <button onClick={() => deleteSeries(s.id)} className="text-muted-foreground hover:text-red-400"><Trash2 size={11} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setSelectedSeries(s.name)} className={`text-xs tracking-wider px-3 sm:px-4 py-2 border transition-all ${isActive ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>{name}</button>
                  )}
                  {editMode && !isEditingThis && <button onClick={() => setEditingSeriesId(s.id)} className="absolute -top-2 -right-2 bg-background border border-border text-muted-foreground hover:text-foreground p-0.5 opacity-0 group-hover/series:opacity-100 transition-opacity"><Edit3 size={9} /></button>}
                </div>
              );
            })}
            {editMode && <button onClick={addSeries} className="flex items-center gap-1 text-xs border border-dashed border-accent/40 text-accent/70 px-3 py-2 hover:border-accent hover:text-accent transition-colors" style={MONO}><Plus size={11} /><span className="hidden sm:inline">{u.seriesAdd}</span></button>}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-background">
          {filteredWorks.map((work, idx) => (
            <div key={work.id}
              className="group bg-background flex flex-col cursor-pointer border-r border-b border-border/30"
              draggable={editMode}
              onDragStart={() => { dragSrc.current = idx; }}
              onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("work-" + idx); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragSrc.current !== null && dragSrc.current !== idx) {
                  setArtworkList(prev => {
                    const filtered = selectedSeries === "전체" ? prev : prev.filter(w => w.series === selectedSeries);
                    const full = [...prev];
                    const fromId = filtered[dragSrc.current!].id;
                    const toId = filtered[idx].id;
                    const fromFullIdx = full.findIndex(w => w.id === fromId);
                    const toFullIdx = full.findIndex(w => w.id === toId);
                    return moveItem(full, fromFullIdx, toFullIdx);
                  });
                }
                dragSrc.current = null; setDragOverKey(null);
              }}
              onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
              style={{ outline: dragOverKey === "work-" + idx ? "2px solid var(--accent)" : "none" }}
              onClick={() => setSelectedWorkId(work.id)}>
              <div className="relative aspect-[4/5] overflow-hidden bg-background shrink-0">
                {editMode && <div className="absolute top-1.5 left-1.5 z-10 text-accent/60 cursor-grab"><GripVertical size={14} /></div>}
                {img(`artwork-${work.id}`) ? <img src={img(`artwork-${work.id}`)!} alt={work.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" decoding="async" /> : <div className="w-full h-full img-placeholder" />}
                <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-all duration-500" />
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowUpRight size={16} className="text-foreground" /></div>
                {editMode && <button onClick={(e) => { e.stopPropagation(); deleteWork(work.id); }} className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-background text-foreground p-1.5 transition-all"><Trash2 size={13} /></button>}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                  {work.series && (() => { const s = seriesList.find((s) => s.name === work.series); const label = lang === "ko" ? work.series : (s?.nameEn ?? work.series); return <span className="text-xs px-2 py-0.5 bg-background/70 text-muted-foreground" style={MONO}>{label}</span>; })()}
                  {work.collected && <span className="text-xs px-2 py-0.5 bg-accent/90 text-accent-foreground ml-auto" style={MONO}>{u.worksCollected}</span>}
                </div>
              </div>
              <div className="p-3 sm:p-5 flex flex-col gap-1">
                <div className="flex justify-between items-baseline gap-2">
                  <h3 className="text-xs sm:text-sm font-light text-foreground line-clamp-1 flex-1" style={SERIF}>{lang === "ko" ? work.title : work.titleEn}</h3>
                  <span className="text-xs text-accent shrink-0" style={MONO}>{work.year}</span>
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block" style={MONO}>{lang === "ko" ? work.medium : work.mediumEn}</p>
              </div>
            </div>
          ))}
          {editMode && <button onClick={addArtwork} className="group aspect-[4/5] bg-background border border-dashed border-border hover:border-accent transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-accent"><Plus size={24} /><span className="text-xs tracking-widest" style={MONO}>{u.worksAdd}</span></button>}
        </div>
      </section>

      {/* ── ARTWORK MODAL ── */}
      {selectedWork && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 lg:p-8" onClick={() => setSelectedWorkId(null)}>
          <div className="relative max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-card max-h-[95dvh]" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-3 right-3 z-10 bg-card/80 text-muted-foreground hover:text-foreground p-1.5 transition-colors" onClick={() => setSelectedWorkId(null)}><X size={18} /></button>
            {/* image panel */}
            <div className={`relative bg-background overflow-hidden flex items-center justify-center ${editMode ? "cursor-pointer" : ""}`} style={{ minHeight: "260px", maxHeight: "min(60vh, 560px)" }} onClick={() => editMode && triggerUpload(`artwork-${selectedWork.id}`)}>
              {img(`artwork-${selectedWork.id}`) || selectedWork.image
                ? <img src={img(`artwork-${selectedWork.id}`)!} alt={selectedWork.title} className="w-full h-full object-contain" style={{ maxHeight: "min(60vh, 560px)" }} decoding="async" />
                : <div className="w-full img-placeholder" style={{ minHeight: "260px" }} />}
              {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={22} /><span className="text-xs tracking-widest" style={MONO}>{uploadingTarget === `artwork-${selectedWork.id}` ? u.worksUploading : u.worksUpload}</span></div></div>}
              {!editMode && (img(`artwork-${selectedWork.id}`) || selectedWork.image) && (
                <button
                  onClick={(e) => { e.stopPropagation(); openLightbox(img(`artwork-${selectedWork.id}`) ?? selectedWork.image); }}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-background/80 hover:bg-background border border-border/60 hover:border-foreground/40 text-muted-foreground hover:text-foreground text-xs px-2.5 py-1.5 transition-all"
                  style={MONO}>
                  <Maximize2 size={12} />{u.worksViewOriginal}
                </button>
              )}
            </div>
            {/* info panel */}
            <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-between overflow-y-auto hide-sb" style={{ maxHeight: "95dvh" }}>
              <div>
                <div className="mb-6 sm:mb-8 pr-8">
                  {editMode ? (
                    <><input value={selectedWork.title} onChange={(e) => updateWork(selectedWork.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-lg sm:text-xl font-light text-foreground leading-snug mb-1 outline-none" style={SERIF} /><input value={selectedWork.titleEn} onChange={(e) => updateWork(selectedWork.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-accent mt-2 outline-none" style={MONO} /></>
                  ) : (
                    <><h3 className={`font-light text-foreground mb-1 ${hSize("text-lg sm:text-xl", "text-xl sm:text-2xl", lang)}`} style={SERIF}>{lang === "ko" ? selectedWork.title : selectedWork.titleEn}</h3><p className="text-sm text-accent">{lang === "ko" ? selectedWork.titleEn : selectedWork.title}</p></>
                  )}
                </div>
                <div className="space-y-3 sm:space-y-4 border-t border-border pt-5">
                  {([["year", u.fieldYear], ["medium", u.fieldMedium], ["size", u.fieldSize], ["category", u.fieldCategory]] as [keyof Artwork, string][]).map(([field, label]) => {
                    const displayVal = () => {
                      if (field === "medium") return lang === "en" ? selectedWork.mediumEn : selectedWork.medium;
                      if (field === "category") return lang === "en" ? (selectedWork.categoryEn || selectedWork.category) : selectedWork.category;
                      return String(selectedWork[field]);
                    };
                    return (
                    <div key={field} className="flex gap-4 sm:gap-6 items-start">
                      <span className="text-xs w-12 sm:w-14 text-muted-foreground shrink-0 pt-0.5" style={MONO}>{label}</span>
                      {editMode ? (
                        (field === "medium" || field === "category")
                          ? <div className="flex-1 flex gap-2">
                              <input value={String(selectedWork[field])} onChange={(e) => updateWork(selectedWork.id, field, e.target.value)} placeholder="KO" className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" />
                              <input value={field === "medium" ? selectedWork.mediumEn : (selectedWork.categoryEn || "")} onChange={(e) => updateWork(selectedWork.id, field === "medium" ? "mediumEn" : "categoryEn", e.target.value)} placeholder="EN" className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" />
                            </div>
                          : <input value={String(selectedWork[field])} onChange={(e) => updateWork(selectedWork.id, field, e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" />
                      ) : <span className="text-sm text-foreground font-light">{displayVal()}</span>}
                    </div>
                  );})}
                  <div className="flex gap-4 sm:gap-6 items-start">
                    <span className="text-xs w-12 sm:w-14 text-muted-foreground shrink-0 pt-0.5" style={MONO}>{u.fieldSeries}</span>
                    {editMode ? (
                      <div className="flex flex-wrap gap-2 flex-1">
                        <button onClick={() => updateWork(selectedWork.id, "series", "")} className={`text-xs px-2 py-0.5 border transition-colors ${!selectedWork.series ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>—</button>
                        {seriesList.map((s) => <button key={s.id} onClick={() => updateWork(selectedWork.id, "series", s.name)} className={`text-xs px-2 py-0.5 border transition-colors ${selectedWork.series === s.name ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>{lang === "ko" ? s.name : s.nameEn}</button>)}
                      </div>
                    ) : <span className="text-sm text-foreground font-light">{(() => { const s = seriesList.find((s) => s.name === selectedWork.series); return lang === "ko" ? (selectedWork.series || "—") : (s?.nameEn ?? selectedWork.series ?? "—"); })()}</span>}
                  </div>
                  {/* collected row */}
                  <div className="flex gap-4 sm:gap-6 items-center pt-3 border-t border-border mt-1">
                    <span className="text-xs w-12 sm:w-14 text-muted-foreground shrink-0" style={MONO}>{u.fieldCollected}</span>
                    {editMode ? (
                      <button onClick={() => updateWork(selectedWork.id, "collected", !selectedWork.collected)}
                        className={`flex items-center gap-2 text-xs px-3 py-1.5 border transition-all ${selectedWork.collected ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedWork.collected ? "bg-accent" : "bg-muted-foreground/40"}`} />
                        {selectedWork.collected ? u.worksCollected : u.worksNotCollected}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedWork.collected ? "bg-accent" : "bg-muted-foreground/20"}`} />
                        <span className={`text-sm font-light ${selectedWork.collected ? "text-accent" : "text-muted-foreground"}`}>{selectedWork.collected ? u.worksCollected : u.worksNotCollected}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6 sm:mt-8 flex items-center justify-between flex-wrap gap-3">
                <button onClick={() => { setSelectedWorkId(null); scrollTo("contact"); }} className="text-xs tracking-widest text-muted-foreground hover:text-accent border border-border px-4 py-2 hover:border-accent transition-all" style={MONO}>{u.worksInquiry}</button>
                {editMode && <button onClick={() => deleteWork(selectedWork.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors" style={MONO}><Trash2 size={12} />{u.worksDelete}</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ARTIST STATEMENT ── */}
      <section id="statement" className="py-16 sm:py-24 border-t border-border overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-end justify-between mb-8 sm:mb-10">
            <div>
              <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s03label" /></div>
              <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s03heading" /></h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {slides.length > 0 && <div className="hidden sm:flex items-center gap-2 mr-1">{slides.map((s, i) => <button key={s.id} onClick={() => !isSliding && setCurrentSlide(i)} className={`rounded-full transition-all ${i === currentSlide ? "bg-foreground w-5 h-1.5" : "bg-muted-foreground/40 w-1.5 h-1.5 hover:bg-muted-foreground"}`} />)}</div>}
              <button onClick={() => !isSliding && goSlide(-1)} disabled={currentSlide === 0 || !slides.length} className="p-1.5 sm:p-2 border border-border hover:border-foreground/40 text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
              <button onClick={() => !isSliding && goSlide(1)} disabled={currentSlide === slides.length - 1 || !slides.length} className="p-1.5 sm:p-2 border border-border hover:border-foreground/40 text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
              {editMode && <button onClick={addSlide} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors ml-1" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.statAddSlide}</span></button>}
            </div>
          </div>
          {slides.length === 0 ? (
            <div className="flex items-center justify-center h-48 sm:h-64 border border-dashed border-border text-muted-foreground">
              {editMode ? <button onClick={addSlide} className="flex flex-col items-center gap-3 hover:text-foreground transition-colors"><Plus size={28} /><span className="text-xs tracking-widest" style={MONO}>{u.statFirstSlide}</span></button> : <span className="text-xs" style={MONO}>{u.statNone}</span>}
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="flex" style={{ transform: `translateX(-${currentSlide * 100}%)`, transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                {slides.map((sl) => {
                  const imgSrc = img(`slide-${sl.id}`);
                  return (
                    <div key={sl.id} className="slide-row w-full shrink-0 flex flex-col md:flex-row border border-border">
                      <div className={`slide-img-area md:w-2/5 shrink-0 flex items-center justify-center bg-card relative ${editMode ? "cursor-pointer" : imgSrc ? "cursor-zoom-in" : ""}`} style={{ minHeight: "280px" }} onClick={() => { if (editMode) { triggerUpload(`slide-${sl.id}`); } else if (imgSrc) { openLightbox(imgSrc, false); } }}>
                        {imgSrc ? <img src={imgSrc} alt={sl.heading} className="w-full h-full object-contain" style={{ maxHeight: "520px" }} loading="lazy" decoding="async" /> : <div className="absolute inset-0 img-placeholder" />}
                        {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={22} /><span className="text-xs tracking-widest" style={MONO}>{uploadingTarget === `slide-${sl.id}` ? u.statUploading : u.statUpload}</span></div></div>}
                      </div>
                      <div className="slide-text-area flex-1 hide-sb overflow-y-auto" style={{ maxHeight: "520px" }}>
                        <div className="flex flex-col justify-center min-h-full p-8 sm:p-10 lg:p-16">
                          {editMode ? (
                            <>
                              <textarea value={sl.heading} onChange={(e) => updateSlide(sl.id, "heading", e.target.value)} rows={2} className={`bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full font-light text-foreground leading-snug mb-2 ${hSize("text-xl sm:text-2xl lg:text-3xl", "text-2xl sm:text-3xl lg:text-4xl", lang)}`} style={SERIF} />
                              <textarea value={sl.headingEn} onChange={(e) => updateSlide(sl.id, "headingEn", e.target.value)} rows={1} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-xs text-accent mb-5" style={MONO} />
                              <textarea value={sl.body} onChange={(e) => updateSlide(sl.id, "body", e.target.value)} rows={5} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-sm text-muted-foreground leading-[2] font-light" style={SANS} />
                              <textarea value={sl.bodyEn} onChange={(e) => updateSlide(sl.id, "bodyEn", e.target.value)} rows={3} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-xs text-muted-foreground/60 leading-relaxed mt-4" style={MONO} />
                              <button onClick={() => deleteSlide(sl.id)} className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors self-start" style={MONO}><Trash2 size={12} />{u.statDeleteSlide}</button>
                            </>
                          ) : (
                            <>
                              <h3 className={`font-light text-foreground leading-snug mb-3 whitespace-pre-line ${hSize("text-xl sm:text-2xl lg:text-3xl", "text-2xl sm:text-3xl lg:text-4xl", lang)}`} style={SERIF}>{lang === "ko" ? sl.heading : sl.headingEn}</h3>
                              <p className="text-xs text-accent mb-6 sm:mb-8" style={MONO}>{lang === "ko" ? sl.headingEn : sl.heading}</p>
                              <p className="text-sm sm:text-base text-muted-foreground leading-[2] font-light whitespace-pre-wrap" style={SANS}>{lang === "ko" ? sl.body : sl.bodyEn}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {slides.length > 0 && <div className="mt-4 flex justify-end"><span className="text-xs text-muted-foreground" style={MONO}>{currentSlide + 1} / {slides.length}</span></div>}
        </div>
      </section>

      {/* ── EXHIBITIONS & AWARDS ── */}
      <section id="exhibitions" className="py-16 sm:py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 sm:mb-12 gap-5">
            <div>
              <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s04label" /></div>
              <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s04heading" /></h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([["전체", u.exAll], ["전시", u.exExhibition], ["아트페어", u.exFair], ["수상", u.exAward]] as const).map(([f, label]) => (
                <button key={f} onClick={() => changeExFilter(f as "전체" | "전시" | "수상" | "아트페어")} className={`text-xs tracking-wider px-3 sm:px-4 py-2 border transition-all ${exFilter === f ? "border-accent text-accent" : "border-border text-muted-foreground hover:border-foreground/40"}`} style={MONO}>{label}</button>
              ))}
              {editMode && <button onClick={addExhibition} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.exAdd}</span></button>}
            </div>
          </div>
          <div className="transition-opacity duration-200" style={{ opacity: exVisible ? 1 : 0 }}>
            {filteredEx.map((ex, idx) => {
              const isEditing = editMode && editingExId === ex.id;
              const linkedPhoto = activityPhotos.find((p) => p.id === ex.activityId);
              const exThumb = ex.activityId ? img(`activity-${ex.activityId}`) : null;
              return (
                <div key={ex.id}
                  draggable={editMode}
                  onDragStart={() => { dragSrc.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("ex-" + idx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragSrc.current !== null && dragSrc.current !== idx) {
                      setExhibitionList(prev => {
                        const full = [...prev];
                        const fromId = filteredEx[dragSrc.current!].id;
                        const toId = filteredEx[idx].id;
                        const fromFullIdx = full.findIndex(e => e.id === fromId);
                        const toFullIdx = full.findIndex(e => e.id === toId);
                        return moveItem(full, fromFullIdx, toFullIdx);
                      });
                    }
                    dragSrc.current = null; setDragOverKey(null);
                  }}
                  onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                  className="group grid grid-cols-12 gap-1 sm:gap-2 py-3 sm:py-4 border-b border-border hover:bg-secondary/30 transition-colors px-2 -mx-2 items-center"
                  style={{ outline: dragOverKey === "ex-" + idx ? "2px solid var(--accent)" : "none" }}>
                  {editMode && <div className="col-span-1 flex items-center justify-center text-accent/40 cursor-grab"><GripVertical size={13} /></div>}
                  {/* thumbnail */}
                  <div className={`${editMode ? "col-span-1" : "col-span-2 sm:col-span-1"} flex items-center justify-center`}>
                    {exThumb ? (
                      <button onClick={() => linkedPhoto && scrollToActivity(linkedPhoto.id)} className="shrink-0 overflow-hidden bg-secondary" style={{ width: 40, height: 40 }}>
                        <img src={exThumb} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" loading="lazy" decoding="async" />
                      </button>
                    ) : (
                      <span className="text-xs text-accent" style={MONO}>{ex.year}</span>
                    )}
                  </div>
                  <div className={editMode ? "col-span-4 lg:col-span-4" : "col-span-5 lg:col-span-4"}>
                    {exThumb && <span className="text-xs text-accent block mb-0.5" style={MONO}>{ex.year}</span>}
                    {isEditing ? <div className="space-y-1"><input value={ex.year} onChange={(e) => updateEx(ex.id, "year", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none w-16 mb-1" style={MONO} /><input value={ex.title} onChange={(e) => updateEx(ex.id, "title", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs sm:text-sm text-foreground font-light outline-none w-full" style={SERIF} placeholder="제목 KO" /><input value={ex.titleEn} onChange={(e) => updateEx(ex.id, "titleEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none w-full" style={MONO} placeholder="Title EN" /></div> : <p className="text-xs sm:text-sm text-foreground font-light leading-snug" style={SERIF}>{lang === "ko" ? ex.title : ex.titleEn}</p>}
                  </div>
                  <div className="hidden lg:block col-span-3">
                    {isEditing ? (<div className="space-y-1"><div className="flex gap-2"><input value={ex.venue} onChange={(e) => updateEx(ex.id, "venue", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none flex-1" placeholder="장소 KO" /><input value={ex.location} onChange={(e) => updateEx(ex.id, "location", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none w-16" placeholder="지역" /></div><input value={ex.venueEn ?? ""} onChange={(e) => updateEx(ex.id, "venueEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none w-full" placeholder="Venue EN" /><div className="flex items-center gap-1"><Link2 size={10} className="text-muted-foreground shrink-0" /><select value={ex.activityId ?? ""} onChange={(e) => updateEx(ex.id, "activityId", e.target.value ? Number(e.target.value) : undefined)} className="bg-transparent text-xs text-muted-foreground outline-none flex-1 cursor-pointer" style={MONO}><option value="">{u.exNoLink}</option>{activityPhotos.map((p) => <option key={p.id} value={p.id}>{lang === "ko" ? p.caption : p.captionEn}</option>)}</select></div></div>) : <p className="text-xs text-muted-foreground">{lang === "ko" ? ex.venue : (ex.venueEn || ex.venue)} · {ex.location}</p>}
                  </div>
                  <div className="col-span-2 lg:col-span-1 flex justify-center">{isEditing ? <button onClick={() => updateEx(ex.id, "tag", ex.tag === "전시" ? "아트페어" : ex.tag === "아트페어" ? "수상" : "전시")} className={`text-xs px-1.5 py-0.5 border transition-colors ${ex.tag === "수상" ? "border-yellow-600/60 text-yellow-500" : ex.tag === "아트페어" ? "border-blue-500/60 text-blue-400" : "border-accent text-accent"}`} style={MONO}>{ex.tag === "전시" ? u.exExhibition : ex.tag === "아트페어" ? u.exFair : u.exAward} ⇄</button> : <span className={`text-xs px-1.5 py-0.5 border ${ex.tag === "수상" ? "border-yellow-600/60 text-yellow-500" : ex.tag === "아트페어" ? "border-blue-500/40 text-blue-400" : "border-border text-muted-foreground"}`} style={MONO}>{ex.tag === "전시" ? u.exExhibition : ex.tag === "아트페어" ? u.exFair : u.exAward}</span>}</div>
                  <div className="col-span-1 flex justify-end">{!isEditing && linkedPhoto && !exThumb && <button onClick={() => scrollToActivity(linkedPhoto.id)} className="text-muted-foreground hover:text-accent transition-colors p-1" title={lang === "ko" ? linkedPhoto.caption : linkedPhoto.captionEn}><Link2 size={14} /></button>}</div>
                  <div className="col-span-1 flex justify-end">{editMode && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => setEditingExId(isEditing ? null : ex.id)} className={`p-1 transition-colors ${isEditing ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}>{isEditing ? <Check size={12} /> : <Edit3 size={12} />}</button><button onClick={() => deleteEx(ex.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={12} /></button></div>}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ACTIVITY PHOTOS ── */}
      <section id="activities" className="py-16 sm:py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10 sm:mb-12">
            <div>
              <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s05label" /></div>
              <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s05heading" /></h2>
            </div>
            {editMode && <button onClick={addActivityPhoto} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.activityAdd}</span></button>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-background">
            {activityPhotos.map((photo, idx) => {
              const actImg = img(`activity-${photo.id}`);
              const isEditingCap = editMode && editingActivityCaption === photo.id;
              const isHighlighted = highlightedPhotoId === photo.id;
              return (
                <div key={photo.id} id={`activity-photo-${photo.id}`}
                  draggable={editMode}
                  onDragStart={() => { dragSrc.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("act-" + idx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragSrc.current !== null && dragSrc.current !== idx) {
                      setActivityPhotos(prev => moveItem(prev, dragSrc.current!, idx));
                    }
                    dragSrc.current = null; setDragOverKey(null);
                  }}
                  onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                  className="group bg-background relative overflow-hidden transition-all duration-500"
                  style={{ outline: isHighlighted || dragOverKey === "act-" + idx ? "2px solid var(--accent)" : "none" }}>
                  {editMode && <div className="absolute top-1.5 left-1.5 z-10 text-accent/60 cursor-grab"><GripVertical size={14} /></div>}
                  <div
                    className={`relative aspect-square overflow-hidden bg-background ${editMode ? "cursor-pointer" : "cursor-zoom-in"}`}
                    onClick={() => {
                      if (editMode) { triggerUpload(`activity-${photo.id}`); return; }
                      if (actImg) openLightbox(actImg);
                    }}>
                    {actImg ? <img src={actImg} alt={photo.caption} className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${isHighlighted ? "opacity-100" : "opacity-80"}`} loading="lazy" decoding="async" /> : <div className="absolute inset-0 img-placeholder" />}
                    {editMode && <div className="absolute inset-0 flex items-center justify-center bg-background/50 hover:bg-background/65 transition-colors"><div className="flex flex-col items-center gap-2 text-foreground"><Upload size={18} /><span className="text-xs" style={MONO}>{uploadingTarget === `activity-${photo.id}` ? u.activityUploading : u.activityUpload}</span></div></div>}
                    {editMode && <button onClick={(e) => { e.stopPropagation(); deleteActivityPhoto(photo.id); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-background text-foreground p-1 transition-all"><Trash2 size={12} /></button>}
                    {/* hover overlay hint — desktop only */}
                    {!editMode && actImg && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/30 transition-colors pointer-events-none">
                        <Maximize2 size={20} className="text-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
                      </div>
                    )}
                  </div>
                  <div className="p-2 sm:p-3">
                    {isEditingCap ? (
                      <div className="space-y-1">
                        <input value={photo.caption} onChange={(e) => updateActivityPhoto(photo.id, "caption", e.target.value)} onKeyDown={(e) => e.key === "Enter" && setEditingActivityCaption(null)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none w-full" style={MONO} placeholder="KO" autoFocus />
                        <input value={photo.captionEn} onChange={(e) => updateActivityPhoto(photo.id, "captionEn", e.target.value)} onKeyDown={(e) => e.key === "Enter" && setEditingActivityCaption(null)} onBlur={() => setEditingActivityCaption(null)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground/60 outline-none w-full" style={MONO} placeholder="EN" />
                      </div>
                    ) : (
                      <button onClick={() => editMode && setEditingActivityCaption(photo.id)} className={`text-xs text-muted-foreground text-left w-full transition-all ${editMode ? "hover:text-foreground" : ""}`} style={MONO}>{lang === "ko" ? photo.caption : photo.captionEn}{editMode && <Edit3 size={9} className="inline ml-1 opacity-50" />}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── VIDEOS ── */}
      <section id="videos" className="py-16 sm:py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-end justify-between mb-10 sm:mb-12">
            <div>
              <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s06label" /></div>
              <h2 className={`font-light text-foreground ${hSize("text-3xl sm:text-4xl", "text-4xl sm:text-5xl", lang)}`} style={SERIF}><C field="s06heading" /></h2>
            </div>
            {editMode && <button onClick={addVideo} className="flex items-center gap-1.5 text-xs border border-dashed border-accent/50 text-accent px-3 sm:px-4 py-2 hover:border-accent transition-colors" style={MONO}><Plus size={13} /><span className="hidden sm:inline">{u.videoAdd}</span></button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-background">
            {videoList.map((vid, idx) => {
              const youtubeId = getYoutubeId(vid.youtubeUrl);
              const isEditing = editMode && editingVideoId === vid.id;
              return (
                <div key={vid.id}
                  draggable={editMode}
                  onDragStart={() => { dragSrc.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("vid-" + idx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragSrc.current !== null && dragSrc.current !== idx) {
                      setVideoList(prev => moveItem(prev, dragSrc.current!, idx));
                    }
                    dragSrc.current = null; setDragOverKey(null);
                  }}
                  onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                  className="group bg-background flex flex-col"
                  style={{ outline: dragOverKey === "vid-" + idx ? "2px solid var(--accent)" : "none" }}>
                  <div className="relative aspect-video overflow-hidden bg-background">
                    {editMode && <div className="absolute top-1.5 left-1.5 z-10 text-accent/60 cursor-grab"><GripVertical size={14} /></div>}
                    {playingVideoId === vid.id && youtubeId ? (
                      <>
                        <iframe
                          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full border-0"
                        />
                        <button
                          onClick={() => setFullscreenVideoYtId(youtubeId)}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/90 text-white/70 hover:text-white transition-all z-10"
                          title="전체화면">
                          <Maximize2 size={13} />
                        </button>
                      </>
                    ) : youtubeId ? (
                      <>
                        <img src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`} alt={vid.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" loading="lazy" decoding="async" />
                        <div className="absolute inset-0 bg-background/20 group-hover:bg-background/10 transition-colors" />
                        {!isEditing && <button onClick={() => setPlayingVideoId(vid.id)} className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-full bg-background/80 border border-foreground/20 flex items-center justify-center transition-all duration-300 group-hover:bg-background/95 group-hover:scale-110"><Play size={18} className="text-foreground ml-1" fill="currentColor" /></div>
                        </button>}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-background"><span className="text-xs text-muted-foreground" style={MONO}>{u.videoUrlPh}</span></div>
                    )}
                    {editMode && <button onClick={() => deleteVideo(vid.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-background text-foreground p-1.5 transition-all z-10"><Trash2 size={13} /></button>}
                  </div>
                  <div className="p-4 sm:p-5 flex flex-col gap-2 flex-1">
                    {isEditing ? (
                      <div className="space-y-2 flex-1">
                        <input value={vid.youtubeUrl} onChange={(e) => updateVideoField(vid.id, "youtubeUrl", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder={u.videoUrlPh} />
                        <input value={vid.title} onChange={(e) => updateVideoField(vid.id, "title", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground font-light outline-none" style={SERIF} placeholder="제목" />
                        <input value={vid.titleEn} onChange={(e) => updateVideoField(vid.id, "titleEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-accent outline-none" style={MONO} placeholder="English title" />
                        <input value={vid.description} onChange={(e) => updateVideoField(vid.id, "description", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" placeholder="설명 KO" />
                        <input value={vid.descriptionEn} onChange={(e) => updateVideoField(vid.id, "descriptionEn", e.target.value)} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground/70 outline-none" placeholder="Description EN" />
                        <button onClick={() => setEditingVideoId(null)} className="flex items-center gap-1.5 text-xs text-accent mt-2" style={MONO}><Check size={11} />완료</button>
                      </div>
                    ) : (
                      <><h3 className={`font-light text-foreground leading-snug ${hSize("text-sm", "text-base", lang)}`} style={SERIF}>{lang === "ko" ? vid.title : vid.titleEn}</h3><p className="text-xs text-muted-foreground" style={MONO}>{lang === "ko" ? vid.description : vid.descriptionEn}</p>{editMode && <button onClick={() => setEditingVideoId(vid.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-auto pt-2" style={MONO}><Edit3 size={11} />편집</button>}</>
                    )}
                  </div>
                </div>
              );
            })}
            {editMode && <button onClick={addVideo} className="group aspect-video bg-background border border-dashed border-border hover:border-accent transition-colors flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-accent"><Plus size={24} /><span className="text-xs tracking-widest" style={MONO}>{u.videoAdd}</span></button>}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-16 sm:py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-start">
          <div>
            <div className="text-xs tracking-[0.25em] text-accent mb-4 uppercase" style={MONO}><C field="s07label" /></div>
            <h2 className={`font-light text-foreground leading-snug mb-6 sm:mb-8 whitespace-pre-line ${hSize("text-3xl sm:text-4xl lg:text-5xl", "text-4xl sm:text-5xl lg:text-6xl", lang)}`} style={SERIF}><C field="s07heading" /></h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-light" style={SANS}>
              {editMode ? <textarea value={lang === "ko" ? content.s07desc : content.s07descEn} onChange={(e) => updateContent(lang === "ko" ? "s07desc" : "s07descEn", e.target.value)} rows={4} className="bg-transparent border-b border-dashed border-accent/60 outline-none resize-none w-full text-sm text-muted-foreground leading-relaxed" style={SANS} /> : c("s07desc")}
            </p>
          </div>
          <div className="space-y-2">
            {contactItems.map((item, idx) => {
              const isEditingThis = editMode && editingContactId === item.id;
              if (!item.visible && !editMode) return null;
              return (
                <div key={item.id}
                  draggable={editMode}
                  onDragStart={() => { dragSrc.current = idx; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragSrc.current !== idx) setDragOverKey("con-" + idx); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragSrc.current !== null && dragSrc.current !== idx) {
                      setContactItems(prev => moveItem(prev, dragSrc.current!, idx));
                    }
                    dragSrc.current = null; setDragOverKey(null);
                  }}
                  onDragEnd={() => { dragSrc.current = null; setDragOverKey(null); }}
                  className={`border transition-all ${item.visible ? "border-border hover:border-accent/50" : "border-dashed border-border/30 opacity-40"}`}
                  style={{ outline: dragOverKey === "con-" + idx ? "2px solid var(--accent)" : "none" }}>
                  {isEditingThis ? (
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-2"><span className="text-accent">{contactIcon(item.type)}</span><span className="text-xs text-muted-foreground" style={MONO}>{lang === "ko" ? item.labelKo : item.labelEn}</span></div>
                      <div><p className="text-xs text-muted-foreground/50 mb-1" style={MONO}>{u.contactEditDisplay}</p><input value={item.display} onChange={(e) => updateContact(item.id, { display: e.target.value })} className="w-full bg-transparent border-b border-dashed border-accent/60 text-sm text-foreground outline-none" /></div>
                      <div><p className="text-xs text-muted-foreground/50 mb-1" style={MONO}>{u.contactEditHref}</p><input value={item.href} onChange={(e) => updateContact(item.id, { href: e.target.value })} className="w-full bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} /></div>
                      <button onClick={() => setEditingContactId(null)} className="flex items-center gap-1.5 text-xs text-accent pt-1" style={MONO}><Check size={11} />완료</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group/ci">
                      {editMode && <div className="pl-3 sm:pl-4 text-accent/40 cursor-grab shrink-0"><GripVertical size={13} /></div>}
                      <a href={item.visible ? item.href : "#"} target={item.type === "email" || item.type === "phone" ? "_self" : "_blank"} rel="noopener noreferrer" className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 flex-1 transition-all ${!item.visible || editMode ? "pointer-events-none" : ""}`}>
                        <span className="text-muted-foreground group-hover/ci:text-accent transition-colors w-4 flex items-center justify-center shrink-0">{contactIcon(item.type)}</span>
                        <div><p className="text-xs text-muted-foreground mb-0.5" style={MONO}>{lang === "ko" ? item.labelKo : item.labelEn}</p><p className={`font-light text-foreground ${hSize("text-sm", "text-base", lang)}`}>{item.display}</p></div>
                        {item.visible && !editMode && <ArrowUpRight size={14} className="text-muted-foreground group-hover/ci:text-accent transition-colors ml-auto" />}
                      </a>
                      {editMode && <div className="flex items-center gap-1 pr-3 sm:pr-4 shrink-0"><button onClick={() => toggleContactVisibility(item.id)} className={`p-1.5 transition-colors ${item.visible ? "text-muted-foreground hover:text-foreground" : "text-accent"}`} title={item.visible ? u.contactHide : u.contactShow}>{item.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button><button onClick={() => setEditingContactId(item.id)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><Edit3 size={13} /></button></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-8 sm:py-12 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-12">
        {editMode ? (
          <>
            <div className="flex flex-col gap-1">
              <input value={content.footerCopyright} onChange={(e) => updateContent("footerCopyright", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="KO copyright" />
              <input value={content.footerCopyrightEn} onChange={(e) => updateContent("footerCopyrightEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground/60 outline-none" style={MONO} placeholder="EN copyright" />
            </div>
            <div className="flex flex-col gap-1">
              <input value={content.footerLocation} onChange={(e) => updateContent("footerLocation", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground outline-none" style={MONO} placeholder="KO location" />
              <input value={content.footerLocationEn} onChange={(e) => updateContent("footerLocationEn", e.target.value)} className="bg-transparent border-b border-dashed border-accent/60 text-xs text-muted-foreground/60 outline-none" style={MONO} placeholder="EN location" />
            </div>
          </>
        ) : (
          <><span className="text-xs text-muted-foreground" style={MONO}>{c("footerCopyright")}</span><span className="text-xs text-muted-foreground" style={MONO}>{c("footerLocation")}</span></>
        )}
      </footer>
    </div>
  );
}
