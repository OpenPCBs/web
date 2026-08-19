import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/app/components/site-shell";
import {
  formatMoney,
  getBomSubtotal,
  getDesignBySlug,
  getDesignsUsingProduct,
  getProductsForDesign,
  getProductBySlug,
  productCategories,
  products,
  type CatalogProduct,
  type ProductCategory,
} from "@/app/lib/data";

export const metadata: Metadata = {
  title: { absolute: "Power Electronics Hardware | Thevenin Supply" },
  description: "Source specialist GaN, SiC, power-conversion, thermal, sensing, and laboratory hardware connected to buildable engineering designs.",
};

type SearchValue = string | string[] | undefined;
type StoreSearchParams = Record<string, SearchValue>;

function first(value: SearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isProductCategory(value: string): value is ProductCategory {
  return (productCategories as readonly string[]).includes(value);
}

function availabilityClass(availability: CatalogProduct["availability"]): string {
  return availability.toLowerCase().replaceAll(" ", "-");
}

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<StoreSearchParams>;
}) {
  const params = await searchParams;
  const query = first(params.q).trim();
  const categoryValue = first(params.category);
  const category = isProductCategory(categoryValue) ? categoryValue : "";
  const availability = first(params.availability);
  const sort = first(params.sort) || "featured";
  const selectedProduct = getProductBySlug(first(params.product));
  const selectedDesignKit = getDesignBySlug(first(params.kit));

  const normalizedQuery = query.toLocaleLowerCase("en-US");
  const filteredProducts = products.filter((product) => {
    const searchable = [
      product.name,
      product.maker,
      product.sku,
      product.category,
      product.summary,
      ...product.badges,
      ...product.specs.flatMap((spec) => [spec.label, spec.value]),
    ]
      .join(" ")
      .toLocaleLowerCase("en-US");

    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!category || product.category === category) &&
      (!availability || product.availability === availability)
    );
  });

  const sortedProducts = [...filteredProducts].sort((left, right) => {
    if (sort === "price-low") return left.priceCents - right.priceCents;
    if (sort === "price-high") return right.priceCents - left.priceCents;
    if (sort === "designs") {
      return getDesignsUsingProduct(right.slug).length - getDesignsUsingProduct(left.slug).length;
    }
    return Number(right.featured) - Number(left.featured) || left.name.localeCompare(right.name);
  });

  const selectedDesigns = selectedProduct ? getDesignsUsingProduct(selectedProduct.slug) : [];
  const kitProducts = selectedDesignKit ? getProductsForDesign(selectedDesignKit) : [];
  const connectedProductCount = products.filter((product) => getDesignsUsingProduct(product.slug).length > 0).length;

  return (
    <>
      <SiteHeader active="store" />
      <main className="catalog-page store-page">
      <div className="brand-context shell" aria-label="Thevenin Supply business unit">
        <strong>THEVENIN SUPPLY</strong><span>Power &amp; Instrumentation</span>
      </div>
      <section className="catalog-hero shell" aria-labelledby="store-title">
        <div className="catalog-hero-copy">
          <p className="eyebrow"><span /> SPECIALIST HARDWARE</p>
          <h1 id="store-title" className="catalog-title">Power hardware,<br /><em>properly sourced.</em></h1>
          <p className="catalog-intro">
            Focused components, development platforms, and lab instruments for serious power-electronics work. Every sourced part keeps its manufacturer, fulfillment, and design context.
          </p>
        </div>
        <dl className="catalog-stats" aria-label="Store overview">
          <div><dt>Curated products</dt><dd>{products.length}</dd></div>
          <div><dt>Linked to builds</dt><dd>{connectedProductCount}</dd></div>
          <div><dt>Core focus</dt><dd>GaN / SiC</dd></div>
        </dl>
      </section>

      {selectedDesignKit ? (
        <section className="build-kit-panel shell" id="build-kit" aria-labelledby="build-kit-title">
          <div className="build-kit-copy">
            <p className="overline">REVISION-MATCHED BUILD</p>
            <h2 id="build-kit-title">Source {selectedDesignKit.shortTitle}</h2>
            <p>Thevenin Supply checks every stocked line against Works revision {selectedDesignKit.revision}, records approved alternates, and confirms long-lead hardware before charge.</p>
            <div className="build-kit-actions"><a className="button" href={`/designs/${selectedDesignKit.slug}#license-options`}>Choose a build tier <span>→</span></a><a className="text-link" href={`/designs/${selectedDesignKit.slug}#bom`}>Review the BOM <span>↗</span></a></div>
          </div>
          <dl className="build-kit-stats">
            <div><dt>Major BOM lines</dt><dd>{selectedDesignKit.bom.length}</dd></div>
            <div><dt>Catalog-linked products</dt><dd>{kitProducts.length}</dd></div>
            <div><dt>Shown-line subtotal</dt><dd>{formatMoney(getBomSubtotal(selectedDesignKit))}</dd></div>
          </dl>
          <ul className="build-kit-products" aria-label="Linked products in this build">
            {kitProducts.slice(0, 4).map((product) => <li key={product.slug}><a href={`/store?product=${product.slug}#product-detail`}><span><small>{product.maker}</small><strong>{product.name}</strong></span><b>{formatMoney(product.priceCents)}</b><i aria-hidden="true">↗</i></a></li>)}
          </ul>
        </section>
      ) : null}

      {selectedProduct ? (
        <section className="product-detail-panel shell" id="product-detail" aria-labelledby="selected-product-title">
          <div className={`product-art product-art--${selectedProduct.visual} product-art--large`} aria-hidden="true">
            <span className="product-art-part product-art-part--a" />
            <span className="product-art-part product-art-part--b" />
            <span className="product-art-part product-art-part--c" />
            <small>{selectedProduct.sku}</small>
          </div>
          <div className="product-detail-copy">
            <div className="card-meta-row">
              <span>{selectedProduct.maker}</span>
              <span className={`availability availability--${availabilityClass(selectedProduct.availability)}`}>{selectedProduct.availability}</span>
            </div>
            <h2 id="selected-product-title">{selectedProduct.name}</h2>
            <p>{selectedProduct.summary}</p>
            <dl className="spec-list spec-list--horizontal">
              {selectedProduct.specs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}
            </dl>
            <div className="product-detail-commercial">
              <div><span className="overline">Unit price</span><strong>{formatMoney(selectedProduct.priceCents)}</strong><small>{selectedProduct.leadTime}</small></div>
              <a className="button" href={`/lab?service=sourcing&product=${selectedProduct.slug}`}>{selectedProduct.availability === "Request quote" ? "Request a quote" : "Request sourcing"} <span>→</span></a>
            </div>
          </div>
          <aside className="design-connection" aria-labelledby="design-connection-title">
            <p className="overline" id="design-connection-title">Designs using this product</p>
            {selectedDesigns.length ? (
              <ul>
                {selectedDesigns.map((design) => (
                  <li key={design.slug}>
                    <a href={`/designs/${design.slug}`}><span>{design.shortTitle}</span><small>Rev {design.revision} · {design.verification.level}</small><b aria-hidden="true">↗</b></a>
                  </li>
                ))}
              </ul>
            ) : <p className="muted-copy">No published build uses this product yet.</p>}
          </aside>
        </section>
      ) : null}

      <section className="catalog-body shell" aria-labelledby="catalog-results-title">
        <form className="catalog-toolbar" action="/store" method="get" role="search">
          <div className="search-field">
            <label htmlFor="store-query">Search hardware</label>
            <div className="search-input-wrap"><span aria-hidden="true">⌕</span><input id="store-query" name="q" type="search" defaultValue={query} placeholder="Part, maker, voltage, application…" /></div>
          </div>
          <div className="filter-field">
            <label htmlFor="store-category">Category</label>
            <select id="store-category" name="category" defaultValue={category}>
              <option value="">All categories</option>
              {productCategories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="store-availability">Availability</label>
            <select id="store-availability" name="availability" defaultValue={availability}>
              <option value="">Any availability</option>
              <option value="In stock">In stock</option>
              <option value="Lead time">Lead time</option>
              <option value="Request quote">Request quote</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="store-sort">Sort</label>
            <select id="store-sort" name="sort" defaultValue={sort}>
              <option value="featured">Featured</option>
              <option value="designs">Most used in designs</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
          <button className="button button-small" type="submit">Apply filters</button>
          {(query || category || availability || sort !== "featured") ? <a className="toolbar-reset" href="/store">Reset</a> : null}
        </form>

        <div className="results-heading">
          <div><p className="overline">CURATED CATALOG</p><h2 id="catalog-results-title">{sortedProducts.length} {sortedProducts.length === 1 ? "product" : "products"}</h2></div>
          <p aria-live="polite">{query ? <>Matching “{query}”</> : "Manufacturer-backed sourcing and traceable fulfillment."}</p>
        </div>

        {sortedProducts.length ? (
          <div className="product-grid">
            {sortedProducts.map((product) => {
              const connectedDesigns = getDesignsUsingProduct(product.slug);
              return (
                <article className="product-card" key={product.slug}>
                  <a className="product-card-visual-link" href={`/store?product=${product.slug}#product-detail`} aria-label={`View ${product.name} specifications`}>
                    <div className={`product-art product-art--${product.visual}`} aria-hidden="true">
                      <span className="product-art-part product-art-part--a" />
                      <span className="product-art-part product-art-part--b" />
                      <span className="product-art-part product-art-part--c" />
                      <small>{product.sku}</small>
                    </div>
                  </a>
                  <div className="product-card-body">
                    <div className="card-meta-row"><span>{product.maker}</span><span>{product.category}</span></div>
                    <h3><a href={`/store?product=${product.slug}#product-detail`}>{product.name}</a></h3>
                    <p>{product.summary}</p>
                    <dl className="product-card-specs" aria-label="Key specifications">
                      {product.specs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}
                    </dl>
                    <div className="product-card-fulfillment"><span>Fulfillment</span><strong>{product.fulfillment}</strong><small>{product.leadTime}</small></div>
                    <div className="product-card-designs">
                      <span className={`availability availability--${availabilityClass(product.availability)}`}>{product.availability}</span>
                      {connectedDesigns.length ? <a href={`/designs/${connectedDesigns[0].slug}`}>{connectedDesigns.length} {connectedDesigns.length === 1 ? "design uses" : "designs use"} this <span aria-hidden="true">↗</span></a> : <span>No linked designs yet</span>}
                    </div>
                    <div className="card-price-row"><div><small>{product.availability === "Request quote" ? "Budgetary price" : "Unit price"}</small><strong>{formatMoney(product.priceCents)}</strong></div><a className="product-action-link" href={`/store?product=${product.slug}#product-detail`}>{product.availability === "Request quote" ? "View / quote" : "View product"} <span aria-hidden="true">→</span></a></div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p className="overline">NO EXACT MATCH</p>
            <h2>Try a broader hardware search.</h2>
            <p>Remove a filter or ask the sourcing desk for a manufacturer part that is not listed yet.</p>
            <a className="button" href="/store">Clear all filters <span>→</span></a>
          </div>
        )}
      </section>

      <section className="catalog-cta shell">
        <div><p className="eyebrow"><span /> ENGINEER-LED SOURCING</p><h2>Need a qualified alternative?</h2><p>Share the operating point, compliance target, and schedule. We will source an authorized match and keep substitutions visible.</p></div>
        <a className="button" href="/lab?service=sourcing">Start a sourcing request <span>↗</span></a>
      </section>
      </main>
      <SiteFooter />
    </>
  );
}
