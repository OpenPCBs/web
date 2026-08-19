import type { Metadata } from "next";
import "./globals.css";

const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: publicOrigin ? new URL(publicOrigin) : undefined,
  title: { default: "Thevenin — Electronics Supply", template: "%s | Thevenin" },
  description: "Specialized test equipment, power electronics, direct fulfillment, buildable engineering designs, Gerber inspection, and paid lab verification.",
  openGraph: {
    title: "Thevenin — Electronics Supply",
    description: "One dependable source for power electronics and test equipment.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
