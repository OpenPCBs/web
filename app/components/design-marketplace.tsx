"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  apiMessage,
  designsFromPayload,
  formatDate,
  formatMoney,
  labelStatus,
  type DesignRecord,
} from "./design-api";
import styles from "./design-works.module.css";

type LoadState = "loading" | "ready" | "error";

function Cover({ design }: { design: DesignRecord }) {
  const [failed, setFailed] = useState(false);
  const url = design.coverImageUrl?.trim();
  return (
    <div className={styles.cover}>
      {url && !failed ? (
        <img src={url} alt={design.title} onError={() => setFailed(true)} />
      ) : (
        <div><span>Cover image not provided</span><small>{design.category}</small></div>
      )}
    </div>
  );
}

export function DesignMarketplace({
  initialQuery,
  initialCategory,
  initialVerification,
  initialSort,
}: {
  initialQuery: string;
  initialCategory: string;
  initialVerification: string;
  initialSort: string;
}) {
  const [designs, setDesigns] = useState<DesignRecord[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [verification, setVerification] = useState(initialVerification);
  const [sort, setSort] = useState(initialSort);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState("loading");
      setError("");
      try {
        const response = await fetch("/api/designs", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(apiMessage(payload, "Published designs could not be loaded."));
        }
        setDesigns(designsFromPayload(payload));
        setState("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
        setDesigns([]);
        setError(caught instanceof Error ? caught.message : "Published designs could not be loaded.");
        setState("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [requestKey]);

  const categories = useMemo(
    () => [...new Set(designs.map((design) => design.category))].sort(),
    [designs],
  );
  const verificationStatuses = useMemo(
    () => [...new Set(designs.flatMap((design) => design.currentRevision ? [design.currentRevision.verificationStatus] : []))].sort(),
    [designs],
  );
  const filtered = useMemo(() => {
    const normalized = initialQuery.trim().toLocaleLowerCase("en-US");
    const matches = designs.filter((design) => {
      const searchable = [design.title, design.summary, design.description, design.category, design.license]
        .join(" ")
        .toLocaleLowerCase("en-US");
      return (
        (!normalized || searchable.includes(normalized)) &&
        (!initialCategory || design.category === initialCategory) &&
        (!initialVerification || design.currentRevision?.verificationStatus === initialVerification)
      );
    });
    return matches.sort((left, right) => {
      if (initialSort === "price-low") return left.priceCents - right.priceCents;
      if (initialSort === "price-high") return right.priceCents - left.priceCents;
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
  }, [designs, initialCategory, initialQuery, initialSort, initialVerification]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (verification) params.set("verification", verification);
    if (sort && sort !== "newest") params.set("sort", sort);
    const suffix = params.toString();
    window.location.assign(suffix ? `/marketplace?${suffix}` : "/marketplace");
  }

  const verifiedCount = designs.filter(
    (design) => design.currentRevision?.verificationStatus === "verified",
  ).length;
  const revisionCount = designs.filter((design) => design.currentRevision).length;

  return (
    <>
      <section className={styles.marketHero} aria-labelledby="marketplace-title">
        <div>
          <span className={styles.kicker}>THEVENIN WORKS · PUBLISHED DESIGNS</span>
          <h1 id="marketplace-title">Versioned electronics designs</h1>
          <p>
            Browse records published by their owners. Every title, description, price,
            revision state, and verification status below comes from the marketplace database.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#design-catalog">Browse designs</a>
            <Link className={styles.secondaryButton} href="/sell">Create a private draft</Link>
          </div>
        </div>
        <dl className={styles.stats} aria-label="Published marketplace totals">
          <div><dt>Published designs</dt><dd>{state === "ready" ? designs.length : "—"}</dd></div>
          <div><dt>Current revisions</dt><dd>{state === "ready" ? revisionCount : "—"}</dd></div>
          <div><dt>Verified revisions</dt><dd>{state === "ready" ? verifiedCount : "—"}</dd></div>
        </dl>
      </section>

      <section className={styles.principles} aria-label="Marketplace record model">
        <div><strong>Revision-specific</strong><span>Lifecycle and verification state stay attached to a persisted revision.</span></div>
        <div><strong>Owner-published</strong><span>Drafts remain private until their owner explicitly publishes them.</span></div>
        <div><strong>Evidence-aware</strong><span>Only uploaded files and recorded verification states are displayed.</span></div>
      </section>

      <section className={styles.catalog} id="design-catalog" aria-labelledby="design-results-title">
        <form className={styles.filters} onSubmit={submit} aria-label="Design filters">
          <label className={styles.searchField}>Search designs
            <input type="search" name="q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, description, category, or license" />
          </label>
          <label>Category
            <select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Verification
            <select name="verification" value={verification} onChange={(event) => setVerification(event.target.value)}>
              <option value="">Any recorded status</option>
              {verificationStatuses.map((value) => <option key={value} value={value}>{labelStatus(value)}</option>)}
            </select>
          </label>
          <label>Sort
            <select name="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Recently updated</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
          <button className={styles.primaryButton} type="submit">Apply</button>
          {(initialQuery || initialCategory || initialVerification || initialSort !== "newest") ? (
            <Link className={styles.clearLink} href="/marketplace">Clear</Link>
          ) : null}
        </form>

        <header className={styles.resultsHead}>
          <div><span>DATABASE RESULTS</span><h2 id="design-results-title">{state === "ready" ? `${filtered.length} ${filtered.length === 1 ? "design" : "designs"}` : "Published designs"}</h2></div>
          <p>{initialQuery ? `Matching “${initialQuery}”` : "Only owner-published database records are shown."}</p>
        </header>

        {state === "loading" ? (
          <div className={styles.statePanel} role="status">Loading published designs…</div>
        ) : state === "error" ? (
          <div className={styles.statePanel} role="alert">
            <h3>Marketplace temporarily unavailable</h3><p>{error}</p>
            <button className={styles.secondaryButton} type="button" onClick={() => setRequestKey((key) => key + 1)}>Try again</button>
          </div>
        ) : filtered.length ? (
          <div className={styles.designGrid}>
            {filtered.map((design) => (
              <article className={styles.designCard} key={design.id}>
                <Link href={`/designs/${encodeURIComponent(design.slug)}`} aria-label={`View ${design.title}`}><Cover design={design} /></Link>
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}><span>{design.category}</span><span>{labelStatus(design.publicationStatus)}</span></div>
                  <h3><Link href={`/designs/${encodeURIComponent(design.slug)}`}>{design.title}</Link></h3>
                  {design.summary ? <p>{design.summary}</p> : <p className={styles.muted}>No summary provided.</p>}
                  <dl className={styles.cardFacts}>
                    <div><dt>Current revision</dt><dd>{design.currentRevision?.version ?? "Not assigned"}</dd></div>
                    <div><dt>Verification</dt><dd>{design.currentRevision ? labelStatus(design.currentRevision.verificationStatus) : "Not recorded"}</dd></div>
                    <div><dt>Updated</dt><dd>{formatDate(design.updatedAt)}</dd></div>
                  </dl>
                  <footer>
                    <div><small>Listed price</small><strong>{design.priceCents === 0 ? "Free" : formatMoney(design.priceCents)}</strong></div>
                    <Link href={`/designs/${encodeURIComponent(design.slug)}`}>View record →</Link>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        ) : designs.length ? (
          <div className={styles.statePanel}><h3>No designs match these filters</h3><p>Clear a filter or try a broader search.</p><Link className={styles.secondaryButton} href="/marketplace">Clear filters</Link></div>
        ) : (
          <div className={styles.statePanel}>
            <h3>No database-backed designs are published yet</h3>
            <p>The marketplace will populate when a signed-in owner publishes a real design revision.</p>
            <Link className={styles.primaryButton} href="/sell">Create a private draft</Link>
          </div>
        )}
      </section>

      <section className={styles.publishCta}>
        <div><span className={styles.kicker}>FOR DESIGN OWNERS</span><h2>Draft privately, then publish explicitly.</h2><p>Create the persisted design and revision first, attach real files to that revision, and publish only when the record is ready.</p></div>
        <Link className={styles.primaryButton} href="/sell">Open the creator workspace</Link>
      </section>
    </>
  );
}
