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

// Rough, cheap real-vs-bot signal for GA4 segmenting — not meant to be airtight
// (a determined scraper can fake all of this), just enough to filter out the
// common case of cloud-hosted headless browsers and search-engine crawlers that
// still execute JS (and so still fire page views) without wiring up anything new.
// navigator.webdriver is set by Selenium/Playwright/Puppeteer unless the script
// specifically patches it away, which most simple scrapers don't bother doing.
const BOT_UA_PATTERN = /HeadlessChrome|PhantomJS|Puppeteer|Playwright|bot|crawl|spider|slurp|yeti/i;

export function detectSuspectedBot(): boolean {
  return navigator.webdriver === true || BOT_UA_PATTERN.test(navigator.userAgent);
}
