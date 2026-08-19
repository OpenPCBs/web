import { eq } from "drizzle-orm";
import { requireAdminRequest } from "@/app/admin-auth";
import { getDb, getFilesBucket } from "@/db";
import { products } from "@/db/schema";
import { ApiError, adminError, auditAdminAction } from "../../../_lib/admin-api";
import { serializeProduct } from "../../product-fields";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const admin = await requireAdminRequest(request);
    if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
      throw new ApiError(415, "unsupported_media_type", "Upload an image as multipart/form-data.");
    }
    const { id } = await context.params;
    const db = getDb();
    const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!current) throw new ApiError(404, "not_found", "Product not found.");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "invalid_field", "file is required.");
    }
    const extension = IMAGE_TYPES[file.type.toLowerCase()];
    if (!extension) {
      throw new ApiError(415, "unsupported_image", "Use JPEG, PNG, WebP, or AVIF.");
    }
    if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
      throw new ApiError(413, "image_too_large", "Product images must be 8 MiB or smaller.");
    }

    const r2Key = `product-images/${crypto.randomUUID()}.${extension}`;
    const bucket = getFilesBucket();
    await bucket.put(r2Key, new Uint8Array(await file.arrayBuffer()), {
      httpMetadata: { contentType: file.type.toLowerCase() },
      customMetadata: { productId: current.id },
    });
    const imageUrl = `/api/products/${current.id}/image`;
    const now = new Date().toISOString();
    try {
      await db
        .update(products)
        .set({ imageR2Key: r2Key, imageUrl, updatedAt: now })
        .where(eq(products.id, current.id));
    } catch (error) {
      await bucket.delete(r2Key);
      throw error;
    }
    if (current.imageR2Key && current.imageR2Key !== r2Key) {
      await bucket.delete(current.imageR2Key);
    }
    const [updated] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    await auditAdminAction(db, {
      actorUserId: admin.userId,
      action: "product.image_updated",
      entityType: "product",
      entityId: id,
      before: { imageConfigured: Boolean(current.imageR2Key) },
      after: { imageConfigured: true },
    });
    return Response.json({ product: serializeProduct(updated), imageUrl });
  } catch (error) {
    return adminError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const admin = await requireAdminRequest(request);
    const { id } = await context.params;
    const db = getDb();
    const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!current) throw new ApiError(404, "not_found", "Product not found.");
    await db
      .update(products)
      .set({ imageR2Key: null, imageUrl: null, updatedAt: new Date().toISOString() })
      .where(eq(products.id, id));
    if (current.imageR2Key) await getFilesBucket().delete(current.imageR2Key);
    const [updated] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    await auditAdminAction(db, {
      actorUserId: admin.userId,
      action: "product.image_removed",
      entityType: "product",
      entityId: id,
      before: { imageConfigured: Boolean(current.imageR2Key) },
      after: { imageConfigured: false },
    });
    return Response.json({ product: serializeProduct(updated), imageUrl: null });
  } catch (error) {
    return adminError(error);
  }
}
