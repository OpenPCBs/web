import { and, desc, eq, like, or } from "drizzle-orm";
import { getDb, getOptionalDb } from "@/db";
import { seededDesigns } from "@/db/catalog";
import { designs, revisions, users } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  isMissingStorageError,
  optionalString,
  persistUser,
  readJsonObject,
  requiredString,
  requireApiUser,
  slugify,
} from "../_lib/http";

function fallbackDesigns(url: URL) {
  const query = url.searchParams.get("q")?.trim().toLowerCase();
  const category = url.searchParams.get("category")?.trim().toLowerCase();
  return seededDesigns.filter((design) => {
    const matchesQuery =
      !query ||
      design.title.toLowerCase().includes(query) ||
      design.summary.toLowerCase().includes(query);
    const matchesCategory = !category || design.category.toLowerCase() === category;
    return matchesQuery && matchesCategory;
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = getOptionalDb();
  if (!db) {
    return Response.json({ designs: fallbackDesigns(url), source: "seed" });
  }

  try {
    const query = url.searchParams.get("q")?.trim().slice(0, 100);
    const category = url.searchParams.get("category")?.trim().slice(0, 80);
    const conditions = [eq(designs.publicationStatus, "published")];
    if (query) {
      conditions.push(
        or(
          like(designs.title, `%${query}%`),
          like(designs.summary, `%${query}%`),
        )!,
      );
    }
    if (category) conditions.push(eq(designs.category, category));

    const rows = await db
      .select({
        design: designs,
        currentRevision: revisions,
        ownerDisplayName: users.displayName,
      })
      .from(designs)
      .leftJoin(revisions, eq(designs.currentRevisionId, revisions.id))
      .leftJoin(users, eq(designs.ownerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(designs.featured), desc(designs.updatedAt))
      .limit(100);

    if (rows.length === 0) {
      return Response.json({ designs: fallbackDesigns(url), source: "seed" });
    }

    return Response.json({
      designs: rows.map(({ design, currentRevision, ownerDisplayName }) => ({
        ...design,
        owner: { displayName: ownerDisplayName ?? "Marketplace member" },
        currentRevision,
      })),
      source: "database",
    });
  } catch (error) {
    if (isMissingStorageError(error)) {
      return Response.json({ designs: fallbackDesigns(url), source: "seed" });
    }
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = requireApiUser(request);
    const body = await readJsonObject(request);
    const title = requiredString(body.title, "title", 140);
    const summary = optionalString(body.summary, "summary", 400) ?? "";
    const description = optionalString(body.description, "description", 20_000) ?? "";
    const category = optionalString(body.category, "category", 80) ?? "Other";
    const license = optionalString(body.license, "license", 80) ?? "CERN-OHL-P-2.0";
    const priceCents = body.priceCents ?? 0;
    if (
      !Number.isInteger(priceCents) ||
      Number(priceCents) < 0 ||
      Number(priceCents) > 10_000_000
    ) {
      throw new ApiError(
        400,
        "invalid_field",
        "priceCents must be an integer between 0 and 10000000.",
      );
    }
    const version = optionalString(body.version, "version", 40) ?? "1.0.0";
    const requestedSlug = optionalString(body.slug, "slug", 100);
    const baseSlug = slugify(requestedSlug ?? title);
    const db = getDb();
    await persistUser(db, user);

    const existing = await db
      .select({ id: designs.id })
      .from(designs)
      .where(eq(designs.slug, baseSlug))
      .limit(1);
    const slug = existing.length
      ? `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
      : baseSlug;
    const designId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(designs).values({
      id: designId,
      ownerId: user.userId,
      slug,
      title,
      summary,
      description,
      category,
      license,
      priceCents: Number(priceCents),
      currentRevisionId: revisionId,
      updatedAt: now,
    });
    try {
      await db.insert(revisions).values({
        id: revisionId,
        designId,
        version,
      });
    } catch (error) {
      await db.delete(designs).where(eq(designs.id, designId));
      throw error;
    }

    return Response.json(
      {
        design: {
          id: designId,
          ownerId: user.userId,
          slug,
          title,
          summary,
          description,
          category,
          license,
          priceCents: Number(priceCents),
          publicationStatus: "draft",
          currentRevisionId: revisionId,
        },
        revision: {
          id: revisionId,
          designId,
          version,
          lifecycleStatus: "draft",
          verificationStatus: "unverified",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
