import { eq, or } from "drizzle-orm";
import { getChatGPTUserFromRequest } from "@/app/chatgpt-auth";
import { getDb, getOptionalDb } from "@/db";
import { seededDesigns } from "@/db/catalog";
import { designs, revisions, users } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  isMissingStorageError,
  optionalString,
  readJsonObject,
  requireApiUser,
} from "../../_lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const db = getOptionalDb();
  if (!db) return seededDetail(id);

  try {
    const [row] = await db
      .select({ design: designs, ownerDisplayName: users.displayName })
      .from(designs)
      .leftJoin(users, eq(designs.ownerId, users.id))
      .where(or(eq(designs.id, id), eq(designs.slug, id)))
      .limit(1);

    if (!row) return seededDetail(id);
    const user = getChatGPTUserFromRequest(request);
    if (
      row.design.publicationStatus !== "published" &&
      user?.userId !== row.design.ownerId
    ) {
      throw new ApiError(404, "not_found", "Design not found.");
    }

    const revisionRows = await db
      .select()
      .from(revisions)
      .where(eq(revisions.designId, row.design.id))
      .orderBy(revisions.createdAt);

    return Response.json({
      design: {
        ...row.design,
        owner: { displayName: row.ownerDisplayName ?? "Marketplace member" },
        revisions: revisionRows,
        currentRevision:
          revisionRows.find((item) => item.id === row.design.currentRevisionId) ?? null,
      },
      source: "database",
    });
  } catch (error) {
    if (isMissingStorageError(error)) return seededDetail(id);
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = requireApiUser(request);
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const db = getDb();
    const [design] = await db
      .select()
      .from(designs)
      .where(eq(designs.id, id))
      .limit(1);
    if (!design || design.ownerId !== user.userId) {
      throw new ApiError(404, "not_found", "Design not found.");
    }

    const title = optionalString(body.title, "title", 140);
    const summary = optionalString(body.summary, "summary", 400);
    const description = optionalString(body.description, "description", 20_000);
    const category = optionalString(body.category, "category", 80);
    const license = optionalString(body.license, "license", 80);
    const publicationStatus = body.publicationStatus;
    if (
      publicationStatus !== undefined &&
      !["draft", "published", "archived"].includes(String(publicationStatus))
    ) {
      throw new ApiError(400, "invalid_field", "Invalid publicationStatus.");
    }

    const now = new Date().toISOString();
    await db
      .update(designs)
      .set({
        ...(title !== undefined ? { title } : {}),
        ...(summary !== undefined ? { summary } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(license !== undefined ? { license } : {}),
        ...(publicationStatus !== undefined
          ? {
              publicationStatus: publicationStatus as "draft" | "published" | "archived",
              publishedAt:
                publicationStatus === "published" ? design.publishedAt ?? now : design.publishedAt,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(designs.id, id));

    if (publicationStatus === "published" && design.currentRevisionId) {
      await db
        .update(revisions)
        .set({ lifecycleStatus: "published", publishedAt: now })
        .where(eq(revisions.id, design.currentRevisionId));
    }

    const [updated] = await db.select().from(designs).where(eq(designs.id, id)).limit(1);
    return Response.json({ design: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

function seededDetail(id: string): Response {
  const design = seededDesigns.find((item) => item.id === id || item.slug === id);
  if (!design) {
    return Response.json(
      { error: { code: "not_found", message: "Design not found." } },
      { status: 404 },
    );
  }
  return Response.json({
    design: { ...design, revisions: [design.currentRevision] },
    source: "seed",
  });
}
