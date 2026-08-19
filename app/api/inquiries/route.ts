import { eq } from "drizzle-orm";
import { getChatGPTUserFromRequest } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { designs, inquiries, products, revisions } from "@/db/schema";
import {
  ApiError,
  handleApiError,
  optionalString,
  persistUser,
  readJsonObject,
  requiredString,
} from "../_lib/http";

const inquiryTypes = ["support", "quote", "sourcing", "license"] as const;

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (typeof body.website === "string" && body.website.trim()) {
      return Response.json({ accepted: true }, { status: 202 });
    }
    if (
      typeof body.type !== "string" ||
      !inquiryTypes.includes(body.type as (typeof inquiryTypes)[number])
    ) {
      throw new ApiError(400, "invalid_field", "type is invalid.");
    }
    const type = body.type as (typeof inquiryTypes)[number];
    const name = requiredString(body.name, "name", 120);
    const email = validEmail(requiredString(body.email, "email", 254));
    const company = optionalString(body.company, "company", 160);
    const phone = optionalString(body.phone, "phone", 80);
    const subject = optionalString(body.subject, "subject", 180);
    const message = requiredString(body.message, "message", 6_000);
    if (message.length < 20) {
      throw new ApiError(400, "invalid_field", "message must be at least 20 characters.");
    }
    const inquiryContext = optionalString(body.context, "context", 2_000);
    const productId = optionalString(body.productId, "productId", 100);
    const designId = optionalString(body.designId, "designId", 100);
    const revisionId = optionalString(body.revisionId, "revisionId", 100);
    const db = getDb();
    const user = getChatGPTUserFromRequest(request);
    if (user) await persistUser(db, user);

    if (productId) await requireReference(db, products, productId, "productId");
    if (designId) await requireReference(db, designs, designId, "designId");
    if (revisionId) {
      const [revision] = await db
        .select({ id: revisions.id, designId: revisions.designId })
        .from(revisions)
        .where(eq(revisions.id, revisionId))
        .limit(1);
      if (!revision || (designId && revision.designId !== designId)) {
        throw new ApiError(400, "invalid_reference", "revisionId is invalid.");
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(inquiries).values({
      id,
      type,
      userId: user?.userId ?? null,
      name,
      email,
      company: company ?? null,
      phone: phone ?? null,
      subject: subject ?? null,
      message,
      context: inquiryContext ?? null,
      productId: productId ?? null,
      designId: designId ?? null,
      revisionId: revisionId ?? null,
      updatedAt: now,
    });
    return Response.json(
      { accepted: true, id, reference: id.slice(0, 12) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

function validEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ApiError(400, "invalid_field", "email must be a valid email address.");
  }
  return normalized;
}

async function requireReference(
  db: ReturnType<typeof getDb>,
  table: typeof products | typeof designs,
  id: string,
  field: string,
) {
  const idColumn = table === products ? products.id : designs.id;
  const row = await db.select({ id: idColumn }).from(table).where(eq(idColumn, id)).limit(1);
  if (!row.length) {
    throw new ApiError(400, "invalid_reference", `${field} is invalid.`);
  }
}
