export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

// Moves an item one step within a *filtered* view (e.g. a tag/status filter),
// translating back to the right positions in the full underlying list.
export function moveInFiltered<T extends { id: number | string }>(
  full: T[], filtered: T[], idx: number, dir: -1 | 1
): T[] {
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= filtered.length) return full;
  const fromId = filtered[idx].id;
  const toId = filtered[targetIdx].id;
  const fromFullIdx = full.findIndex((x) => x.id === fromId);
  const toFullIdx = full.findIndex((x) => x.id === toId);
  return moveItem(full, fromFullIdx, toFullIdx);
}

/* ─── font helpers ───────────────────────────────────── */
export const MONO = { fontFamily: "'DM Mono', monospace" };
// Heading: same family as body but ultra-light + wide tracking for distinction
export const serifOf = (lang: Lang) =>
  lang === "ko"
    ? { fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 200, letterSpacing: "0.04em" }
    : { fontFamily: "'Inter', sans-serif", fontWeight: 200, letterSpacing: "0.08em" };
export const sansOf = (lang: Lang) =>
  lang === "ko"
    ? { fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300 }
    : { fontFamily: "'Inter', sans-serif", fontWeight: 300 };
export const hSize = (ko: string, en: string, lang: Lang) => (lang === "ko" ? ko : en);

export const getYoutubeId = (url: string) =>
  url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/)?.[1] ?? null;

/* ─── types ─────────────────────────────────────────── */
export type Lang = "ko" | "en";
export type ContentKey = keyof typeof initContent;
export type CurrentExhibition = { id: number; title: string; titleEn: string; venue: string; venueEn: string; location: string; locationEn: string; startDate: string; endDate: string; status: "진행중" | "예정" | "지난전시"; visible: boolean; url?: string; };
export type Artwork = { id: number; title: string; titleEn: string; year: string; medium: string; mediumEn: string; size: string; image: string; category: string; categoryEn: string; series: string; collected: boolean; description?: string; descriptionEn?: string; };
export type Series = { id: number; name: string; nameEn: string; };
export type Slide = { id: number; heading: string; headingEn: string; body: string; bodyEn: string; };
export type ExhibitionEntry = { id: number; year: string; title: string; titleEn: string; venue: string; venueEn: string; location: string; tag: "전시" | "수상" | "아트페어"; activityId?: number; };
export type ActivityPhoto = { id: number; caption: string; captionEn: string; };
export type VideoEntry = { id: number; youtubeUrl: string; title: string; titleEn: string; description: string; descriptionEn: string; };
export type ContactItem = { id: string; type: "email" | "phone" | "instagram" | "blog"; labelKo: string; labelEn: string; display: string; href: string; visible: boolean; };
export type PressEntry = { id: number; url: string; outlet: string; outletEn: string; title: string; titleEn: string; date: string; image: string; type: "기사" | "인터뷰" | "방송"; };

/* ─── page content ───────────────────────────────────── */
export const initContent = {
  heroName: "전연미", heroNameEn: "Jeon Yeon-mi",
  heroSub: "JEON YEON-MI", heroSubEn: "JEON YEON-MI",
  heroDesc: "형태와 기억 사이, 보이지 않는 경계를 탐구하는 한국 현대미술 작가",
  heroDescEn: "A Korean contemporary artist exploring invisible boundaries between form and memory.",
  heroCta: "작품 보기", heroCtaEn: "View Works",
  s01label: "01 — 현재 전시 · 예정", s01labelEn: "01 — Current · Upcoming",
  s01heading: "전시 일정", s01headingEn: "Exhibition Schedule",
  s02label: "03 — 작품", s02labelEn: "03 — Works",
  s02heading: "Selected Works", s02headingEn: "Selected Works",
  s03label: "02 — 작가노트", s03labelEn: "02 — Statement",
  s03heading: "Artist Statement", s03headingEn: "Artist Statement",
  s04label: "04 — 전시 및 수상", s04labelEn: "04 — Exhibitions & Awards",
  s04heading: "전시 및 수상이력", s04headingEn: "Exhibitions & Awards",
  s05label: "06 — 활동", s05labelEn: "06 — Activities",
  s05heading: "Activities", s05headingEn: "Activities",
  s06label: "07 — 영상", s06labelEn: "07 — Video",
  s06heading: "Video", s06headingEn: "Video",
  s07label: "08 — 연락처", s07labelEn: "08 — Contact",
  s07heading: "작품 문의 및\n협업 제안", s07headingEn: "Inquiries &\nCollaboration",
  s07desc: "전시, 아트페어, 기관 협업, 작품 구입에 관한 문의는 아래 연락처를 통해 주시기 바랍니다.",
  s07descEn: "For exhibition, art fair, institutional collaboration, and artwork purchase inquiries, please use the contacts below.",
  s08label: "05 — 보도자료", s08labelEn: "05 — Press",
  s08heading: "Press", s08headingEn: "Press",
  footerCopyright: "© 2024 전연미. All rights reserved.",
  footerCopyrightEn: "© 2024 Jeon Yeon-mi. All rights reserved.",
  footerLocation: "서울특별시 종로구",
  footerLocationEn: "Jongno-gu, Seoul",
};

/* ─── UI labels ──────────────────────────────────────── */
export const UI = {
  ko: {
    langLabel: "EN",
    navCurrent: "현재 전시", navWorks: "작품", navStatement: "작가노트", navExhibitions: "전시이력", navPress: "보도자료", navActivities: "활동", navVideo: "영상", navContact: "연락처",
    currentAdd: "전시 추가", currentUpload: "포스터 교체", currentUploading: "업로드 중…",
    statusOngoing: "진행중", statusUpcoming: "예정", statusPast: "지난전시", viewMore: "자세히 보기",
    showPastEx: "지난 전시 보기", hidePastEx: "접기",
    worksCollected: "컬렉션", worksNotCollected: "미수집", fieldCollected: "소장",
    worksAdd: "작품 추가", worksAll: "전체", seriesAdd: "시리즈 추가",
    worksUpload: "이미지 교체", worksUploading: "업로드 중…",
    worksInquiry: "작품 문의 →", worksDelete: "삭제", worksNoImg: "이미지 없음",
    worksViewOriginal: "원본 보기",
    fieldYear: "연도", fieldMedium: "재료", fieldSize: "크기", fieldCategory: "분류", fieldSeries: "시리즈",
    fieldDescription: "작품 설명", descriptionPlaceholderKo: "작품 설명 (한국어)", descriptionPlaceholderEn: "Description (English)",
    statAddSlide: "슬라이드 추가", statFirstSlide: "첫 슬라이드 추가",
    statNone: "작가노트가 없습니다", statDeleteSlide: "이 슬라이드 삭제",
    statUpload: "이미지 교체", statUploading: "업로드 중…",
    exAdd: "항목 추가", exAll: "전체", exExhibition: "전시", exAward: "수상", exFair: "아트페어", exNoLink: "연결 없음",
    pressAdd: "보도자료 추가", pressUrlPh: "기사 URL 입력", pressFetch: "가져오기", pressFetching: "가져오는 중…",
    pressFetchError: "미리보기를 가져오지 못했습니다. 직접 입력해주세요.", pressNoUrl: "URL을 먼저 입력하세요",
    pressArticle: "기사", pressInterview: "인터뷰", pressBroadcast: "방송",
    activityAdd: "사진 추가", activityUpload: "사진 업로드", activityUploading: "업로드 중…", activityViewOriginal: "원본 보기",
    videoAdd: "영상 추가", videoUrlPh: "YouTube URL 입력",
    contactHide: "숨기기", contactShow: "보이기", contactPick: "연락 방법 선택",
    contactEditDisplay: "표시 텍스트", contactEditHref: "링크 URL",
    editLabel: "편집", editDone: "완료", editBanner: "편집 모드 — 항목을 클릭해 수정하세요",
    pwTitle: "편집 모드 잠금 해제", pwPlaceholder: "비밀번호 입력",
    pwConfirm: "확인", pwError: "비밀번호가 올바르지 않습니다", pwCancel: "취소",
    lbClose: "닫기", lbReset: "원래 크기",
    lbHint: "스크롤 = 확대/축소 · 드래그 = 이동 · 0 = 초기화 · ESC = 닫기",
  },
  en: {
    langLabel: "KO",
    navCurrent: "Now", navWorks: "Works", navStatement: "Statement", navExhibitions: "Exhibitions", navPress: "Press", navActivities: "Activities", navVideo: "Video", navContact: "Contact",
    currentAdd: "Add Exhibition", currentUpload: "Replace Poster", currentUploading: "Uploading…",
    statusOngoing: "Ongoing", statusUpcoming: "Upcoming", statusPast: "Past", viewMore: "View More",
    showPastEx: "Past Exhibitions", hidePastEx: "Hide",
    worksCollected: "Collected", worksNotCollected: "Available", fieldCollected: "Collection",
    worksAdd: "Add Work", worksAll: "All", seriesAdd: "Add Series",
    worksUpload: "Replace Image", worksUploading: "Uploading…",
    worksInquiry: "Inquire →", worksDelete: "Delete", worksNoImg: "No image",
    worksViewOriginal: "View Original",
    fieldYear: "Year", fieldMedium: "Medium", fieldSize: "Size", fieldCategory: "Category", fieldSeries: "Series",
    fieldDescription: "Description", descriptionPlaceholderKo: "설명 (한국어)", descriptionPlaceholderEn: "Description (English)",
    statAddSlide: "Add Slide", statFirstSlide: "Add First Slide",
    statNone: "No statements yet", statDeleteSlide: "Delete this slide",
    statUpload: "Replace Image", statUploading: "Uploading…",
    exAdd: "Add Item", exAll: "All", exExhibition: "Exhibition", exAward: "Award", exFair: "ArtFair", exNoLink: "No link",
    pressAdd: "Add Press Item", pressUrlPh: "Enter article URL", pressFetch: "Fetch", pressFetching: "Fetching…",
    pressFetchError: "Couldn't fetch a preview. Please fill it in manually.", pressNoUrl: "Enter a URL first",
    pressArticle: "Article", pressInterview: "Interview", pressBroadcast: "Broadcast",
    activityAdd: "Add Photo", activityUpload: "Upload Photo", activityUploading: "Uploading…", activityViewOriginal: "View Original",
    videoAdd: "Add Video", videoUrlPh: "Enter YouTube URL",
    contactHide: "Hide", contactShow: "Show", contactPick: "Choose a contact method",
    contactEditDisplay: "Display text", contactEditHref: "Link URL",
    editLabel: "Edit", editDone: "Done", editBanner: "Edit Mode — click items to edit",
    pwTitle: "Unlock Edit Mode", pwPlaceholder: "Enter password",
    pwConfirm: "Confirm", pwError: "Incorrect password", pwCancel: "Cancel",
    lbClose: "Close", lbReset: "Reset",
    lbHint: "scroll = zoom · drag = pan · 0 = reset · esc = close",
  },
} as const;

/* ─── initial data ───────────────────────────────────── */
export const initCurrentEx: CurrentExhibition[] = [
  { id: 1, title: "형태와 기억 사이", titleEn: "Between Form and Memory", venue: "국립현대미술관", venueEn: "MMCA", location: "서울", locationEn: "Seoul", startDate: "2024.11.15", endDate: "2025.03.02", status: "진행중", visible: true },
  { id: 2, title: "Seoul Art Week 2025", titleEn: "Seoul Art Week 2025", venue: "DDP 동대문디자인플라자", venueEn: "DDP Dongdaemun Design Plaza", location: "서울", locationEn: "Seoul", startDate: "2025.04.10", endDate: "2025.04.20", status: "예정", visible: true },
  { id: 3, title: "Asia Contemporary Art Show", titleEn: "Asia Contemporary Art Show", venue: "홍콩 컨벤션센터", venueEn: "Hong Kong Convention Centre", location: "홍콩", locationEn: "Hong Kong", startDate: "2025.05.30", endDate: "2025.06.02", status: "예정", visible: true },
  { id: 4, title: "침묵의 언어", titleEn: "Language of Silence", venue: "아트선재센터", venueEn: "Art Sonje Center", location: "서울", locationEn: "Seoul", startDate: "2023.09.01", endDate: "2023.10.28", status: "지난전시", visible: true },
  { id: 5, title: "Boundaries Unseen", titleEn: "Boundaries Unseen", venue: "Galerie Templon", venueEn: "Galerie Templon", location: "파리, 프랑스", locationEn: "Paris, France", startDate: "2023.04.06", endDate: "2023.05.20", status: "지난전시", visible: true },
  { id: 6, title: "Seoul Contemporary", titleEn: "Seoul Contemporary", venue: "KIAF SEOUL", venueEn: "KIAF SEOUL", location: "서울", locationEn: "Seoul", startDate: "2022.09.02", endDate: "2022.09.05", status: "지난전시", visible: true },
];
export const initSeries: Series[] = [
  { id: 1, name: "부유하는 기억", nameEn: "Floating Memory" },
  { id: 2, name: "경계의 언어", nameEn: "Language of Borders" },
  { id: 3, name: "잔향", nameEn: "Reverberation" },
];
export const initArtworks: Artwork[] = [
  { id: 1, title: "부유하는 기억 I", titleEn: "Floating Memory I", year: "2024", medium: "캔버스에 유채", mediumEn: "Oil on canvas", size: "130 × 162 cm", image: "", category: "회화", categoryEn: "Painting", series: "부유하는 기억", collected: false },
  { id: 2, title: "조용한 파동", titleEn: "Silent Wave", year: "2024", medium: "캔버스에 아크릴", mediumEn: "Acrylic on canvas", size: "97 × 130 cm", image: "", category: "회화", categoryEn: "Painting", series: "경계의 언어", collected: true },
  { id: 3, title: "경계 사이에서", titleEn: "Between Borders", year: "2023", medium: "캔버스에 혼합재료", mediumEn: "Mixed media on canvas", size: "162 × 130 cm", image: "", category: "혼합매체", categoryEn: "Mixed Media", series: "경계의 언어", collected: false },
  { id: 4, title: "소리 없는 대화", titleEn: "Soundless Dialogue", year: "2023", medium: "종이에 수채", mediumEn: "Watercolor on paper", size: "76 × 56 cm", image: "", category: "수채화", categoryEn: "Watercolor", series: "경계의 언어", collected: true },
  { id: 5, title: "잔향 II", titleEn: "Reverberation II", year: "2022", medium: "캔버스에 유채", mediumEn: "Oil on canvas", size: "200 × 160 cm", image: "", category: "회화", categoryEn: "Painting", series: "잔향", collected: false },
  { id: 6, title: "흔적의 지층", titleEn: "Stratum of Traces", year: "2022", medium: "캔버스에 혼합재료", mediumEn: "Mixed media on canvas", size: "130 × 97 cm", image: "", category: "혼합매체", categoryEn: "Mixed Media", series: "잔향", collected: true },
];
export const initSlides: Slide[] = [
  { id: 1, heading: "기억과 형태,\n그 경계에서", headingEn: "Between Memory\nand Form", body: "나의 작업은 기억이 물리적 형태로 변환되는 순간을 포착하는 것으로부터 시작된다. 우리가 경험하는 모든 것들은 시간 속에서 서서히 형태를 잃어가지만, 그 흔적만은 예상치 못한 방식으로 캔버스 위에 남는다.", bodyEn: "My work begins with capturing the moment when memory transforms into physical form. Everything we experience gradually loses its shape over time, yet its traces remain on the canvas in unexpected ways." },
  { id: 2, heading: "색과 감각의\n퇴적층", headingEn: "Strata of Color\nand Sensation", body: "나는 붓질 하나하나가 단순한 물감의 흔적이 아닌, 특정 감각의 퇴적층이라고 믿는다. 색은 감정의 온도이고, 형태는 기억의 윤곽이다.", bodyEn: "I believe each brushstroke is not merely a trace of paint but a sedimentary layer of sensation. Color is the temperature of emotion, and form is the outline of memory." },
  { id: 3, heading: "보이지 않는 것에\n형태를 부여하며", headingEn: "Giving Form to\nthe Invisible", body: "작업을 통해 나는 보이지 않는 것을 보이게 하고, 말해지지 않은 것들에 형태를 부여하려 한다. 관람자가 작품 앞에 서는 순간, 그 침묵 속에서 자신만의 기억과 감각을 발견하기를 바란다.", bodyEn: "Through my work I seek to make the invisible visible — to give form to what remains unspoken. When a viewer stands before the work, I hope they discover their own memory within that silence." },
];
export const initExhibitions: ExhibitionEntry[] = [
  { id: 1, year: "2024", title: "형태와 기억 사이", titleEn: "Between Form and Memory", venue: "국립현대미술관", venueEn: "MMCA", location: "서울", tag: "전시", activityId: 1 },
  { id: 2, year: "2024", title: "한국 현대회화의 지금", titleEn: "Korean Contemporary Painting Now", venue: "부산시립미술관", venueEn: "Busan Museum of Art", location: "부산", tag: "전시", activityId: 4 },
  { id: 3, year: "2023", title: "Boundaries Unseen", titleEn: "Boundaries Unseen", venue: "Galerie Templon", venueEn: "Galerie Templon", location: "파리, 프랑스", tag: "전시" },
  { id: 4, year: "2023", title: "제23회 이중섭미술상 수상", titleEn: "23rd Lee Jung-seob Art Award", venue: "조선일보미술관", venueEn: "Chosun Ilbo Art Museum", location: "서울", tag: "수상", activityId: 3 },
  { id: 5, year: "2023", title: "침묵의 언어", titleEn: "Language of Silence", venue: "아트선재센터", venueEn: "Art Sonje Center", location: "서울", tag: "전시", activityId: 3 },
  { id: 6, year: "2022", title: "Seoul Contemporary", titleEn: "Seoul Contemporary", venue: "KIAF SEOUL", venueEn: "KIAF SEOUL", location: "서울", tag: "전시" },
  { id: 7, year: "2021", title: "감각의 지형", titleEn: "Topography of Sensation", venue: "대구미술관", venueEn: "Daegu Art Museum", location: "대구", tag: "전시" },
  { id: 8, year: "2019", title: "제10회 송은미술대상 우수상", titleEn: "10th Songeun Art Award", venue: "송은아트스페이스", venueEn: "Songeun Art Space", location: "서울", tag: "수상" },
];
export const initActivityPhotos: ActivityPhoto[] = [
  { id: 1, caption: "2024 개인전 설치 작업", captionEn: "2024 Solo Exhibition Installation" },
  { id: 2, caption: "작가 작업실에서", captionEn: "In the Artist's Studio" },
  { id: 3, caption: "아트선재센터 오프닝", captionEn: "Art Sonje Center Opening" },
  { id: 4, caption: "부산시립미술관 단체전", captionEn: "Busan Museum of Art Group Exhibition" },
];
export const initVideos: VideoEntry[] = [
  { id: 1, youtubeUrl: "", title: "작가 인터뷰 — 부유하는 기억", titleEn: "Artist Interview — Floating Memory", description: "국립현대미술관 개인전 작가 인터뷰", descriptionEn: "Artist interview at MMCA solo exhibition" },
  { id: 2, youtubeUrl: "", title: "전시 설치 과정", titleEn: "Exhibition Installation Process", description: "2024 개인전 설치 작업 과정", descriptionEn: "Installation process for 2024 solo exhibition" },
];
export const initContacts: ContactItem[] = [
  { id: "email", type: "email", labelKo: "이메일", labelEn: "Email", display: "studio@jeonyeonmi.com", href: "mailto:studio@jeonyeonmi.com", visible: true },
  { id: "phone", type: "phone", labelKo: "전화", labelEn: "Phone", display: "+82 10-0000-0000", href: "tel:+821000000000", visible: true },
  { id: "instagram", type: "instagram", labelKo: "인스타그램", labelEn: "Instagram", display: "@jeonyeonmi_art", href: "https://instagram.com/jeonyeonmi_art", visible: true },
  { id: "blog", type: "blog", labelKo: "네이버 블로그", labelEn: "Naver Blog", display: "blog.naver.com/jeonyeonmi", href: "https://blog.naver.com/jeonyeonmi", visible: true },
];
export const initPress: PressEntry[] = [];

/* ─── global CSS ─────────────────────────────────────── */
export const GLOBAL_CSS = `
/* scrollbar hide */
.hide-sb { scrollbar-width: none; -ms-overflow-style: none; }
.hide-sb::-webkit-scrollbar { display: none; }

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
  .slide-text-area { max-height: 220px !important; overflow-y: auto !important; }
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

export const GA_ID = "G-MYX4F18WM9";
