export type AuthEnvironment = {
  AUTH_SECRET?: string;
  AUTH_ORIGIN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
};

export function authCapabilities(env: AuthEnvironment) {
  const configured = Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length >= 32 && validAuthOrigin(env.AUTH_ORIGIN));
  return {
    configured,
    google: configured && Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    email: configured && Boolean(env.RESEND_API_KEY && env.AUTH_EMAIL_FROM),
  };
}

export function validAuthOrigin(value: string | undefined): string | null {
  try {
    if (!value) return null;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}
