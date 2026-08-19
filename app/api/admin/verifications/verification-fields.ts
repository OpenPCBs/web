import { designs, revisions, users, verificationRequests } from "@/db/schema";

export function verificationSelection() {
  return {
    request: verificationRequests,
    user: {
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      fullName: users.fullName,
    },
    design: {
      id: designs.id,
      title: designs.title,
      slug: designs.slug,
    },
    revision: {
      id: revisions.id,
      version: revisions.version,
      verificationStatus: revisions.verificationStatus,
      verificationBadgeExpiresAt: revisions.verificationBadgeExpiresAt,
      verifiedAt: revisions.verifiedAt,
    },
  };
}

export function serializeVerification<T extends {
  request: typeof verificationRequests.$inferSelect;
  user: unknown;
  design: unknown;
  revision: typeof revisions.$inferSelect | {
    verificationBadgeExpiresAt: string | null;
  } | null;
}>(row: T) {
  return {
    ...row.request,
    badgeExpiresAt: row.revision?.verificationBadgeExpiresAt ?? null,
    user: row.user,
    design: row.design,
    revision: row.revision,
  };
}
