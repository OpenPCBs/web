import type { Metadata } from "next";
import "./globals.css";
import { PrivacyControls } from "./components/privacy-controls";

import { site } from "@/lib/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: { default: site.name, template: `%s | ${site.name}` },
  description: "Specialized test equipment, power electronics, direct fulfillment, buildable engineering designs, Gerber inspection, and paid lab verification.",
  openGraph: {
    title: "Trace — Electronics Supply",
    description: "One dependable source for power electronics and test equipment.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Trace — Electronics Supply",
    description: "One dependable source for power electronics and test equipment.",
  },
  applicationName: site.name,
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<PrivacyControls /></body></html>;
}
