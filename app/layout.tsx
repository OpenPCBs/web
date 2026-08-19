import type { Metadata } from "next";
import "./globals.css";

const publicOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://thevenin-electronics-supply.bradycruse23.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin),
  title: { default: "Thevenin — Electronics Supply", template: "%s | Thevenin" },
  description: "Specialized test equipment, power electronics, direct fulfillment, buildable engineering designs, Gerber inspection, and paid lab verification.",
  openGraph: {
    title: "Thevenin — Electronics Supply",
    description: "One dependable source for power electronics and test equipment.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Thevenin Electronics Supply" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thevenin — Electronics Supply",
    description: "One dependable source for power electronics and test equipment.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
