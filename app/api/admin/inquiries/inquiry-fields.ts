import { inquiries } from "@/db/schema";

export function serializeInquiry(row: typeof inquiries.$inferSelect) {
  return { ...row, notes: row.adminNotes };
}
