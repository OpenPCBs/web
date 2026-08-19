import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DivisionBanner, SiteFooter, SiteHeader } from "@/app/components/site-shell";
import {
  designs,
  formatMoney,
  getBomSubtotal,
  getDesignBySlug,
  getProductsForDesign,
  type MarketplaceDesign,
  type VerificationLevel,
} from "@/app/lib/data";

type RouteParams = Promise<{ slug: string }>;
type SearchValue = string | string[] | undefined;
type DesignSearchParams = Promise<Record<string, SearchValue>>;

function first(value: SearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function verificationClass(level: VerificationLevel): string {
  return level.toLowerCase().replaceAll(" ", "-");
}

function metadataForDesign(design: MarketplaceDesign): Metadata {
  const title = `${design.title} | Thevenin Works`;
  const description = `${design.summary} Revision ${design.revision}; ${design.verification.level.toLowerCase()} with design files, BOM, and build options.`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: design.publishedOn,
      modifiedTime: design.updatedOn,
      images: [],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [],
    },
  };
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  const design = getDesignBySlug(slug);

  if (!design) {
    return {
      title: { absolute: "Design not found | Thevenin Works" },
      description: "This design record is not available.",
      openGraph: { title: "Design not found | Thevenin Works", description: "This design record is not available.", images: [] },
      twitter: { card: "summary", title: "Design not found | Thevenin Works", description: "This design record is not available.", images: [] },
    };
  }

  return metadataForDesign(design);
}

export function generateStaticParams(): { slug: string }[] {
  return designs.map((design) => ({ slug: design.slug }));
}

export default async function DesignDetailPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: DesignSearchParams;
}) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const design = getDesignBySlug(slug);
  if (!design) notFound();

  const chosenTier = design.tiers.find((tier) => tier.id === first(queryParams.tier))
    ?? design.tiers.find((tier) => tier.recommended)
    ?? design.tiers[0];
  const requestStarted = first(queryParams.request) === "1";
  const linkedProducts = getProductsForDesign(design);
  const bomSubtotal = getBomSubtotal(design);
  const updatedDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${design.updatedOn}T00:00:00Z`));

  return (
    <>
      <SiteHeader active="marketplace" />
      <DivisionBanner />
      <main className="design-detail-page">

      <nav className="breadcrumbs shell" aria-label="Breadcrumb">
        <ol><li><a href="/">Home</a></li><li><a href="/marketplace">Design Works</a></li><li aria-current="page">Design #{design.id}</li></ol>
      </nav>

      <section className="design-detail-hero shell" aria-labelledby="design-title">
        <div className="design-detail-heading">
          <div className="card-meta-row">
            <span>{design.category}</span>
            <span>DESIGN #{design.id}</span>
            <span className={`verification-badge verification-badge--${verificationClass(design.verification.level)}`}><i aria-hidden="true">✓</i>{design.verification.level}</span>
          </div>
          <h1 id="design-title">{design.title}</h1>
          <p>{design.summary}</p>
          <div className="design-byline">
            <span className="author-avatar" aria-hidden="true">{design.authorInitials}</span>
            <div><span>Designed by</span><strong>{design.author}</strong><small>{design.authorRole}</small></div>
            <div className="revision-lockup"><span>Current release</span><strong>Rev {design.revision}</strong><small>Updated <time dateTime={design.updatedOn}>{updatedDate}</time></small></div>
          </div>
        </div>

        <div className={`design-detail-visual design-detail-visual--${design.visual}`} role="img" aria-label={`Rendered board preview for ${design.shortTitle}`}>
          <div className="detail-viewer-toolbar"><span>{design.shortTitle.toUpperCase()}</span><span>TOP ASSEMBLY · REV {design.revision}</span></div>
          <div className="detail-board" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}
            <b className="detail-chip detail-chip--a" /><b className="detail-chip detail-chip--b" /><b className="detail-chip detail-chip--c" />
            <b className="detail-trace detail-trace--a" /><b className="detail-trace detail-trace--b" /><b className="detail-trace detail-trace--c" />
          </div>
          <div className="detail-viewer-readout"><span><b>{design.dimensions}</b> board</span><span><b>{design.layers}</b> layers</span><span><b>{design.drillCount}</b> drills</span><a href={`/viewer?design=${design.slug}`}>Inspect Gerbers <b aria-hidden="true">↗</b></a></div>
        </div>

        <dl className="design-key-metrics" aria-label="Key design specifications">
          <div><dt>Rated power</dt><dd>{design.power}</dd></div>
          <div><dt>Input range</dt><dd>{design.input}</dd></div>
          <div><dt>Output</dt><dd>{design.output}</dd></div>
          <div><dt>Measured efficiency</dt><dd>{design.efficiency}</dd></div>
          <div><dt>Switching</dt><dd>{design.switchingFrequency}</dd></div>
        </dl>
      </section>

      <nav className="detail-section-nav" aria-label="Design page sections">
        <div className="shell">
          <a href="#overview">Overview</a>
          <a href="#files">Files</a>
          <a href="#bom">BOM</a>
          <a href="#test-data">Test data</a>
          <a href="#revisions">Revisions</a>
          <a href="#discussion">Discussion <span>{design.discussionCount}</span></a>
        </div>
      </nav>

      <div className="design-detail-layout shell">
        <div className="design-detail-main">
          <section className="detail-section" id="overview" aria-labelledby="overview-title">
            <div className="detail-section-heading"><p className="overline">DESIGN INTENT</p><h2 id="overview-title">Overview</h2></div>
            <div className="prose-copy">{design.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            <div className="overview-columns">
              <div><h3>Engineering highlights</h3><ul className="check-list">{design.highlights.map((highlight) => <li key={highlight}><span aria-hidden="true">✓</span>{highlight}</li>)}</ul></div>
              <div><h3>Intended applications</h3><ul className="plain-list">{design.applications.map((application) => <li key={application}>{application}</li>)}</ul></div>
            </div>
            <aside className="safety-note"><strong><span aria-hidden="true">!</span> High-voltage design</strong><p>{design.safetyNote}</p></aside>
          </section>

          <section className="detail-section" id="files" aria-labelledby="files-title">
            <div className="detail-section-heading detail-section-heading--split"><div><p className="overline">RELEASE PACKAGE</p><h2 id="files-title">Files included</h2></div><span>{design.fileSize} · Rev {design.revision}</span></div>
            <ul className="file-deliverables">
              {design.includedFiles.map((file, index) => <li key={file}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><strong>{file}</strong><small>Included in design-file license</small></li>)}
            </ul>
          </section>

          <section className="detail-section" id="bom" aria-labelledby="bom-title">
            <div className="detail-section-heading detail-section-heading--split"><div><p className="overline">REVISION-MATCHED PROCUREMENT</p><h2 id="bom-title">Bill of materials</h2></div><a className="text-link" href={`/store?kit=${design.slug}#build-kit`}>Source complete BOM <span aria-hidden="true">↗</span></a></div>
            <div className="bom-table-wrap">
              <table className="bom-table">
                <caption>Major bill-of-material lines for revision {design.revision}</caption>
                <thead><tr><th scope="col">Ref.</th><th scope="col">Part</th><th scope="col">Qty.</th><th scope="col">Sourcing</th><th scope="col">Ext. price</th></tr></thead>
                <tbody>
                  {design.bom.map((line) => (
                    <tr key={line.line}>
                      <td><span>{line.reference}</span></td>
                      <td><strong>{line.manufacturer} {line.mpn}</strong><small>{line.description}</small>{line.productSlug ? <a href={`/store?product=${line.productSlug}#product-detail`}>View sourced product <span aria-hidden="true">↗</span></a> : null}</td>
                      <td>{line.quantity}</td>
                      <td><span className="stock-note"><i aria-hidden="true" />{line.sourcing}</span></td>
                      <td>{formatMoney(line.quantity * line.unitPriceCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th scope="row" colSpan={4}>Shown-line subtotal</th><td>{formatMoney(bomSubtotal)}</td></tr></tfoot>
              </table>
            </div>
            <p className="table-note">Availability and pricing are checked again before a Thevenin Supply kit is released. Passive alternates are never substituted silently.</p>

            <div className="related-products" aria-labelledby="related-products-title">
              <div className="detail-section-heading detail-section-heading--split"><div><p className="overline">THEVENIN SUPPLY</p><h3 id="related-products-title">Products used in this design</h3></div><a href="/store">Browse all hardware <span aria-hidden="true">→</span></a></div>
              <ul>
                {linkedProducts.map((product) => <li key={product.slug}><a href={`/store?product=${product.slug}#product-detail`}><span><small>{product.maker}</small><strong>{product.name}</strong></span><span><small>{product.availability}</small><b>{formatMoney(product.priceCents)}</b></span><i aria-hidden="true">↗</i></a></li>)}
              </ul>
            </div>
          </section>

          <section className="detail-section" id="test-data" aria-labelledby="test-data-title">
            <div className="detail-section-heading"><p className="overline">EVIDENCE, NOT A FLOATING BADGE</p><h2 id="test-data-title">{design.verification.level} record</h2></div>
            <div className={`verification-record verification-record--${verificationClass(design.verification.level)}`}>
              <header>
                <span className="verification-seal" aria-hidden="true">✓</span>
                <div><p>VERIFICATION STATUS</p><h3>{design.verification.level}</h3><span>Bound to revision {design.verification.revision}</span></div>
                {design.verification.badgeId ? <code>{design.verification.badgeId}</code> : null}
              </header>
              <p>{design.verification.summary}</p>
              {design.verification.lab ? <dl className="verification-meta"><div><dt>Laboratory</dt><dd>{design.verification.lab}</dd></div><div><dt>Report</dt><dd>{design.verification.report}</dd></div><div><dt>Verified</dt><dd><time dateTime={design.verification.verifiedOn}>{design.verification.verifiedOn}</time></dd></div></dl> : null}
              <div className="test-result-grid">
                {design.verification.results.map((result) => <div key={result.label}><span>{result.label}</span><strong>{result.value}</strong><small>{result.note}</small></div>)}
              </div>
              <footer>
                {design.verification.report ? <a className="text-link" href={`/lab?report=${design.verification.report}#report`}>View signed test report <span aria-hidden="true">↗</span></a> : <span>Independent lab report not yet commissioned.</span>}
                <a className="button button-small" href={`/lab?design=${design.slug}`}>{design.verification.level === "Lab Verified" ? "Verify a new revision" : "Commission lab verification"} · from $3,500 <span>→</span></a>
              </footer>
            </div>
          </section>

          <section className="detail-section" id="revisions" aria-labelledby="revisions-title">
            <div className="detail-section-heading"><p className="overline">CHANGE HISTORY</p><h2 id="revisions-title">Revisions</h2></div>
            <ol className="revision-list">
              {design.revisions.map((revision) => (
                <li key={revision.version} className={revision.status === "Current" ? "is-current" : undefined}>
                  <div className="revision-marker" aria-hidden="true" />
                  <div className="revision-heading"><div><strong>Revision {revision.version}</strong><span>{revision.status}</span></div><time dateTime={revision.date}>{revision.date}</time></div>
                  <p className={`verification-badge verification-badge--${verificationClass(revision.verification)}`}><i aria-hidden="true">✓</i>{revision.verification}</p>
                  <ul>{revision.notes.map((note) => <li key={note}>{note}</li>)}</ul>
                </li>
              ))}
            </ol>
          </section>

          <section className="detail-section discussion-preview" id="discussion" aria-labelledby="discussion-title">
            <div><p className="overline">DESIGN DISCUSSION</p><h2 id="discussion-title">{design.discussionCount} engineering notes and questions</h2><p>Keep bring-up findings, substitutions, and author answers attached to the release they concern.</p></div>
            <a className="button" href={`/marketplace?discussion=${design.slug}`}>Open discussion <span>→</span></a>
          </section>
        </div>

        <aside className="purchase-panel" id="license-options" aria-labelledby="purchase-title">
          <div className="purchase-panel-inner">
            <p className="overline">BUILD REVISION {design.revision}</p>
            <h2 id="purchase-title">Choose your starting point.</h2>
            <div className="purchase-tier-list">
              {design.tiers.map((tier) => {
                const isChosen = tier.id === chosenTier.id;
                return (
                  <a key={tier.id} className={`purchase-tier${isChosen ? " is-selected" : ""}`} href={`/designs/${design.slug}?tier=${tier.id}#license-options`} aria-current={isChosen ? "true" : undefined}>
                    <span className="purchase-tier-radio" aria-hidden="true" />
                    <span><strong>{tier.name}</strong><small>{tier.summary}</small></span>
                    <b>{formatMoney(tier.priceCents)}</b>
                    {tier.recommended ? <em>Recommended</em> : null}
                  </a>
                );
              })}
            </div>
            <div className="selected-tier-summary">
              <p>{chosenTier.name} includes:</p>
              <ul className="check-list">{chosenTier.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
            </div>
            {requestStarted ? <div className="request-notice" role="status"><strong>Configuration selected.</strong><span>Thevenin will reconfirm license scope, stock, tax, and shipping before payment.</span></div> : null}
            <a className="button purchase-button" href={`/designs/${design.slug}?tier=${chosenTier.id}&request=1#license-options`}>{chosenTier.actionLabel} <span>→</span></a>
            <p className="purchase-fine-print">Secure purchase request · Revision locked · Hardware availability confirmed before charge</p>
            <div className="purchase-panel-meta"><span><b>{design.stars}</b> saves</span><span><b>{design.downloadCount}</b> licensed downloads</span><span><b>{design.discussionCount}</b> discussions</span></div>
          </div>
          <div className="purchase-support"><strong>Need a custom build?</strong><p>Ask for assembly, fixture, cooling, or verification scope.</p><a href={`/lab?design=${design.slug}&service=engineering`}>Talk to an engineer <span aria-hidden="true">↗</span></a></div>
        </aside>
      </div>
      </main>
      <SiteFooter />
    </>
  );
}
