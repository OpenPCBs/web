export const inquiryOptions = [
  ["support", "Order or technical support"],
  ["quote", "Product or project quote"],
  ["sourcing", "Sourcing request"],
  ["license", "Design license or custom build"],
  ["privacy", "Privacy rights or data request"],
  ["security", "Report a security issue"],
  ["copyright", "Copyright or intellectual property concern"],
  ["accessibility", "Accessibility assistance"],
] as const;
export type InquiryType = (typeof inquiryOptions)[number][0];
export const inquiryTypes = inquiryOptions.map(([type]) => type);
