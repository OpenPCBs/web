/** Only site-relative assets, same-origin object URLs and HTTPS images are allowed. */
export function safeImageSource(value: string | undefined, origin: string): { src: string; local: boolean } | null {
  if (!value || /[\u0000-\u0020<>"']/.test(value)) return null;
  try {
    const url = new URL(value, origin);
    if (url.username || url.password) return null;
    if (value.startsWith("/") && !value.startsWith("//") && url.origin === origin) {
      return { src: `${url.pathname}${url.search}${url.hash}`, local: true };
    }
    if (url.protocol === "blob:" && url.origin === origin) return { src: url.href, local: true };
    if (url.protocol === "https:" && value.startsWith("https://")) return { src: url.href, local: url.origin === origin };
  } catch { /* Malformed URLs never reach an image element. */ }
  return null;
}
