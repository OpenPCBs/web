import { ApiError } from "../http/api-error";

export const MAX_JSON_BYTES = 64 * 1024;
export const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isMutation(request: Request): boolean {
  return !SAFE_METHODS.has(request.method.toUpperCase());
}

/** Only the signed Stripe webhook is exempt; browser mutations fail closed. */
export function assertSameOrigin(request: Request): void {
  if (!isMutation(request)) return;
  const url = new URL(request.url);
  if (url.pathname === "/api/stripe/webhook") return;
  const origin = request.headers.get("origin");
  if (
    !origin ||
    origin !== url.origin ||
    ["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? "")
  ) {
    throw new ApiError(403, "untrusted_origin", "This request must come from this website.");
  }
}

/** Count streamed bytes as well as Content-Length, which cannot be trusted. */
export function boundRequestBody(request: Request): Request {
  const path = new URL(request.url).pathname;
  const multipart = path === "/api/files" || /^\/api\/admin\/products\/[^/]+\/image$/.test(path);
  const limit = multipart ? MAX_UPLOAD_BYTES + 64 * 1024 : MAX_JSON_BYTES;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > limit) {
    throw new ApiError(413, "body_too_large", "The request exceeds the size limit.");
  }
  if (!request.body) return request;
  let bytes = 0;
  const stream = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > limit) {
        throw new ApiError(413, "body_too_large", "The request exceeds the size limit.");
      }
      controller.enqueue(chunk);
    },
  }));
  return new Request(request, { body: stream, duplex: "half" } as RequestInit);
}

export async function readBoundedJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new ApiError(415, "unsupported_media_type", "Send an application/json request.");
  }
  let value: unknown;
  try {
    value = await boundRequestBody(request).json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "invalid_body", "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}
