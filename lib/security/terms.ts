import { site } from "../config/site";
import { ApiError } from "../http/api-error";

export function requireTermsAcceptance(body: Record<string, unknown>): void {
  if (body.acceptedTermsVersion !== site.policyVersion) {
    throw new ApiError(400, "terms_required", "Review and accept the current terms before checkout.");
  }
}

export function addTermsMetadata(form: URLSearchParams): void {
  form.set("metadata[terms_version]", site.policyVersion);
  form.set("metadata[terms_accepted_at]", new Date().toISOString());
}
