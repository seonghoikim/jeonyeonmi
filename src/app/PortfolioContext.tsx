import { createContext, useContext, type ReactElement } from "react";
import { UI } from "./data";
import type { Lang, ContentKey } from "./data";

export type PortfolioContextValue = {
  lang: Lang;
  u: (typeof UI)[Lang];
  MONO: { fontFamily: string };
  SERIF: Record<string, string | number>;
  SANS: Record<string, string | number>;
  hSize: (ko: string, en: string, lang: Lang) => string;
  content: Record<string, string>;
  updateContent: (field: ContentKey, value: string) => void;
  c: (field: string) => string;
  C: (props: { field: ContentKey; multi?: boolean; rows?: number; className?: string }) => ReactElement;
  editMode: boolean;
  img: (key: string) => string | null;
  uploadingTarget: string | null;
  dragSrc: React.MutableRefObject<number | null>;
  dragOverKey: string | null;
  setDragOverKey: (key: string | null) => void;
  scrollTo: (id: string) => void;
  scrollToActivity: (activityId: number) => void;
  triggerUpload: (target: string, label?: string) => void;
  openLightbox: (src: string, showZoom?: boolean) => void;
};

export const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function usePortfolioContext(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolioContext must be used within PortfolioContext.Provider");
  return ctx;
}
