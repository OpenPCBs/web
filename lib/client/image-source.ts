/** Only site-relative assets, same-origin object URLs and HTTPS images are allowed. */
export function safeImageSource(value: unknown, origin: string): { src: string; local: boolean } | null {
  if (typeof value !== "string" || !value || (/[<>"']/.test(value) || Array.from(value).some((character) => character.charCodeAt(0) <= 32))) return null;
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

/** Encode URL output without double-encoding valid existing percent escapes. */
export function encodeImageUrl(value: string): string {
  return encodeURI(value).replace(/%25([a-f0-9]{2})/gi, "%$1");
}
