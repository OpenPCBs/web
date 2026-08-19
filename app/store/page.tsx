import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { CatalogBrowser } from "@/app/components/public-product-catalog";
import styles from "@/app/components/product-catalog.module.css";
import { SiteFooter, SiteHeader } from "@/app/components/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Electronics Catalog | Thevenin Supply" },
  description:
    "Search Thevenin Supply's live electronics catalog by product, category, and published availability.",
};

export const dynamic = "force-dynamic";

type SearchValue = string | string[] | undefined;
type StoreSearchParams = Record<string, SearchValue>;

function first(value: SearchValue, maxLength = 200): string {
  const result = Array.isArray(value) ? value[0] : value;
  return result?.trim().slice(0, maxLength) ?? "";
}

function currentStorePath(values: {
  query: string;
  category: string;
  availability: string;
  productSlug: string;
}): string {
  const params = new URLSearchParams();
  if (values.query) params.set("q", values.query);
  if (values.category) params.set("category", values.category);
  if (values.availability) params.set("availability", values.availability);
  if (values.productSlug) params.set("product", values.productSlug);
  const query = params.toString();
  return query ? `/store?${query}` : "/store";
}

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<StoreSearchParams>;
}) {
  const [params, user] = await Promise.all([searchParams, getChatGPTUser()]);
  const query = first(params.q);
  const category = first(params.category, 100);
  const availability = first(params.availability, 30);
  const productSlug = first(params.product, 150);
  const returnTo = currentStorePath({ query, category, availability, productSlug });

  return (
    <>
      <SiteHeader active="store" />
      <main className={styles.page}>
        <section className={`${styles.container} ${styles.storeIntro}`} aria-labelledby="store-title">
          <span className={styles.kicker}>THEVENIN SUPPLY · LIVE CATALOG</span>
          <h1 id="store-title">Specialized electronics and test equipment</h1>
          <p>
            This catalog shows published database inventory only. Search by product name,
            SKU, description, or category; sign in when you are ready to keep a persistent cart.
          </p>
        </section>

        <div className={styles.container}>
          <CatalogBrowser
            initialQuery={query}
            initialCategory={category}
            initialAvailability={availability}
            productSlug={productSlug}
            signedIn={Boolean(user)}
            signInHref={chatGPTSignInPath(returnTo)}
          />
        </div>

        <section className={styles.services} aria-labelledby="catalog-help-title">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div><span>ENGINEER-LED SOURCING</span><h2 id="catalog-help-title">Can&apos;t find the exact part?</h2></div>
              <Link href="/contact?type=sourcing">Start a sourcing request →</Link>
            </div>
            <p>
              Send a manufacturer part number or the required operating envelope. The sourcing
              desk can review products that are not yet published in the catalog.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
