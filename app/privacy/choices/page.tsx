import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/app/components/site-shell";
import { PrivacyControls } from "@/app/components/privacy-controls";

export const metadata: Metadata = { title: "Privacy choices" };
export default function PrivacyChoicesPage() {
  return <><SiteHeader active="docs" /><main id="main-content" className="shell legal-page"><h1>Privacy choices</h1><PrivacyControls full /><h2>Your personal information</h2><p>The application does not integrate advertising networks or sell personal data through an application feature. Global Privacy Control blocks optional external tools. This setting does not sign you out or prevent essential order processing.</p><p><a href="/contact?type=privacy">Request access, correction, export, deletion, or an opt-out</a>. You do not need an account to submit a request. We may need to verify identity before disclosing or changing account information.</p><p><a href="/legal/privacy">Read the privacy notice</a>.</p></main><SiteFooter /></>;
}
