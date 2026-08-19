export type PublicationStatus = "draft" | "published" | "archived";
export type RevisionLifecycle = "draft" | "published" | "superseded";
export type VerificationStatus =
  | "unverified"
  | "quoted"
  | "payment_pending"
  | "paid"
  | "in_review"
  | "verified"
  | "failed"
  | "cancelled";

export type DesignRevision = {
  id: string;
  designId: string;
  version: string;
  changelog: string;
  lifecycleStatus: RevisionLifecycle;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  verificationBadgeExpiresAt: string | null;
  createdAt: string;
  publishedAt: string | null;
};

export type DesignRecord = {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  license: string;
  priceCents: number;
  coverImageUrl: string | null;
  publicationStatus: PublicationStatus;
  currentRevisionId: string | null;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  owner: { displayName: string } | null;
  currentRevision: DesignRevision | null;
  revisions?: DesignRevision[];
};

export type DesignFile = {
  id: string;
  revisionId: string;
  originalName: string;
  mediaType: string;
  kind: string;
  byteSize: number;
  checksumSha256: string;
  visibility: "private" | "public";
  createdAt: string;
};

const PUBLICATION_STATUSES = ["draft", "published", "archived"] as const;
const REVISION_LIFECYCLES = ["draft", "published", "superseded"] as const;
const VERIFICATION_STATUSES = [
  "unverified",
  "quoted",
  "payment_pending",
  "paid",
  "in_review",
  "verified",
  "failed",
  "cancelled",
] as const;

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === "string" ? value : undefined;
}

function enumValue<T extends string>(value: unknown, options: readonly T[]): T | null {
  return typeof value === "string" && options.includes(value as T) ? value as T : null;
}

export function parseRevision(value: unknown): DesignRevision | null {
  const row = object(value);
  if (!row) return null;
  const lifecycleStatus = enumValue(row.lifecycleStatus, REVISION_LIFECYCLES);
  const verificationStatus = enumValue(row.verificationStatus, VERIFICATION_STATUSES);
  const verifiedAt = nullableString(row.verifiedAt);
  const expiresAt = nullableString(row.verificationBadgeExpiresAt);
  const publishedAt = nullableString(row.publishedAt);
  if (
    typeof row.id !== "string" ||
    typeof row.designId !== "string" ||
    typeof row.version !== "string" ||
    typeof row.changelog !== "string" ||
    !lifecycleStatus ||
    !verificationStatus ||
    verifiedAt === undefined ||
    expiresAt === undefined ||
    typeof row.createdAt !== "string" ||
    publishedAt === undefined
  ) return null;
  return {
    id: row.id,
    designId: row.designId,
    version: row.version,
    changelog: row.changelog,
    lifecycleStatus,
    verificationStatus,
    verifiedAt,
    verificationBadgeExpiresAt: expiresAt,
    createdAt: row.createdAt,
    publishedAt,
  };
}

export function parseDesign(value: unknown): DesignRecord | null {
  const row = object(value);
  if (!row) return null;
  const publicationStatus = enumValue(row.publicationStatus, PUBLICATION_STATUSES);
  const coverImageUrl = nullableString(row.coverImageUrl);
  const currentRevisionId = nullableString(row.currentRevisionId);
  const publishedAt = nullableString(row.publishedAt);
  if (
    typeof row.id !== "string" ||
    typeof row.ownerId !== "string" ||
    typeof row.slug !== "string" ||
    typeof row.title !== "string" ||
    typeof row.summary !== "string" ||
    typeof row.description !== "string" ||
    typeof row.category !== "string" ||
    typeof row.license !== "string" ||
    typeof row.priceCents !== "number" ||
    !Number.isFinite(row.priceCents) ||
    coverImageUrl === undefined ||
    !publicationStatus ||
    currentRevisionId === undefined ||
    typeof row.featured !== "boolean" ||
    typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string" ||
    publishedAt === undefined
  ) return null;

  const ownerRow = object(row.owner);
  const owner = ownerRow &&
    typeof ownerRow.displayName === "string" &&
    ownerRow.displayName !== "Marketplace member"
    ? { displayName: ownerRow.displayName }
    : null;
  const currentRevision = row.currentRevision === null
    ? null
    : parseRevision(row.currentRevision);
  if (row.currentRevision !== null && row.currentRevision !== undefined && !currentRevision) {
    return null;
  }
  const revisions = Array.isArray(row.revisions)
    ? row.revisions.map(parseRevision).filter((item): item is DesignRevision => Boolean(item))
    : undefined;

  return {
    id: row.id,
    ownerId: row.ownerId,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category,
    license: row.license,
    priceCents: row.priceCents,
    coverImageUrl,
    publicationStatus,
    currentRevisionId,
    featured: row.featured,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt,
    owner,
    currentRevision: currentRevision ?? null,
    ...(revisions ? { revisions } : {}),
  };
}

export function designsFromPayload(payload: unknown): DesignRecord[] {
  const root = object(payload);
  if (!root || root.source === "seed" || !Array.isArray(root.designs)) return [];
  return root.designs
    .map(parseDesign)
    .filter((item): item is DesignRecord => Boolean(item))
    .filter((design) => design.publicationStatus === "published");
}

export function ownedDesignsFromPayload(payload: unknown): DesignRecord[] {
  const root = object(payload);
  if (!root || root.source === "seed" || !Array.isArray(root.designs)) return [];
  return root.designs
    .map(parseDesign)
    .filter((item): item is DesignRecord => Boolean(item));
}

export function designFromPayload(payload: unknown): DesignRecord | null {
  const root = object(payload);
  if (!root || root.source === "seed") return null;
  return parseDesign(root.design);
}

export function filesFromPayload(payload: unknown): DesignFile[] {
  const root = object(payload);
  if (!root || !Array.isArray(root.files)) return [];
  return root.files.flatMap((value): DesignFile[] => {
    const row = object(value);
    if (!row) return [];
    if (
      typeof row.id !== "string" ||
      typeof row.revisionId !== "string" ||
      typeof row.originalName !== "string" ||
      typeof row.mediaType !== "string" ||
      typeof row.kind !== "string" ||
      typeof row.byteSize !== "number" ||
      !Number.isFinite(row.byteSize) ||
      typeof row.checksumSha256 !== "string" ||
      (row.visibility !== "private" && row.visibility !== "public") ||
      typeof row.createdAt !== "string"
    ) return [];
    return [{
      id: row.id,
      revisionId: row.revisionId,
      originalName: row.originalName,
      mediaType: row.mediaType,
      kind: row.kind,
      byteSize: row.byteSize,
      checksumSha256: row.checksumSha256,
      visibility: row.visibility,
      createdAt: row.createdAt,
    }];
  });
}

export function apiMessage(payload: unknown, fallback: string): string {
  const root = object(payload);
  const error = object(root?.error);
  return typeof error?.message === "string" && error.message.trim()
    ? error.message
    : fallback;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function labelStatus(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}
