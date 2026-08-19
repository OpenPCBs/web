"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  apiErrorMessage,
  formatCurrency,
  isProductRecord,
  publicProductsFromPayload,
  stockLabel,
  type ProductRecord,
  type ProductStockStatus,
} from "./catalog-api";
import styles from "./product-catalog.module.css";
import { CART_CHANGED_EVENT } from "./cart-indicator";

type LoadState = "loading" | "ready" | "error";

type ProductFeed = {
  products: ProductRecord[];
  state: LoadState;
  error: string;
  reload: () => void;
};

function usePublicProducts(): ProductFeed {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setState("loading");
      setError("");
      try {
        const response = await fetch("/api/products", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            apiErrorMessage(payload, "The live catalog could not be loaded."),
          );
        }
        setProducts(publicProductsFromPayload(payload));
        setState("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
        setProducts([]);
        setError(
          caught instanceof Error
            ? caught.message
            : "The live catalog could not be loaded.",
        );
        setState("error");
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, [requestKey]);

  return {
    products,
    state,
    error,
    reload: () => setRequestKey((current) => current + 1),
  };
}

function ProductMedia({ product, large = false }: { product: ProductRecord; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = product.imageUrl?.trim();

  return (
    <div className={large ? styles.mediaLarge : styles.media}>
      {imageUrl && !failed ? (
        <img
          className={styles.productImage}
          src={imageUrl}
          alt={product.name}
          loading={large ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.missingMedia} aria-label="Product image not provided">
          <span>Image not provided</span>
          <small>{product.sku}</small>
        </div>
      )}
    </div>
  );
}

function stockClass(status: ProductStockStatus): string {
  if (status === "in_stock") return styles.stockIn;
  if (status === "backorder") return styles.stockBackorder;
  return styles.stockUnavailable;
}

function readCartQuantities(payload: unknown): Map<string, number> {
  const quantities = new Map<string, number>();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return quantities;
  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) return quantities;
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as { productId?: unknown; quantity?: unknown; product?: unknown };
    const product = isProductRecord(record.product) ? record.product : null;
    const productId =
      typeof record.productId === "string" ? record.productId : product?.id;
    if (
      productId &&
      typeof record.quantity === "number" &&
      Number.isInteger(record.quantity) &&
      record.quantity > 0
    ) {
      quantities.set(productId, record.quantity);
    }
  }
  return quantities;
}

function AddToCart({
  product,
  signedIn,
  signInHref,
  quantity = 1,
}: {
  product: ProductRecord;
  signedIn: boolean;
  signInHref: string;
  quantity?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(!signedIn);
  const available =
    product.stockStatus === "in_stock" || product.stockStatus === "backorder";

  async function add() {
    if (!available || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const cartResponse = await fetch("/api/cart", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const cartPayload: unknown = await cartResponse.json().catch(() => null);
      if (cartResponse.status === 401) {
        setNeedsSignIn(true);
        setMessage("Sign in to save products to your cart.");
        return;
      }
      if (!cartResponse.ok) {
        throw new Error(apiErrorMessage(cartPayload, "Your cart could not be read."));
      }

      const currentQuantity = readCartQuantities(cartPayload).get(product.id) ?? 0;
      const requestedQuantity = Math.min(
        25,
        currentQuantity + Math.max(1, Math.min(25, Math.trunc(quantity))),
      );
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: requestedQuantity }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        setNeedsSignIn(true);
        setMessage("Sign in to save products to your cart.");
        return;
      }
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "This product could not be added."));
      }
      setMessage(
        requestedQuantity === 1
          ? "Added to your cart."
          : `Cart quantity is now ${requestedQuantity}.`,
      );
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "This product could not be added.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!available) {
    return (
      <button className={styles.addButton} type="button" disabled>
        Unavailable
      </button>
    );
  }

  if (needsSignIn) {
    return (
      <div className={styles.addArea}>
        <Link className={styles.addButton} href={signInHref}>
          Sign in to add
        </Link>
        {message ? <small role="status">{message}</small> : null}
      </div>
    );
  }

  return (
    <div className={styles.addArea}>
      <button className={styles.addButton} type="button" onClick={add} disabled={busy}>
        {busy ? "Adding…" : product.stockStatus === "backorder" ? "Add backorder" : "Add to cart"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}

function ProductCard({
  product,
  signedIn,
  signInHref,
}: {
  product: ProductRecord;
  signedIn: boolean;
  signInHref: string;
}) {
  const productHref = `/store?product=${encodeURIComponent(product.slug)}`;
  return (
    <article className={styles.productCard}>
      <Link href={productHref} aria-label={`View ${product.name}`}>
        <ProductMedia product={product} />
      </Link>
      <div className={styles.productBody}>
        <div className={styles.productMeta}>
          <span>{product.category}</span>
          <code>{product.sku}</code>
        </div>
        <h3 className={styles.productTitle}>
          <Link href={productHref}>{product.name}</Link>
        </h3>
        <p className={styles.productDescription}>{product.description}</p>
        <div className={styles.commercialRow}>
          <div>
            <strong>{formatCurrency(product.priceCents, product.currency)}</strong>
            <span className={`${styles.stock} ${stockClass(product.stockStatus)}`}>
              {stockLabel(product.stockStatus)}
            </span>
          </div>
          <Link className={styles.detailLink} href={productHref}>
            Details <span aria-hidden="true">→</span>
          </Link>
        </div>
        <AddToCart product={product} signedIn={signedIn} signInHref={signInHref} />
      </div>
    </article>
  );
}

function FeedStatus({
  state,
  error,
  reload,
  emptyTitle,
  emptyText,
}: {
  state: LoadState;
  error: string;
  reload: () => void;
  emptyTitle: string;
  emptyText: string;
}) {
  if (state === "loading") {
    return (
      <div className={styles.statePanel} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <p>Loading the live catalog…</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className={styles.statePanel} role="alert">
        <h3>Catalog temporarily unavailable</h3>
        <p>{error}</p>
        <button className={styles.secondaryButton} type="button" onClick={reload}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className={styles.statePanel}>
      <h3>{emptyTitle}</h3>
      <p>{emptyText}</p>
      <Link className={styles.secondaryButton} href="/contact?type=sourcing">
        Ask the sourcing desk
      </Link>
    </div>
  );
}

export function HomeProductFeed({
  signedIn,
  signInHref,
}: {
  signedIn: boolean;
  signInHref: string;
}) {
  const feed = usePublicProducts();
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of feed.products) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [feed.products]);
  const featured = useMemo(
    () =>
      [...feed.products]
        .sort(
          (left, right) =>
            Number(right.featured) - Number(left.featured) ||
            left.name.localeCompare(right.name),
        )
        .slice(0, 4),
    [feed.products],
  );

  return (
    <>
      <section className={styles.section} aria-labelledby="home-categories-title">
        <div className={styles.sectionHead}>
          <div>
            <span>LIVE CATALOG</span>
            <h2 id="home-categories-title">Shop by category</h2>
          </div>
          <Link href="/store">View all products →</Link>
        </div>
        {feed.state === "ready" && categories.length ? (
          <div className={styles.categoryGrid}>
            {categories.map(([category, count]) => (
              <Link
                className={styles.categoryLink}
                href={`/store?category=${encodeURIComponent(category)}`}
                key={category}
              >
                <strong>{category}</strong>
                <span>{count} {count === 1 ? "product" : "products"}</span>
                <b aria-hidden="true">→</b>
              </Link>
            ))}
          </div>
        ) : (
          <FeedStatus
            {...feed}
            emptyTitle="No products are published yet"
            emptyText="The catalog is ready for real inventory. Products will appear here when an administrator publishes them."
          />
        )}
      </section>

      {feed.state === "ready" && featured.length ? (
        <section className={`${styles.section} ${styles.featuredSection}`} aria-labelledby="featured-title">
          <div className={styles.sectionHead}>
            <div>
              <span>AVAILABLE TO ORDER</span>
              <h2 id="featured-title">Featured products</h2>
            </div>
            <Link href="/store">Browse the catalog →</Link>
          </div>
          <div className={styles.productGrid}>
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                signedIn={signedIn}
                signInHref={signInHref}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function CatalogBrowser({
  initialQuery,
  initialCategory,
  initialAvailability,
  productSlug,
  signedIn,
  signInHref,
}: {
  initialQuery: string;
  initialCategory: string;
  initialAvailability: string;
  productSlug: string;
  signedIn: boolean;
  signInHref: string;
}) {
  const feed = usePublicProducts();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [availability, setAvailability] = useState(initialAvailability);
  const categories = useMemo(
    () => [...new Set(feed.products.map((product) => product.category))].sort(),
    [feed.products],
  );
  const normalizedQuery = initialQuery.trim().toLocaleLowerCase("en-US");
  const filtered = useMemo(
    () =>
      feed.products.filter((product) => {
        const searchable = [
          product.name,
          product.sku,
          product.description,
          product.category,
        ]
          .join(" ")
          .toLocaleLowerCase("en-US");
        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (!initialCategory || product.category === initialCategory) &&
          (!initialAvailability || product.stockStatus === initialAvailability)
        );
      }),
    [feed.products, initialAvailability, initialCategory, normalizedQuery],
  );
  const selectedProduct = productSlug
    ? feed.products.find((product) => product.slug === productSlug)
    : undefined;

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (availability) params.set("availability", availability);
    const suffix = params.toString();
    window.location.assign(suffix ? `/store?${suffix}` : "/store");
  }

  return (
    <>
      <form className={styles.filters} onSubmit={submitFilters} aria-label="Catalog filters">
        <div className={styles.filterSearch}>
          <label htmlFor="catalog-search">Search products</label>
          <input
            id="catalog-search"
            name="q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Product name, SKU, or specification"
          />
        </div>
        <div className={styles.filterField}>
          <label htmlFor="catalog-category">Category</label>
          <select
            id="catalog-category"
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((option) => (
              <option value={option} key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <label htmlFor="catalog-availability">Availability</label>
          <select
            id="catalog-availability"
            name="availability"
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
          >
            <option value="">Any status</option>
            <option value="in_stock">In stock</option>
            <option value="backorder">Backorder</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
        <button className={styles.primaryButton} type="submit">Apply filters</button>
        {initialQuery || initialCategory || initialAvailability ? (
          <Link className={styles.resetLink} href="/store">Clear</Link>
        ) : null}
      </form>

      {productSlug && feed.state === "ready" ? (
        selectedProduct ? (
          <section className={styles.productDetail} aria-labelledby="product-detail-title">
            <ProductMedia product={selectedProduct} large />
            <div className={styles.detailContent}>
              <div className={styles.productMeta}>
                <span>{selectedProduct.category}</span>
                <code>{selectedProduct.sku}</code>
              </div>
              <h1 id="product-detail-title">{selectedProduct.name}</h1>
              <p>{selectedProduct.description}</p>
              <dl className={styles.detailFacts}>
                <div><dt>Availability</dt><dd className={stockClass(selectedProduct.stockStatus)}>{stockLabel(selectedProduct.stockStatus)}</dd></div>
                <div><dt>SKU</dt><dd>{selectedProduct.sku}</dd></div>
                <div><dt>Category</dt><dd>{selectedProduct.category}</dd></div>
              </dl>
            </div>
            <aside className={styles.buyBox} aria-label="Purchase product">
              <span>Current unit price</span>
              <strong>{formatCurrency(selectedProduct.priceCents, selectedProduct.currency)}</strong>
              <small>Price and availability are confirmed by the server when you add the item and at checkout.</small>
              <AddToCart
                product={selectedProduct}
                signedIn={signedIn}
                signInHref={signInHref}
              />
            </aside>
          </section>
        ) : (
          <div className={styles.statePanel} role="status">
            <h2>Product not found</h2>
            <p>This product is not in the current published catalog.</p>
            <Link className={styles.secondaryButton} href="/store">Return to the catalog</Link>
          </div>
        )
      ) : null}

      <section className={styles.results} aria-labelledby="catalog-results-title">
        <div className={styles.resultsHead}>
          <div>
            <span>LIVE INVENTORY</span>
            <h2 id="catalog-results-title">
              {feed.state === "ready"
                ? `${filtered.length} ${filtered.length === 1 ? "product" : "products"}`
                : "Product catalog"}
            </h2>
          </div>
          <p>Published inventory only. Prices are stored and validated server-side.</p>
        </div>
        {feed.state !== "ready" ? (
          <FeedStatus
            {...feed}
            emptyTitle="No products are published yet"
            emptyText="The catalog will populate when an administrator publishes real inventory."
          />
        ) : filtered.length ? (
          <div className={styles.productGrid}>
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                signedIn={signedIn}
                signInHref={signInHref}
              />
            ))}
          </div>
        ) : feed.products.length ? (
          <div className={styles.statePanel}>
            <h3>No products match these filters</h3>
            <p>Try a broader search, a different availability status, or clear the filters.</p>
            <Link className={styles.secondaryButton} href="/store">Clear filters</Link>
          </div>
        ) : (
          <FeedStatus
            {...feed}
            emptyTitle="No products are published yet"
            emptyText="The store is connected to the catalog database, but there are no active products to display."
          />
        )}
      </section>
    </>
  );
}
