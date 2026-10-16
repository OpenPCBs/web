/** Public identity. Keep infrastructure names and repository URLs independent. */
export const site = {
  name: "Trace",
  organization: "Trace",
  division: "Trace Works",
  origin: process.env.NEXT_PUBLIC_SITE_URL || "https://bcruse.dev",
  repository: "https://github.com/OpenPCBs/web",
  policyVersion: "2026-10-16",
} as const;
