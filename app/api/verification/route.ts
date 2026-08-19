import { desc, eq, inArray } from "drizzle-orm";
import { getChatGPTUserFromRequest } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import {
  designs,
  quotes,
  revisions,
  verificationRequests,
} from "@/db/schema";
import {
  handleApiError,
  optionalString,
  persistUser,
  readJsonObject,
  requiredString,
  requireApiUser,
} from "../_lib/http";
import {
  createVerificationRequest,
  normalizeVerificationTier,
  verificationPricing,
} from "../_lib/verification";

export async function GET(request: Request) {
  const user = getChatGPTUserFromRequest(request);
  if (!user) {
    return Response.json({
      pricing: verificationPricing(),
      authenticationRequired: true,
    });
  }
  try {
    const db = getDb();
    const rows = await db
      .select({
        request: verificationRequests,
        revisionVersion: revisions.version,
        revisionVerificationStatus: revisions.verificationStatus,
        designTitle: designs.title,
        designSlug: designs.slug,
      })
      .from(verificationRequests)
      .innerJoin(revisions, eq(verificationRequests.revisionId, revisions.id))
      .innerJoin(designs, eq(verificationRequests.designId, designs.id))
      .where(eq(verificationRequests.userId, user.userId))
      .orderBy(desc(verificationRequests.createdAt))
      .limit(50);
    const requestIds = rows.map((row) => row.request.id);
    const quoteRows = requestIds.length
      ? await db
          .select()
          .from(quotes)
          .where(inArray(quotes.verificationRequestId, requestIds))
      : [];
    return Response.json({
      pricing: verificationPricing(),
      requests: rows.map((row) => ({
        ...row.request,
        design: { title: row.designTitle, slug: row.designSlug },
        revision: {
          id: row.request.revisionId,
          version: row.revisionVersion,
          verificationStatus: row.revisionVerificationStatus,
        },
        quotes: quoteRows.filter(
          (quote) => quote.verificationRequestId === row.request.id,
        ),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = requireApiUser(request);
    const body = await readJsonObject(request);
    const revisionId = requiredString(body.revisionId, "revisionId", 100);
    const tier = normalizeVerificationTier(body.tier ?? body.serviceLevel);
    const notes = optionalString(body.notes, "notes", 5_000);
    const db = getDb();
    await persistUser(db, user);
    const result = await createVerificationRequest(db, user, {
      revisionId,
      tier,
      notes,
    });
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
