// Editor-entered links (press articles, exhibition pages, contacts) end up in
// href attributes on the public site — a "javascript:" value there would run
// script on click. Only web/mail/phone links and same-site paths pass; anything
// else renders as a dead "#" link instead.
export function safeHref(url: string | undefined | null): string {
  if (!url) return "#";
  const v = url.trim();
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const { protocol } = new URL(v);
    return ["http:", "https:", "mailto:", "tel:"].includes(protocol) ? v : "#";
  } catch {
    return "#";
  }
}
