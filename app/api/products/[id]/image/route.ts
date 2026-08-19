import { and, eq } from "drizzle-orm";
import { getDb, getFilesBucket } from "@/db";
import { products } from "@/db/schema";
import { ApiError, handleApiError } from "../../../_lib/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return serve(request, context, false);
}

export async function HEAD(request: Request, context: Context) {
  return serve(request, context, true);
}

async function serve(request: Request, context: Context, headOnly: boolean) {
  try {
    const { id } = await context.params;
    const [product] = await getDb()
      .select({ imageR2Key: products.imageR2Key })
      .from(products)
      .where(
        and(
          eq(products.id, id),
          eq(products.status, "published"),
          eq(products.active, true),
        ),
      )
      .limit(1);
    if (!product?.imageR2Key) {
      throw new ApiError(404, "not_found", "Product image not found.");
    }
    const object = headOnly
      ? await getFilesBucket().head(product.imageR2Key)
      : await getFilesBucket().get(product.imageR2Key);
    if (!object) throw new ApiError(404, "not_found", "Product image not found.");
    const headers = new Headers({
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Content-Length": String(object.size),
      ETag: object.httpEtag,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.headers.get("if-none-match") === object.httpEtag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(headOnly ? null : (object as R2ObjectBody).body, { headers });
  } catch (error) {
    return handleApiError(error);
  }
}
