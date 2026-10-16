import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/site-shell";
import { policies } from "@/lib/config/policies";

export const metadata: Metadata = {
  title: "Trust center",
  description: "Trace policies, privacy choices, engineering scope, and support.",
};

export default function DocsPage() {
  return (
    <>
      <SiteHeader active="docs" />
      <main id="main-content" tabIndex={-1} className="docs-layout shell">
        <aside>
          <span className="micro-label">TRUST CENTER</span>
          {Object.entries(policies).map(([slug, policy]) => <a href={`/legal/${slug}`} key={slug}>{policy.title}</a>)}
          <a href="/privacy/choices">Privacy choices</a>
        </aside>
        <section>
          <div className="page-title"><span className="kicker">TRACE POLICIES</span><h1>Clear scope.<br />Informed choices.</h1><p>Understand how the platform handles your information, purchases, design files, and verification evidence.</p></div>
          <article id="verification"><h2>Revision-specific verification</h2><p>Evidence applies to the stated design revision and recorded testing scope. A lab badge is not UL, CE, FCC, safety, or regulatory certification. Validate a design for its intended operating conditions before using it.</p></article>
          <article id="storage"><h2>Files and privacy</h2><p>The local Gerber workbench processes opened files in your browser. Explicitly uploading a file to a design sends it to server storage. Drafts and private files require access checks; making a file public on a published revision allows visitors to download it. The external viewer stays blocked until you allow it in Privacy choices.</p><a href="/legal/privacy">Read the privacy notice →</a></article>
          <article id="licenses"><h2>Licensing and intellectual property</h2><p>Use the license associated with the particular design release. Public availability alone does not grant unrestricted rights. Contributors are responsible for having permission to share their materials.</p><a href="/contact?type=copyright">Report an intellectual property concern →</a></article>
          <article id="safety"><h2>Engineering safety</h2><p>Power-electronics designs may involve lethal energy. Listing information, viewer results, and verification reports do not replace qualified engineering review, controlled lab procedures, or applicable standards.</p></article>
          <article id="support"><h2>Support and rights requests</h2><p>Use the contact form for orders, privacy rights, accessibility assistance, security reports, and copyright concerns. Each saved submission receives a reference and enters the private operations queue.</p><a href="/contact">Contact Trace →</a></article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
