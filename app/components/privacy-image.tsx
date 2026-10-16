"use client";

import type { ComponentPropsWithoutRef } from "react";
import { usePrivacyChoice } from "./privacy-controls";
import { safeImageSource } from "@/lib/client/image-source";
import { site } from "@/lib/config/site";

/** Supplier-hosted images are optional external connections, too. */
export function PrivacyImage({ src, alt, ...props }: ComponentPropsWithoutRef<"img">) {
  const { choice, ready, globalControl } = usePrivacyChoice();
  const image = safeImageSource(src, typeof window === "undefined" ? site.origin : window.location.origin);
  if (!image) return <span className="external-image-placeholder">Image unavailable</span>;
  if (!image.local && (!ready || !choice?.externalMedia || globalControl)) {
    return <span className="external-image-placeholder" role="img" aria-label={alt || "External product image blocked"}>External image · <a href="/privacy/choices">Privacy choices</a></span>;
  }
  return <img {...props} src={image.src} alt={alt ?? ""} referrerPolicy="no-referrer" />;
}
