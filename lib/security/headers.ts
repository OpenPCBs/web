/** Inline hydration currently requires unsafe-inline; never allow unsafe-eval in production. */
export function securityHeaders(request: Request, response: Response): Response {
  // Preserve upgrade responses and their platform-owned WebSocket handle.
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  const url = new URL(request.url);
  const local = ["localhost", "127.0.0.1", "terminal.local"].includes(url.hostname);
  headers.set("Content-Security-Policy", [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${local ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${local ? " ws: wss:" : ""}`,
    "frame-src https://gerber.ucamco.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
    ...(local ? [] : ["upgrade-insecure-requests"]),
  ].join("; "));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", /^\/(api\/auth|login|register|logout|forgot-password|reset-password)(\/|$)/.test(url.pathname) ? "no-referrer" : "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  if (url.protocol === "https:" && !local) headers.set("Strict-Transport-Security", "max-age=31536000");
  if (/^\/(api|admin|account|cart|login|register|logout|forgot-password|reset-password)(\/|$)/.test(url.pathname)) {
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  headers.delete("X-Powered-By");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
