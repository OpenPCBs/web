import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { policies } from "@/lib/config/policies";
import { site } from "@/lib/config/site";
import { SiteHeader, SiteFooter } from "@/app/components/site-shell";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: Object.hasOwn(policies, slug) ? policies[slug].title : "Policy not found" };
}
export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  if (!Object.hasOwn(policies, slug)) notFound();
  const policy = policies[slug];
  return <><SiteHeader active="docs" /><main id="main-content" className="shell legal-page"><a href="/docs">Trust center</a><h1>{policy.title}</h1><p className="legal-version">Published {site.policyVersion} · {site.name}</p><p>{policy.intro}</p>{policy.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}<nav className="legal-actions" aria-label="Policy actions"><a href="/contact?type=privacy">Privacy request</a><a href="/privacy/choices">Privacy choices</a><a href="/contact">Contact Trace</a></nav></main><SiteFooter /></>;
}
