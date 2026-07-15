import { Lock, Eye, EyeOff } from "lucide-react";
import { usePortfolioContext } from "../../PortfolioContext";

type PasswordModalProps = {
  pwInput: string;
  setPwInput: (v: string) => void;
  pwErrorMsg: string;
  setPwErrorMsg: (v: string) => void;
  showPw: boolean;
  setShowPw: (v: boolean) => void;
  pwSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

export function PasswordModal({ pwInput, setPwInput, pwErrorMsg, setPwErrorMsg, showPw, setShowPw, pwSubmitting, onSubmit, onCancel }: PasswordModalProps) {
  const { u, MONO, SERIF } = usePortfolioContext();
  return (
    <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-card border border-border p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6"><Lock size={14} className="text-accent" /><h3 className="text-sm font-light" style={SERIF}>{u.pwTitle}</h3></div>
        <div className="relative mb-3">
          <input type={showPw ? "text" : "password"} value={pwInput} onChange={(e) => { setPwInput(e.target.value); setPwErrorMsg(""); }} onKeyDown={(e) => e.key === "Enter" && onSubmit()} placeholder={u.pwPlaceholder} className="w-full bg-secondary border border-border text-foreground text-sm px-4 py-3 pr-10 outline-none focus:border-accent transition-colors" style={MONO} autoFocus />
          <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        </div>
        {pwErrorMsg && <p className="text-xs text-red-400 mb-3" style={MONO}>{pwErrorMsg}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onSubmit} disabled={pwSubmitting} className="flex-1 bg-accent text-accent-foreground text-xs tracking-widest py-2.5 hover:bg-accent/90 transition-colors disabled:opacity-50" style={MONO}>{u.pwConfirm}</button>
          <button onClick={onCancel} className="flex-1 border border-border text-muted-foreground text-xs tracking-widest py-2.5 hover:border-foreground/30 hover:text-foreground transition-colors" style={MONO}>{u.pwCancel}</button>
        </div>
      </div>
    </div>
  );
}
