import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { designs, revisions } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  optionalString,
  readJsonObject,
  requiredString,
  requireApiUser,
} from "../../../_lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = requireApiUser(request);
    const { id: designId } = await context.params;
    const body = await readJsonObject(request);
    const version = requiredString(body.version, "version", 40);
    const changelog = optionalString(body.changelog, "changelog", 10_000) ?? "";
    const publish = body.publish === true;
    const db = getDb();
    const [design] = await db
      .select()
      .from(designs)
      .where(eq(designs.id, designId))
      .limit(1);
    if (!design || design.ownerId !== user.userId) {
      throw new ApiError(404, "not_found", "Design not found.");
    }
    const [duplicate] = await db
      .select({ id: revisions.id })
      .from(revisions)
      .where(and(eq(revisions.designId, designId), eq(revisions.version, version)))
      .limit(1);
    if (duplicate) {
      throw new ApiError(409, "version_exists", "That revision version already exists.");
    }

    const revisionId = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await db.insert(revisions).values({
        id: revisionId,
        designId,
        version,
        changelog,
        lifecycleStatus: publish ? "published" : "draft",
        publishedAt: publish ? now : null,
      });
    } catch (error) {
      if (error instanceof Error && /unique/i.test(error.message)) {
        throw new ApiError(409, "version_exists", "That revision version already exists.");
      }
      throw error;
    }

    if (publish && design.currentRevisionId) {
      await db
        .update(revisions)
        .set({ lifecycleStatus: "superseded" })
        .where(eq(revisions.id, design.currentRevisionId));
    }
    if (publish || !design.currentRevisionId) {
      await db
        .update(designs)
        .set({
          currentRevisionId: revisionId,
          ...(publish
            ? {
                publicationStatus: "published" as const,
                publishedAt: design.publishedAt ?? now,
              }
            : {}),
          updatedAt: now,
        })
        .where(eq(designs.id, designId));
    }

    const [revision] = await db
      .select()
      .from(revisions)
      .where(eq(revisions.id, revisionId))
      .limit(1);
    return Response.json({ revision }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
