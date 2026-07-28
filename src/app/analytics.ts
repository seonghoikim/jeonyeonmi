declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// gtag may not exist yet (script still loading) or ever (ad blocker) — every call
// site here is a "nice to have" signal, never something the UI should depend on.
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  window.gtag?.("event", name, params);
}

export function setAnalyticsUserProperties(props: Record<string, string>) {
  window.gtag?.("set", "user_properties", props);
}

// In-app WebViews (Instagram, KakaoTalk, Naver, Facebook, Line) often strip or rewrite
// the referrer, which is why GA4 shows a chunk of traffic as "(not set)" — this UA
// sniffing at least lets us tell *that* traffic apart from a real unknown referrer.
const IN_APP_BROWSER_PATTERNS: [RegExp, string][] = [
  [/Instagram/i, "instagram"],
  [/KAKAOTALK/i, "kakaotalk"],
  [/NAVER\(inapp/i, "naver"],
  [/FBAN|FBAV/i, "facebook"],
  [/Line\//i, "line"],
];

export function detectInAppBrowser(): string {
  const ua = navigator.userAgent;
  for (const [pattern, name] of IN_APP_BROWSER_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  return "none";
}
