import { eq } from "drizzle-orm";
import { getChatGPTUserFromRequest } from "@/app/chatgpt-auth";
import { getDb, getFilesBucket } from "@/db";
import { designs, files, revisions } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  readJsonObject,
  requireApiUser,
} from "../../_lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return serveFile(request, context, false);
}

export async function HEAD(request: Request, context: RouteContext) {
  return serveFile(request, context, true);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = requireApiUser(request);
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const visibility = body.visibility;
    if (visibility !== "private" && visibility !== "public") {
      throw new ApiError(400, "invalid_field", "visibility must be private or public.");
    }
    const db = getDb();
    const [row] = await fileAccessRow(db, id);
    if (!row || row.file.ownerId !== user.userId) {
      throw new ApiError(404, "not_found", "File not found.");
    }
    if (
      visibility === "public" &&
      (row.publicationStatus !== "published" || row.lifecycleStatus !== "published")
    ) {
      throw new ApiError(
        409,
        "revision_not_published",
        "Publish this revision before making its files public.",
      );
    }
    await db.update(files).set({ visibility }).where(eq(files.id, id));
    return Response.json({ file: { ...row.file, visibility } });
  } catch (error) {
    return handleApiError(error);
  }
}

async function serveFile(
  request: Request,
  context: RouteContext,
  headOnly: boolean,
): Promise<Response> {
  try {
    const { id } = await context.params;
    const db = getDb();
    const [row] = await fileAccessRow(db, id);
    if (!row) throw new ApiError(404, "not_found", "File not found.");

    const user = getChatGPTUserFromRequest(request);
    const publicAccess =
      row.file.visibility === "public" &&
      row.publicationStatus === "published" &&
      row.lifecycleStatus === "published";
    if (row.file.ownerId !== user?.userId && !publicAccess) {
      throw new ApiError(404, "not_found", "File not found.");
    }

    const bucket = getFilesBucket();
    const object = headOnly
      ? await bucket.head(row.file.r2Key)
      : await bucket.get(row.file.r2Key);
    if (!object) throw new ApiError(404, "object_missing", "Stored file not found.");

    const headers = new Headers({
      "Content-Type": row.file.mediaType,
      "Content-Length": String(object.size),
      "Content-Disposition": contentDisposition(row.file.originalName),
      ETag: object.httpEtag,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": publicAccess
        ? "public, max-age=3600, immutable"
        : "private, no-store",
    });
    if (request.headers.get("if-none-match") === object.httpEtag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(headOnly ? null : (object as R2ObjectBody).body, { headers });
  } catch (error) {
    return handleApiError(error);
  }
}

function fileAccessRow(db: ReturnType<typeof getDb>, id: string) {
  return db
    .select({
      file: files,
      publicationStatus: designs.publicationStatus,
      lifecycleStatus: revisions.lifecycleStatus,
    })
    .from(files)
    .innerJoin(designs, eq(files.designId, designs.id))
    .innerJoin(revisions, eq(files.revisionId, revisions.id))
    .where(eq(files.id, id))
    .limit(1);
}

function contentDisposition(name: string): string {
  const ascii = name
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 180);
  return `attachment; filename="${ascii || "download.bin"}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
