import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { askCurator, type CuratorTurn } from "../../../lib/supabase";
import { usePortfolioContext } from "../../PortfolioContext";
import { trackEvent } from "../../analytics";
import { useModalLock } from "../../useModalLock";

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

type CuratorWidgetProps = {
  curatorEnabled: boolean;
  onToggleCurator: () => void;
};

export function CuratorWidget({ curatorEnabled, onToggleCurator }: CuratorWidgetProps) {
  const { lang, editMode, contactItems, u, MONO } = usePortfolioContext();
  const isKo = lang === "ko";
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<CuratorTurn[]>([{ role: "guide", text: isKo ? GREETING_KO : GREETING_EN }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorNotice, setErrorNotice] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const openedOnceRef = useRef(false);
  const panelRef = useModalLock<HTMLDivElement>(open, () => setOpen(false));

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

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

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setErrorNotice("");
    const nextTurns: CuratorTurn[] = [...turns, { role: "user", text: q }];
    setTurns(nextTurns);
    setBusy(true);
    trackEvent("curator_question", { lang });
    try {
      const answer = await askCurator(q, nextTurns.slice(-8), lang);
      setTurns((p) => [...p, { role: "guide", text: answer }]);
    } catch {
      setErrorNotice(isKo ? "답변을 가져오지 못했어요. 잠시 후 다시 시도해주세요." : "Couldn't get an answer. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-3">
      {open && (
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
              <button onClick={() => setOpen(false)} aria-label={isKo ? "닫기" : "Close"} className="text-muted-foreground hover:text-foreground p-1">
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {isKo
                ? "AI가 정리된 자료를 바탕으로 답변을 생성해요 · 오류가 있거나 자세하지 않을 수 있어요."
                : "Answers are generated by AI from curated material — they may contain errors or lack detail."}
            </p>
            {(instagram || blog) && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {isKo ? "더 자세한 문의는 " : "For more, reach out via "}
                {instagram && (
                  <a href={instagram.href} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/40 hover:decoration-accent">
                    {isKo ? "인스타그램" : "Instagram"}
                  </a>
                )}
                {instagram && blog && (isKo ? " 또는 " : " or ")}
                {blog && (
                  <a href={blog.href} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/40 hover:decoration-accent">
                    {isKo ? "블로그" : "the blog"}
                  </a>
                )}
                {isKo ? "로 연락해주세요." : "."}
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
            {errorNotice && <p className="text-[11px] text-destructive">{errorNotice}</p>}
          </div>

          {turns.length <= 1 && (
            <div className="shrink-0 px-3 pb-2 flex gap-1.5 overflow-x-auto hide-sb">
              {(isKo ? SUGGESTIONS_KO : SUGGESTIONS_EN).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
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
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={isKo ? "궁금한 점을 물어보세요" : "Ask a question"}
              rows={1}
              // 16px min — iOS Safari auto-zooms the whole page on focus for any
              // text input smaller than that, which read as a jarring, unwanted
              // "zoom in" the instant you started typing.
              className="flex-1 bg-transparent border border-border px-2.5 py-2 text-[16px] text-foreground outline-none resize-none max-h-24"
            />
            <button
              onClick={() => send()}
              disabled={busy || !input.trim()}
              aria-label={isKo ? "전송" : "Send"}
              className="shrink-0 bg-accent text-accent-foreground p-2 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => { setOpen((v) => !v); if (!openedOnceRef.current) { openedOnceRef.current = true; trackEvent("curator_open", { lang }); } }}
        aria-label={isKo ? "AI 안내 열기" : "Open AI guide"}
        className="relative w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg hover:brightness-110"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && (
          <span className="absolute -top-1.5 -right-1.5 text-[9px] uppercase tracking-wider bg-card text-accent border border-accent/60 px-1 py-0.5 rounded-full">
            beta
          </span>
        )}
      </button>
    </div>
  );
}
