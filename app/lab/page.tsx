import type { Metadata } from "next";
import { Activity, BadgeCheck, Boxes, FileCheck2, FlaskConical, Gauge, LockKeyhole, Microscope } from "lucide-react";
import { DivisionBanner, SiteFooter, SiteHeader } from "../components/site-shell";
import { LabCheckout } from "../components/lab-checkout";

export const metadata: Metadata = { title: "Paid Lab Verification", description: "Commission revision-bound independent engineering verification with a public evidence summary and immutable report." };

const steps = [
  ["01", "Scope", "Lock the exact schematic, board files, BOM, firmware, limits, and test method."],
  ["02", "Quote & pay", "Review sample count, procurement, fixtures, engineering time, exclusions, and SLA."],
  ["03", "Build & test", "The lab reproduces the revision and records calibrated measurements and evidence."],
  ["04", "Publish", "Receive a signed report and revision-bound Lab Verified badge with public scope."],
];

type LabSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  const result = Array.isArray(value) ? value[0] : value;
  return result?.trim().slice(0, 200) || undefined;
}

function verificationTier(value: string | string[] | undefined) {
  const tier = first(value);
  return ["release-review", "bench-reproduction", "custom-campaign"].includes(tier ?? "")
    ? tier
    : undefined;
}

export default async function LabPage({ searchParams }: { searchParams: LabSearchParams }) {
  const params = await searchParams;
  const revisionId = first(params.revisionId);
  const requestId = first(params.requestId);
  const selectedTier = verificationTier(params.tier);
  const checkoutCancelled = first(params.checkout) === "cancelled";
  return <><SiteHeader active="works" /><DivisionBanner /><main>
    <section className="page-hero shell split-hero"><div><span className="kicker">PAID · REVISION-BOUND · EVIDENCE-BACKED</span><h1>Verification that means<br />something specific.</h1><p>Thevenin Verification Lab is a charged engineering service. We reproduce a locked design revision, test it under an agreed method, and publish exactly what passed, failed, or remained outside scope.</p>{checkoutCancelled ? <p className="inline-notice" data-state="warning" role="status"><Activity size={16} /> Checkout was cancelled. Nothing was charged; your request is still available below.</p> : null}<div className="hero-actions"><a className="button" href="#pricing">View service levels <span>↓</span></a><a className="text-link" href="#deliverables">See report contents <span>↗</span></a></div></div><div className="lab-instrument"><div className="instrument-top"><span>THEVENIN LAB / CONTROLLED WORKFLOW</span><span className="live-dot">SCOPED</span></div><div className="waveform"><i /><i /><i /><i /><span>REV</span></div><div className="instrument-readings"><div><span>Manifest</span><b>Revision-bound</b></div><div><span>Evidence</span><b>Recorded</b></div><div><span>Outcome</span><b>Explicit</b></div></div></div></section>
    <section className="process-grid shell">{steps.map(([number, title, copy]) => <article key={number}><span>{number}</span><h2>{title}</h2><p>{copy}</p></article>)}</section>
    <section className="section shell" id="pricing"><div className="section-heading"><span className="kicker">SERVICE LEVELS</span><h2>Start with the evidence you need.</h2><p>Final verification is quoted against the actual design. Deposits are credited to the approved scope.</p></div><div className="pricing-grid">
      <article><FileCheck2 /><span className="micro-label">ENGINEER REVIEW</span><h3>Release review</h3><p className="price">$299 <small>deposit</small></p><p>Human review of release completeness, schematic, fabrication package, BOM, operating limits, and test plan.</p><ul><li>Revision manifest</li><li>File and BOM findings</li><li>Verification scope proposal</li><li>5 business day target</li></ul><LabCheckout tier="release-review" revisionId={revisionId} requestId={selectedTier === "release-review" ? requestId : undefined} /></article>
      <article className="featured-price"><BadgeCheck /><span className="micro-label">LAB VERIFIED</span><h3>Bench reproduction</h3><p className="price">$1,250 <small>from</small></p><p>Independent build and functional verification for one locked revision, with measurements and public summary.</p><ul><li>1–3 physical samples</li><li>Calibrated bench measurements</li><li>Scope captures and photos</li><li>Version-bound badge and report</li></ul><LabCheckout tier="bench-reproduction" revisionId={revisionId} requestId={selectedTier === "bench-reproduction" ? requestId : undefined} /></article>
      <article><Microscope /><span className="micro-label">ADVANCED TEST</span><h3>Custom campaign</h3><p className="price">Quoted</p><p>RF, high-voltage, thermal, environmental, EMI pre-compliance, endurance, or fixture-intensive work.</p><ul><li>Custom fixtures and firmware</li><li>Defined tolerances and samples</li><li>Raw data and exceptions</li><li>Independent quality review</li></ul><LabCheckout tier="custom-campaign" revisionId={revisionId} requestId={selectedTier === "custom-campaign" ? requestId : undefined} /></article>
    </div></section>
    <section className="section section-dark" id="deliverables"><div className="shell evidence-layout"><div><span className="kicker kicker-light">THE DELIVERABLE</span><h2>A report tied to bytes,<br />not a marketing claim.</h2><p>The badge is computed from a valid certificate for the exact manifest hash. Sellers cannot set it themselves, and a new revision does not inherit it.</p></div><div className="evidence-grid">{[[LockKeyhole,"SHA-256 manifest","Every source, Gerber, BOM, binary, and test-plan version."],[Boxes,"Physical traceability","Board lot, sample IDs, populated BOM, and substitutions."],[Gauge,"Measured conditions","Equipment, serials, calibration state, tolerances, and environment."],[Activity,"Raw evidence","CSV/JSON measurements, original captures, photos, failures, and notes."],[FlaskConical,"Clear scope","What was reproduced and tested—and what the badge does not certify."],[BadgeCheck,"Public history","Issue date, current state, superseding certificate, or revocation."]].map(([Icon,title,copy]) => { const C = Icon as typeof Activity; return <article key={String(title)}><C size={20} /><h3>{String(title)}</h3><p>{String(copy)}</p></article>; })}</div></div></section>
  </main><SiteFooter /></>;
}
