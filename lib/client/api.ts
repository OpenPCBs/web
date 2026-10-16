/** Shared decoding for public and administrative API errors. */
export function apiMessage(payload: unknown, fallback = "We could not save your request. Please try again."): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error) return record.error;
  if (record.error && typeof record.error === "object") {
    const message = (record.error as Record<string, unknown>).message;
    if (typeof message === "string" && message) return message;
  }
  return typeof record.message === "string" && record.message ? record.message : fallback;
}

export function objectString(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : undefined;
}
