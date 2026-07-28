import { useEffect } from "react";
import { GA_ID } from "./data";
import type { Lang } from "./data";
import { detectInAppBrowser, setAnalyticsUserProperties } from "./analytics";

export function useGoogleAnalytics(lang: Lang) {
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

  // Set once per load — lets every report be segmented by whether the visit came
  // through an in-app WebView (see analytics.ts for why that matters here).
  useEffect(() => {
    setAnalyticsUserProperties({ in_app_browser: detectInAppBrowser() });
  }, []);

  // Site language is a toggle, not a one-time load fact, so it's re-sent whenever it
  // changes rather than only on mount.
  useEffect(() => {
    setAnalyticsUserProperties({ site_language: lang });
  }, [lang]);
}
