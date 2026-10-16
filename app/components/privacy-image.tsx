"use client";

import type { ComponentPropsWithoutRef } from "react";
import { usePrivacyChoice } from "./privacy-controls";

/** Supplier-hosted images are optional external connections, too. */
export function PrivacyImage({ src, alt, ...props }: ComponentPropsWithoutRef<"img">) {
  const { choice, ready, globalControl } = usePrivacyChoice();
  const local = typeof src === "string" && ((src.startsWith("/") && !src.startsWith("//")) || src.startsWith("blob:") || src.startsWith("data:image/"));
  if (!local && (!ready || !choice?.externalMedia || globalControl)) {
    return <span className="external-image-placeholder" role="img" aria-label={alt || "External product image blocked"}>External image · <a href="/privacy/choices">Privacy choices</a></span>;
  }
  return <img src={src} alt={alt ?? ""} {...props} referrerPolicy="no-referrer" />;
}
