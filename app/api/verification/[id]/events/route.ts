import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  designs,
  quotes,
  verificationEvents,
  verificationRequests,
} from "@/db/schema";
import { ApiError, handleApiError, requireApiUser } from "../../../_lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = requireApiUser(request);
    const { id } = await context.params;
    const db = getDb();
    const [row] = await db
      .select({
        verificationRequest: verificationRequests,
        designOwnerId: designs.ownerId,
      })
      .from(verificationRequests)
      .innerJoin(designs, eq(verificationRequests.designId, designs.id))
      .where(eq(verificationRequests.id, id))
      .limit(1);
    if (
      !row ||
      (row.verificationRequest.userId !== user.userId &&
        row.designOwnerId !== user.userId)
    ) {
      throw new ApiError(404, "not_found", "Verification request not found.");
    }
    const events = await db
      .select()
      .from(verificationEvents)
      .where(eq(verificationEvents.verificationRequestId, id))
      .orderBy(asc(verificationEvents.createdAt));
    const quoteRows = await db
      .select()
      .from(quotes)
      .where(eq(quotes.verificationRequestId, id))
      .orderBy(asc(quotes.createdAt));
    return Response.json({
      request: row.verificationRequest,
      quotes: quoteRows,
      events,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
