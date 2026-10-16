export const PRIVACY_KEY = "trace:privacy:v1";
export const PRIVACY_EVENT = "trace:privacy-changed";
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export type PrivacyChoice = { version: 1; externalMedia: boolean; updatedAt: number };

export function hasGlobalPrivacyControl(): boolean {
  return typeof navigator !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function parsePrivacyChoice(raw: string | null, now = Date.now()): PrivacyChoice | null {
  try {
    const value = JSON.parse(raw || "null") as Partial<PrivacyChoice> | null;
    if (value?.version !== 1 || typeof value.externalMedia !== "boolean" || typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || value.updatedAt > now || now - value.updatedAt > MAX_AGE_MS) return null;
    return value as PrivacyChoice;
  } catch { return null; }
}

let memoryChoice: PrivacyChoice | null = null;
export function readPrivacyChoice(): PrivacyChoice | null {
  if (typeof window === "undefined") return null;
  try { return parsePrivacyChoice(window.localStorage.getItem(PRIVACY_KEY)) ?? memoryChoice; }
  catch { return memoryChoice; }
}

export function savePrivacyChoice(externalMedia: boolean): void {
  memoryChoice = { version: 1, externalMedia: externalMedia && !hasGlobalPrivacyControl(), updatedAt: Date.now() };
  try { window.localStorage.setItem(PRIVACY_KEY, JSON.stringify(memoryChoice)); }
  catch { /* Keep the choice for this page if browser storage is unavailable. */ }
  window.dispatchEvent(new Event(PRIVACY_EVENT));
}
