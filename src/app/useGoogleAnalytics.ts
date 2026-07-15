import { useEffect } from "react";
import { GA_ID } from "./data";

export function useGoogleAnalytics() {
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
