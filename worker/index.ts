import { ApiError, errorResponse } from "../lib/http/api-error";
import { assertSameOrigin, boundRequestBody, isMutation } from "../lib/security/request";
import { securityHeaders } from "../lib/security/headers";
import { enforceRateLimit } from "../lib/security/rate-limit";
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/") && isMutation(request)) {
        assertSameOrigin(request);
        request = boundRequestBody(request);
        if (url.pathname !== "/api/stripe/webhook") await enforceRateLimit(request, env.DB);
      }
      return securityHeaders(request, await serve(request, env, ctx));
    } catch (error) {
      const failure = error instanceof ApiError ? error : new ApiError(503, "service_unavailable", "The service is temporarily unavailable.");
      const response = errorResponse(failure);
      if (failure.status === 429) response.headers.set("Retry-After", "60");
      return securityHeaders(request, response);
    }
  },
};

async function serve(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
}

export default worker;
