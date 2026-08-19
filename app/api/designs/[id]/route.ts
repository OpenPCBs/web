import { eq, or } from "drizzle-orm";
import { getChatGPTUserFromRequest } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { designs, revisions, users } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  optionalString,
  readJsonObject,
  requireActiveApiUser,
  requireApiUser,
} from "../../_lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const db = getDb();
    const [row] = await db
      .select({ design: designs, ownerDisplayName: users.displayName })
      .from(designs)
      .leftJoin(users, eq(designs.ownerId, users.id))
      .where(or(eq(designs.id, id), eq(designs.slug, id)))
      .limit(1);

    if (!row) throw new ApiError(404, "not_found", "Design not found.");
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
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const db = getDb();
    const user = await requireActiveApiUser(request, db);
    const { id } = await context.params;
    const body = await readJsonObject(request);
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
    const priceCents = body.priceCents;
    if (
      priceCents !== undefined &&
      (!Number.isInteger(priceCents) || Number(priceCents) < 0 || Number(priceCents) > 10_000_000)
    ) {
      throw new ApiError(
        400,
        "invalid_field",
        "priceCents must be an integer between 0 and 10000000.",
      );
    }
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
        ...(priceCents !== undefined ? { priceCents: Number(priceCents) } : {}),
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
