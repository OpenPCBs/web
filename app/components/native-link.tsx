import type { ComponentPropsWithoutRef } from "react";

type NativeLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

/**
 * Uses the browser's built-in document navigation. Vinext's current client-side
 * Link shim can intercept ordinary clicks without completing the route change
 * in production, while modifier clicks still work.
 */
export default function NativeLink({ href, ...props }: NativeLinkProps) {
  return <a href={href} {...props} />;
}
