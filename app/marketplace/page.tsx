import type { Metadata } from "next";
import { DivisionBanner, SiteFooter, SiteHeader } from "@/app/components/site-shell";
import {
  designCategories,
  designs,
  formatMoney,
  getProductsForDesign,
  verificationLevels,
  type DesignCategory,
  type VerificationLevel,
} from "@/app/lib/data";

export const metadata: Metadata = {
  title: { absolute: "Engineering Design Marketplace | Thevenin Works" },
  description: "Versioned power-electronics designs with native source, BOMs, simulations, firmware, test evidence, build kits, and revision-bound verification.",
};

type SearchValue = string | string[] | undefined;
type MarketplaceSearchParams = Record<string, SearchValue>;

function first(value: SearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isDesignCategory(value: string): value is DesignCategory {
  return (designCategories as readonly string[]).includes(value);
}

function isVerificationLevel(value: string): value is VerificationLevel {
  return (verificationLevels as readonly string[]).includes(value);
}

function verificationClass(level: VerificationLevel): string {
  return level.toLowerCase().replaceAll(" ", "-");
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const params = await searchParams;
  const query = first(params.q).trim();
  const categoryValue = first(params.category);
  const category = isDesignCategory(categoryValue) ? categoryValue : "";
  const verificationValue = first(params.verification);
  const verification = isVerificationLevel(verificationValue) ? verificationValue : "";
  const sort = first(params.sort) || "featured";
  const normalizedQuery = query.toLocaleLowerCase("en-US");

  const filteredDesigns = designs.filter((design) => {
    const searchable = [
      design.title,
      design.shortTitle,
      design.category,
      design.author,
      design.summary,
      design.input,
      design.output,
      ...design.tags,
      ...design.applications,
    ]
      .join(" ")
      .toLocaleLowerCase("en-US");

    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!category || design.category === category) &&
      (!verification || design.verification.level === verification)
    );
  });

  const sortedDesigns = [...filteredDesigns].sort((left, right) => {
    if (sort === "newest") return Date.parse(right.updatedOn) - Date.parse(left.updatedOn);
    if (sort === "popular") return right.stars - left.stars;
    if (sort === "price-low") return left.tiers[0].priceCents - right.tiers[0].priceCents;
    return Number(right.featured) - Number(left.featured) || right.stars - left.stars;
  });

  const labVerifiedCount = designs.filter((design) => design.verification.level === "Lab Verified").length;
  const sourcedLineCount = new Set(designs.flatMap((design) => design.bom.flatMap((line) => line.productSlug ? [line.productSlug] : []))).size;

  return (
    <>
      <SiteHeader active="marketplace" />
      <DivisionBanner />
      <main className="catalog-page marketplace-page">

      <section className="catalog-hero marketplace-hero shell" aria-labelledby="marketplace-title">
        <div className="catalog-hero-copy">
          <p className="eyebrow"><span /> VERSIONED ENGINEERING IP</p>
          <h1 id="marketplace-title" className="catalog-title">Reference designs<br />you can <em>actually build.</em></h1>
          <p className="catalog-intro">
            Native design files, traceable BOMs, firmware, simulation, measured data, and real revision history—connected directly to the hardware required to reproduce the work.
          </p>
          <div className="hero-actions"><a className="button" href="#design-catalog">Explore designs <span>↓</span></a><a className="text-link" href="#publish">Publish your work <span>↗</span></a></div>
        </div>
        <dl className="catalog-stats marketplace-stats" aria-label="Marketplace overview">
          <div><dt>Published designs</dt><dd>{designs.length}</dd></div>
          <div><dt>Lab verified</dt><dd>{labVerifiedCount}</dd></div>
          <div><dt>Sourced product links</dt><dd>{sourcedLineCount}</dd></div>
        </dl>
      </section>

      <section className="marketplace-principles shell" aria-label="Marketplace principles">
        <div><span>01</span><strong>Revision controlled</strong><p>Files, BOM, test evidence, and badges stay tied to a specific release.</p></div>
        <div><span>02</span><strong>Build-kit ready</strong><p>Buy source alone, a matched component kit, or a complete development platform.</p></div>
        <div><span>03</span><strong>Evidence visible</strong><p>Verification level and test provenance are shown before you license a design.</p></div>
      </section>

      <section className="catalog-body shell" id="design-catalog" aria-labelledby="marketplace-results-title">
        <form className="catalog-toolbar" action="/marketplace" method="get" role="search">
          <div className="search-field">
            <label htmlFor="design-query">Search designs</label>
            <div className="search-input-wrap"><span aria-hidden="true">⌕</span><input id="design-query" name="q" type="search" defaultValue={query} placeholder="Topology, voltage, application…" /></div>
          </div>
          <div className="filter-field">
            <label htmlFor="design-category">Category</label>
            <select id="design-category" name="category" defaultValue={category}>
              <option value="">All categories</option>
              {designCategories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="design-verification">Verification</label>
            <select id="design-verification" name="verification" defaultValue={verification}>
              <option value="">Any level</option>
              {verificationLevels.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="design-sort">Sort</label>
            <select id="design-sort" name="sort" defaultValue={sort}>
              <option value="featured">Featured</option>
              <option value="newest">Recently updated</option>
              <option value="popular">Most saved</option>
              <option value="price-low">Price: low to high</option>
            </select>
          </div>
          <button className="button button-small" type="submit">Apply filters</button>
          {(query || category || verification || sort !== "featured") ? <a className="toolbar-reset" href="/marketplace">Reset</a> : null}
        </form>

        <div className="results-heading">
          <div><p className="overline">DESIGN CATALOG</p><h2 id="marketplace-results-title">{sortedDesigns.length} {sortedDesigns.length === 1 ? "design" : "designs"}</h2></div>
          <p aria-live="polite">{query ? <>Matching “{query}”</> : "Sorted by engineering completeness and community signal."}</p>
        </div>

        {sortedDesigns.length ? (
          <div className="design-grid">
            {sortedDesigns.map((design) => {
              const linkedProducts = getProductsForDesign(design);
              return (
                <article className="design-card" key={design.slug}>
                  <a className={`design-card-visual design-card-visual--${design.visual}`} href={`/designs/${design.slug}`} aria-label={`View ${design.title}`}>
                    <span className="design-board" aria-hidden="true">
                      <i /><i /><i /><i /><i /><i />
                      <b className="design-chip design-chip--a" /><b className="design-chip design-chip--b" /><b className="design-trace design-trace--a" /><b className="design-trace design-trace--b" />
                    </span>
                    <span className="design-number">DESIGN #{design.id}</span>
                    <span className="design-layer-count">{design.layers} LAYERS</span>
                  </a>
                  <div className="design-card-body">
                    <div className="card-meta-row">
                      <span>{design.category}</span>
                      <span className={`verification-badge verification-badge--${verificationClass(design.verification.level)}`}><i aria-hidden="true">✓</i>{design.verification.level}</span>
                    </div>
                    <h3><a href={`/designs/${design.slug}`}>{design.title}</a></h3>
                    <p>{design.summary}</p>
                    <dl className="design-metrics">
                      <div><dt>Power</dt><dd>{design.power}</dd></div>
                      <div><dt>Input</dt><dd>{design.input}</dd></div>
                      <div><dt>Efficiency</dt><dd>{design.efficiency}</dd></div>
                    </dl>
                    <ul className="tag-list" aria-label="Design tags">{design.tags.slice(0, 4).map((tag) => <li key={tag}>{tag}</li>)}</ul>
                    <div className="design-commerce-link">
                      <span>{linkedProducts.length} sourced {linkedProducts.length === 1 ? "product" : "products"}</span>
                      <a href={`/designs/${design.slug}#bom`}>Complete BOM <span aria-hidden="true">↗</span></a>
                    </div>
                    <footer className="design-card-footer">
                      <div className="author-lockup"><span aria-hidden="true">{design.authorInitials}</span><div><strong>{design.author}</strong><small>Rev {design.revision} · Updated <time dateTime={design.updatedOn}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${design.updatedOn}T00:00:00Z`))}</time></small></div></div>
                      <div className="design-price"><small>Files from</small><strong>{formatMoney(design.tiers[0].priceCents)}</strong></div>
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p className="overline">NO EXACT MATCH</p>
            <h2>Try a wider design search.</h2>
            <p>Remove a verification level or search by a broader topology, voltage, or application.</p>
            <a className="button" href="/marketplace">Clear all filters <span>→</span></a>
          </div>
        )}
      </section>

      <section className="verification-levels shell" aria-labelledby="verification-levels-title">
        <div className="section-heading"><div><p className="eyebrow"><span /> TRUST, WITH SCOPE</p><h2 id="verification-levels-title">Know what has actually been tested.</h2></div><p>Badges never float between revisions. Paid lab verification is commissioned for a defined build, operating envelope, and test plan.</p></div>
        <div className="verification-grid">
          <article><span>01</span><h3>Community</h3><p>Published files and author claims; no build evidence is required.</p></article>
          <article><span>02</span><h3>Built</h3><p>The creator documents functioning hardware and the tested revision.</p></article>
          <article><span>03</span><h3>Verified</h3><p>Independent engineering review checks completeness and evidence.</p></article>
          <article className="verification-tier-featured"><span>04</span><h3>Lab Verified</h3><p>Thevenin rebuilds and measures the release under a paid, scoped test plan.</p><a href="/lab">Commission from $3,500 <b aria-hidden="true">↗</b></a></article>
        </div>
      </section>

      <section className="publish-cta shell" id="publish">
        <div><p className="eyebrow"><span /> FOR DESIGN AUTHORS</p><h2>Turn engineering work into a product.</h2><p>Publish versioned source, keep 85% of design-file revenue, and earn hardware referral commission when builders source your BOM through Thevenin Supply.</p></div>
        <div className="publish-actions"><a className="button" href="/marketplace?intent=publish">Start a design listing <span>→</span></a><small>Draft privately. Publish after completeness review.</small></div>
      </section>
      </main>
      <SiteFooter />
    </>
  );
}
