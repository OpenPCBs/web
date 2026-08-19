import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import { HomeProductFeed } from "./components/public-product-catalog";
import styles from "./components/product-catalog.module.css";
import { SiteFooter, SiteHeader } from "./components/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Thevenin Supply | Specialized Electronics & Test Equipment" },
  description:
    "Source published electronics and test equipment inventory, manage an account-backed cart, and access Thevenin Works engineering services.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const signInHref = chatGPTSignInPath("/");

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>SPECIALIZED ELECTRONICS DISTRIBUTION</span>
              <h1>Power electronics and test equipment, from one dependable source.</h1>
              <p>
                Search the live catalog, see published pricing and availability, and keep
                procurement connected to technical support and build-ready engineering.
              </p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href="/store">Shop the catalog</Link>
                <Link className={styles.secondaryButton} href="/contact?type=quote">Request a quote</Link>
              </div>
            </div>
            <aside className={styles.searchPanel} aria-label="Catalog search">
              <strong>Find a product</strong>
              <p>Search current published inventory by product name, category, or part number.</p>
              <form className={styles.searchForm} action="/store" role="search">
                <label className="sr-only" htmlFor="home-product-search">Search products</label>
                <input id="home-product-search" name="q" type="search" placeholder="Name, SKU, or specification" />
                <button className={styles.primaryButton} type="submit">Search</button>
              </form>
            </aside>
          </div>
        </section>

        <section className={styles.assurance} aria-label="Buying support">
          <div className={`${styles.container} ${styles.assuranceGrid}`}>
            <div><strong>Visible availability</strong><span>Published stock status is shown on every product.</span></div>
            <div><strong>Account-backed cart</strong><span>Signed-in carts persist securely between visits.</span></div>
            <div><strong>Server-confirmed pricing</strong><span>Product prices are validated again when the order is created.</span></div>
          </div>
        </section>

        <HomeProductFeed signedIn={Boolean(user)} signInHref={signInHref} />

        <section className={styles.services} aria-labelledby="services-title">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div><span>FOR ENGINEERING TEAMS</span><h2 id="services-title">Help beyond the product list</h2></div>
            </div>
            <div className={styles.serviceGrid}>
              <article>
                <h3>Application support</h3>
                <p>Share the operating range, interface, isolation, thermal, or compliance target behind the purchase.</p>
                <Link href="/contact?type=support">Contact support →</Link>
              </article>
              <article>
                <h3>Sourcing requests</h3>
                <p>Ask for a specific manufacturer part or a qualified alternative that is not yet in the public catalog.</p>
                <Link href="/contact?type=sourcing">Start a sourcing request →</Link>
              </article>
              <article>
                <h3>Project quotes</h3>
                <p>Request itemized pricing for equipment, components, build hardware, or verification services.</p>
                <Link href="/contact?type=quote">Request a quote →</Link>
              </article>
            </div>
          </div>
        </section>

        <section className={`${styles.container} ${styles.works}`} aria-labelledby="works-title">
          <div className={styles.worksMark}>
            <span aria-hidden="true">TW</span>
            <div><b>THEVENIN WORKS</b><small>ENGINEERING DIVISION</small></div>
          </div>
          <div>
            <h2 id="works-title">When procurement needs to become working hardware.</h2>
            <p>Inspect Gerbers, license versioned designs, and commission paid lab verification tied to an exact revision.</p>
          </div>
          <Link href="/marketplace">Browse engineering designs →</Link>
        </section>

        <section className={styles.nameStory}>
          <div className={styles.container}>
            <span className={styles.kicker}>WHY THEVENIN?</span>
            <p>
              Thévenin&apos;s theorem reduces a complex electrical network to one dependable
              source. Our promise is similar: reduce complex electronics procurement to one
              dependable source without hiding the specification.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
