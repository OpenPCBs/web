import type { Metadata } from "next";
import { ClipboardCheck, Headphones, PackageSearch } from "lucide-react";
import { ContactForm } from "../components/contact-form";
import { SiteFooter, SiteHeader } from "../components/site-shell";
import "./contact.css";

export const metadata: Metadata = {
  title: "Contact, Quotes & Sourcing",
  description: "Request product sourcing, project pricing, order support, or engineering assistance from Thevenin.",
};

type ContactSearchParams = Promise<Record<string, string | string[] | undefined>>;
type InquiryType = "support" | "quote" | "sourcing" | "license";

function first(value: string | string[] | undefined, maxLength = 180): string | undefined {
  const result = Array.isArray(value) ? value[0] : value;
  return result?.trim().slice(0, maxLength) || undefined;
}

export default async function ContactPage({ searchParams }: { searchParams: ContactSearchParams }) {
  const params = await searchParams;
  const requestedType = first(params.type, 20);
  const initialType: InquiryType = ["support", "quote", "sourcing", "license"].includes(requestedType ?? "")
    ? requestedType as InquiryType
    : "support";
  const context = first(params.context) ?? first(params.product) ?? first(params.design);

  return (
    <>
      <SiteHeader />
      <main className="contact-page">
        <section className="contact-hero shell">
          <div>
            <span className="store-kicker">CUSTOMER &amp; APPLICATION SUPPORT</span>
            <h1>Put the exact request in front of the right person.</h1>
            <p>Quotes, sourcing, order issues, design licensing, and technical questions enter one tracked operations queue. Include enough detail for a useful first response.</p>
          </div>
          <dl>
            <div><dt>Quote requests</dt><dd>Part number, quantity, target date</dd></div>
            <div><dt>Technical support</dt><dd>Application, operating range, symptoms</dd></div>
            <div><dt>Order support</dt><dd>Order reference and delivery issue</dd></div>
          </dl>
        </section>
        <section className="contact-body shell">
          <div className="contact-aside">
            <article><PackageSearch size={21} /><h2>Sourcing</h2><p>Send the manufacturer part number or performance envelope. Approved alternates stay visible.</p></article>
            <article><ClipboardCheck size={21} /><h2>Project quotes</h2><p>Request consolidated equipment, component, PCB, assembly, or verification pricing.</p></article>
            <article><Headphones size={21} /><h2>Support</h2><p>Every saved request gets a reference and remains manageable from the private admin queue.</p></article>
          </div>
          <ContactForm initialType={initialType} context={context} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
