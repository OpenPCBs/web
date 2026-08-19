import { and, asc, eq } from "drizzle-orm";
import { getChatGPTUserFromRequest } from "@/app/chatgpt-auth";
import { getDb, getFilesBucket } from "@/db";
import { designs, files, revisions } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  persistUser,
  requireApiUser,
} from "../_lib/http";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const FILE_KINDS = new Set([
  "gerber",
  "drill",
  "bom",
  "pick_and_place",
  "schematic",
  "source",
  "firmware",
  "render",
  "archive",
  "other",
]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const revisionId = url.searchParams.get("revisionId")?.trim();
    if (!revisionId) {
      throw new ApiError(400, "invalid_field", "revisionId is required.");
    }
    const db = getDb();
    const [revision] = await db
      .select({
        revisionId: revisions.id,
        lifecycleStatus: revisions.lifecycleStatus,
        designOwnerId: designs.ownerId,
        publicationStatus: designs.publicationStatus,
      })
      .from(revisions)
      .innerJoin(designs, eq(revisions.designId, designs.id))
      .where(eq(revisions.id, revisionId))
      .limit(1);
    if (!revision) {
      throw new ApiError(404, "not_found", "Revision not found.");
    }

    const user = getChatGPTUserFromRequest(request);
    const isOwner = user?.userId === revision.designOwnerId;
    const isPublished =
      revision.publicationStatus === "published" &&
      revision.lifecycleStatus === "published";
    if (!isOwner && !isPublished) {
      throw new ApiError(404, "not_found", "Revision not found.");
    }

    const conditions = [eq(files.revisionId, revisionId)];
    if (!isOwner) conditions.push(eq(files.visibility, "public"));
    const rows = await db
      .select({
        id: files.id,
        revisionId: files.revisionId,
        originalName: files.originalName,
        mediaType: files.mediaType,
        kind: files.kind,
        byteSize: files.byteSize,
        checksumSha256: files.checksumSha256,
        visibility: files.visibility,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(and(...conditions))
      .orderBy(asc(files.createdAt));
    return Response.json({ files: rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = requireApiUser(request);
    if (!request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data")) {
      throw new ApiError(
        415,
        "unsupported_media_type",
        "Upload files as multipart/form-data.",
      );
    }
    const form = await request.formData();
    const revisionId = String(form.get("revisionId") ?? "").trim();
    const upload = form.get("file");
    const requestedKind = String(form.get("kind") ?? "other");
    const requestedVisibility = String(form.get("visibility") ?? "private");
    if (!revisionId) {
      throw new ApiError(400, "invalid_field", "revisionId is required.");
    }
    if (!(upload instanceof File) || !upload.name) {
      throw new ApiError(400, "invalid_field", "file is required.");
    }
    if (upload.size < 1 || upload.size > MAX_FILE_BYTES) {
      throw new ApiError(
        413,
        "file_too_large",
        "Each file must be between 1 byte and 50 MiB.",
      );
    }
    if (!FILE_KINDS.has(requestedKind)) {
      throw new ApiError(400, "invalid_field", "Unknown file kind.");
    }
    if (!["private", "public"].includes(requestedVisibility)) {
      throw new ApiError(400, "invalid_field", "Invalid visibility.");
    }

    const db = getDb();
    const [target] = await db
      .select({
        revisionId: revisions.id,
        designId: designs.id,
        ownerId: designs.ownerId,
        lifecycleStatus: revisions.lifecycleStatus,
        publicationStatus: designs.publicationStatus,
      })
      .from(revisions)
      .innerJoin(designs, eq(revisions.designId, designs.id))
      .where(eq(revisions.id, revisionId))
      .limit(1);
    if (!target || target.ownerId !== user.userId) {
      throw new ApiError(404, "not_found", "Revision not found.");
    }

    const canBePublic =
      target.lifecycleStatus === "published" &&
      target.publicationStatus === "published";
    if (requestedVisibility === "public" && !canBePublic) {
      throw new ApiError(
        409,
        "revision_not_published",
        "Publish this revision before making its files public.",
      );
    }

    await persistUser(db, user);
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const checksumSha256 = await sha256Hex(bytes);
    const ownerHash = (await sha256Hex(new TextEncoder().encode(user.userId))).slice(0, 24);
    const fileId = crypto.randomUUID();
    const safeName = safeFileName(upload.name);
    const r2Key = `users/${ownerHash}/designs/${target.designId}/revisions/${revisionId}/${fileId}/${safeName}`;
    const mediaType = safeMediaType(upload.type);
    const bucket = getFilesBucket();

    await bucket.put(r2Key, bytes, {
      httpMetadata: { contentType: mediaType },
      customMetadata: { fileId, revisionId, checksumSha256 },
    });
    try {
      await db.insert(files).values({
        id: fileId,
        ownerId: user.userId,
        designId: target.designId,
        revisionId,
        r2Key,
        originalName: upload.name.slice(0, 255),
        mediaType,
        kind: requestedKind as typeof files.$inferInsert.kind,
        byteSize: upload.size,
        checksumSha256,
        visibility: requestedVisibility as "private" | "public",
      });
    } catch (error) {
      await bucket.delete(r2Key);
      throw error;
    }

    return Response.json(
      {
        file: {
          id: fileId,
          revisionId,
          originalName: upload.name.slice(0, 255),
          mediaType,
          kind: requestedKind,
          byteSize: upload.size,
          checksumSha256,
          visibility: requestedVisibility,
          downloadUrl: `/api/files/${fileId}`,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

function safeFileName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-120);
  return normalized || "file.bin";
}

function safeMediaType(value: string): string {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(value)
    ? value
    : "application/octet-stream";
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
