const reserved = /^\/(api\/auth|login|register|logout|forgot-password|reset-password)(\/|$)/;

export function safeReturnPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://trace.invalid");
    if (url.origin !== "https://trace.invalid" || reserved.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export function signInPath(returnTo = "/account"): string {
  return `/login?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = "/"): string {
  return `/logout?return_to=${encodeURIComponent(safeReturnPath(returnTo, "/"))}`;
}
