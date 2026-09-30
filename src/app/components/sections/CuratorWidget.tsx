import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { askCurator, type CuratorTurn } from "../../../lib/supabase";
import { prefersReducedMotion } from "../../a11y";
import { usePortfolioContext } from "../../PortfolioContext";
import { trackEvent } from "../../analytics";
import { useModalLock } from "../../useModalLock";
import { safeHref } from "../../safeHref";

const SUGGESTIONS_KO = [
  "전연미 작가는 어떤 작업을 하나요?",
  "〈작열〉은 어떤 의미를 담은 작품인가요?",
  "〈코르셋〉이라는 제목은 왜 붙였나요?",
  "작품 제목에 '결'이 자주 나오는 이유가 뭔가요?",
  "어떤 재료와 기법을 쓰나요?",
];
const SUGGESTIONS_EN = [
  "What kind of work does Jeon Yeon-mi do?",
  "What does 〈Incandescence〉 mean?",
  "Why is this piece called 〈Corset〉?",
  "Why do so many titles include the word 'gyeol'?",
  "What materials and techniques does she use?",
];

const GREETING_KO = "안녕하세요, 전연미 작가의 활동을 함께하는 호이입니다. 작가와 작품에 대해 궁금한 점을 편하게 물어보세요. 이 답변은 AI가 정리된 자료를 바탕으로 자동 생성한 것이라 오류가 있거나 다소 부족할 수 있어요.";
const GREETING_EN = "Hi, I'm Hoi — I work alongside artist Jeon Yeon-mi. Feel free to ask about the artist and her work. These answers are generated automatically by AI from curated material, so they may be incomplete or slightly off.";

// Preview bubble duration: long enough to actually read the answer, short
// enough not to linger forever — scales with how much text there is to read,
// clamped so a very long answer still doesn't camp on screen indefinitely.
const PREVIEW_MAX_CHARS = 220;
const PREVIEW_MIN_MS = 4000;
const PREVIEW_MAX_MS = 12000;
function previewDurationMs(text: string): number {
  return Math.min(PREVIEW_MAX_MS, PREVIEW_MIN_MS + Math.floor(text.length / 100) * 1000);
}
function truncateForPreview(text: string): string {
  return text.length <= PREVIEW_MAX_CHARS ? text : text.slice(0, PREVIEW_MAX_CHARS).trimEnd() + "…";
}

export function CuratorWidget() {
  const { lang, editMode, contactItems, u, MONO, curatorEnabled, onToggleCurator, curatorOpen, setCuratorOpen } = usePortfolioContext();
  const isKo = lang === "ko";
  const [turns, setTurns] = useState<CuratorTurn[]>([{ role: "guide", text: isKo ? GREETING_KO : GREETING_EN }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  // One id per page load, so a visitor's consecutive questions can be read as one conversation.
  const sessionIdRef = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const logRef = useRef<HTMLDivElement>(null);
  const openedOnceRef = useRef(false);
  const wasOpenRef = useRef(curatorOpen);
  const previewRef = useRef<HTMLDivElement>(null);
  const panelRef = useModalLock<HTMLDivElement>(curatorOpen, () => setCuratorOpen(false));

  // Language toggled before any question was asked — re-issue the greeting in the new language.
  useEffect(() => {
    setTurns((prev) => (prev.length === 1 && prev[0].role === "guide" ? [{ role: "guide", text: isKo ? GREETING_KO : GREETING_EN }] : prev));
  }, [isKo]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [turns, busy]);

  // The panel unmounts on close, so logRef is a fresh node each time it
  // reopens and starts scrolled to the top — jump straight to the latest
  // message instead of leaving the oldest one showing.
  useEffect(() => {
    if (curatorOpen) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [curatorOpen]);

  useEffect(() => {
    if (curatorOpen && !openedOnceRef.current) { openedOnceRef.current = true; trackEvent("curator_open", { lang }); }
  }, [curatorOpen, lang]);

  // Panel just closed — surface the last answer as a speech bubble off the
  // docent button, but only if there was an actual exchange (not just the
  // greeting) and it wasn't left mid-answer.
  useEffect(() => {
    if (wasOpenRef.current && !curatorOpen) {
      const last = turns[turns.length - 1];
      if (turns.length > 1 && last?.role === "guide" && !busy) {
        setPreview(truncateForPreview(last.text));
      }
    }
    wasOpenRef.current = curatorOpen;
  }, [curatorOpen, turns, busy]);

  // Auto-dismiss on a text-length-scaled timer...
  useEffect(() => {
    if (!preview) return;
    const t = setTimeout(() => setPreview(null), previewDurationMs(preview));
    return () => clearTimeout(t);
  }, [preview]);

  // ...or immediately on a click/tap elsewhere, so it never lingers in the way
  // of whatever the visitor does next. Clicking the bubble itself reopens the
  // panel instead (handled by its own onClick). Scrolling is deliberately NOT
  // a dismiss trigger — page scroll (including momentum scroll right after
  // closing the panel) fires so easily that the bubble was closing almost
  // instantly.
  useEffect(() => {
    if (!preview) return;
    const dismiss = (e: Event) => {
      if (previewRef.current && e.target instanceof Node && previewRef.current.contains(e.target)) return;
      setPreview(null);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [preview]);

  // In edit mode we always show at least the on/off switch, even while
  // disabled, so turning it back on doesn't require leaving edit mode first.
  // Outside edit mode, a disabled widget is fully hidden from visitors.
  if (!editMode && !curatorEnabled) return null;

  if (editMode) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
        <button
          onClick={onToggleCurator}
          className="flex items-center gap-2 text-xs border border-dashed border-accent/50 text-accent bg-card px-3 py-1.5 hover:border-accent transition-colors"
          style={MONO}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${curatorEnabled ? "bg-accent" : "bg-muted-foreground/40"}`} />
          {isKo ? "AI 안내 위젯" : "AI Guide Widget"}: {curatorEnabled ? u.heroRotateOn : u.heroRotateOff}
        </button>
      </div>
    );
  }

  const instagram = contactItems.find((c) => c.type === "instagram" && c.visible);
  const blog = contactItems.find((c) => c.type === "blog" && c.visible);

  // Before the first real exchange there's no answer to base suggestions on,
  // so the static starter list is shown; after that, each answer comes with
  // its own 3 follow-ups grounded in what it actually covered.
  const chips = turns.length <= 1 ? (isKo ? SUGGESTIONS_KO : SUGGESTIONS_EN) : suggestions;

  // Shared by a fresh send and a retry — a retry reuses the turns array as it
  // already stands (the failed question is already its last entry) instead
  // of appending the question a second time, which would double it up.
  async function askAndAppend(question: string, turnsForRequest: CuratorTurn[]) {
    setBusy(true);
    setErrorNotice("");
    setSuggestions([]);
    try {
      const { answer, suggestions: next } = await askCurator(question, turnsForRequest.slice(-8), lang, { sessionId: sessionIdRef.current, page: window.location.pathname });
      setTurns((p) => [...p, { role: "guide", text: answer }]);
      setSuggestions(next);
      setFailedQuestion(null);
    } catch {
      setErrorNotice(isKo ? "답변을 가져오지 못했어요." : "Couldn't get an answer.");
      setFailedQuestion(question);
    } finally {
      setBusy(false);
    }
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const nextTurns: CuratorTurn[] = [...turns, { role: "user", text: q }];
    setTurns(nextTurns);
    trackEvent("curator_question", { lang });
    await askAndAppend(q, nextTurns);
  }

  function retry() {
    if (!failedQuestion || busy) return;
    trackEvent("curator_question_retry", { lang });
    askAndAppend(failedQuestion, turns);
  }

  return (
    <>
      {curatorOpen && (
        // Full-viewport, invisible — sits above the fixed nav bar (z-50) so a
        // click anywhere outside the panel closes it, including on the nav,
        // but below the panel itself (z-60) so clicks inside it never reach
        // this element in the first place (it's a sibling, not a parent —
        // nothing to stopPropagation against).
        <div
          className="fixed inset-0 z-[55]"
          onClick={() => setCuratorOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] flex flex-col items-end gap-3">
        {curatorOpen && (
          <div
            ref={panelRef}
            tabIndex={-1}
            className="w-[92vw] max-w-[380px] h-[70vh] max-h-[560px] bg-card border border-border flex flex-col shadow-2xl outline-none"
            role="dialog"
            aria-modal="true"
            aria-label={isKo ? "AI 안내" : "AI guide"}
          >
            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground" style={{ fontWeight: 500 }}>{isKo ? "전연미 작가 도슨트" : "Jeon Yeon-mi Docent"}</span>
                  <span className="text-[10px] uppercase tracking-wider border border-accent/60 text-accent px-1.5 py-0.5">BETA</span>
                </div>
                <button onClick={() => setCuratorOpen(false)} aria-label={isKo ? "닫기" : "Close"} className="text-muted-foreground hover:text-foreground p-1">
                  <X size={16} />
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {isKo ? (
                  <>AI가 정리된 자료를 바탕으로 답변을 생성해요<br />오류가 있거나 자세하지 않을 수 있어요.</>
                ) : (
                  <>Answers are generated by AI from curated material<br />— they may contain errors or lack detail.</>
                )}
              </p>
              {(instagram || blog) && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {isKo ? "AI 답변이 충분하지 않다면 " : "If the AI's answer isn't quite enough, reach out directly via "}
                  {instagram && (
                    <a href={safeHref(instagram.href)} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/40 hover:decoration-accent">
                      {isKo ? "인스타그램" : "Instagram"}
                    </a>
                  )}
                  {instagram && blog && (isKo ? " 또는 " : " or ")}
                  {blog && (
                    <a href={safeHref(blog.href)} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/40 hover:decoration-accent">
                      {isKo ? "블로그" : "the blog"}
                    </a>
                  )}
                  {isKo ? "로 직접 문의해주세요." : "."}
                </p>
              )}
            </div>

            <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                      t.role === "user" ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    {t.text}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-3 py-2 text-[13px] italic text-muted-foreground bg-secondary">
                    {isKo ? "생각하는 중…" : "Thinking…"}
                  </div>
                </div>
              )}
              {errorNotice && (
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-destructive">{errorNotice}</p>
                  {failedQuestion && (
                    <button
                      type="button"
                      onClick={retry}
                      disabled={busy}
                      className="text-[11px] underline text-foreground shrink-0 disabled:opacity-50"
                    >
                      {isKo ? "다시 시도" : "Retry"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {!busy && chips.length > 0 && (
              <div
                className="shrink-0 px-3 pb-2 flex gap-1.5 overflow-x-auto hide-sb"
                // Desktop mice only send vertical wheel deltas — without this,
                // a row that scrolls horizontally is only reachable by touch
                // drag or a trackpad's horizontal gesture, not a plain wheel.
                onWheel={(e) => {
                  if (e.deltaY === 0) return;
                  e.currentTarget.scrollLeft += e.deltaY;
                  e.preventDefault();
                }}
              >
                {chips.map((s) => (
                  <button
                    key={s}
                    onClick={() => { if (turns.length > 1) trackEvent("curator_suggestion_click", { lang }); send(s); }}
                    className="shrink-0 whitespace-nowrap text-[11px] border border-border text-foreground/80 px-2.5 py-1 hover:border-accent/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="shrink-0 border-t border-border p-2.5 flex items-end gap-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter while a Hangul syllable is still being composed just commits it — sending here fires the question early with a stray character.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
                }}
                placeholder={isKo ? "궁금한 점을 물어보세요" : "Ask a question"}
                rows={1}
                // 16px min — iOS Safari auto-zooms the whole page on focus for any
                // text input smaller than that, which read as a jarring, unwanted
                // "zoom in" the instant you started typing.
                className="flex-1 min-h-10 bg-transparent border border-border px-2.5 py-2 text-[16px] text-foreground outline-none resize-none max-h-24"
              />
              <button
                onClick={() => send()}
                disabled={busy || !input.trim()}
                aria-label={isKo ? "전송" : "Send"}
                className="shrink-0 h-10 w-10 flex items-center justify-center bg-accent text-accent-foreground disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        {!curatorOpen && preview && (
          <div
            ref={previewRef}
            onClick={() => { setCuratorOpen(true); setPreview(null); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") { setCuratorOpen(true); setPreview(null); } }}
            className="relative max-w-[260px] bg-card border border-border shadow-2xl px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground cursor-pointer"
          >
            {preview}
            <span className="absolute -bottom-[7px] right-6 w-3 h-3 bg-card border-r border-b border-border rotate-45" />
          </div>
        )}

        <button
          onClick={() => { setCuratorOpen((v) => !v); setPreview(null); }}
          aria-label={isKo ? "AI 안내 열기" : "Open AI guide"}
          className="relative w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg hover:brightness-110"
        >
          {curatorOpen ? <X size={22} /> : <MessageCircle size={22} />}
          {!curatorOpen && (
            <span className="absolute -top-1.5 -right-1.5 text-[9px] uppercase tracking-wider bg-card text-accent border border-accent/60 px-1 py-0.5 rounded-full">
              beta
            </span>
          )}
        </button>
      </div>
    </>
  );
}
