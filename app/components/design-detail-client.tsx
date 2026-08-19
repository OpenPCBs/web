"use client";

import Link from "./native-link";
import { useEffect, useState } from "react";
import {
  apiMessage,
  designFromPayload,
  filesFromPayload,
  formatBytes,
  formatDate,
  formatMoney,
  labelStatus,
  type DesignFile,
  type DesignRecord,
} from "./design-api";
import styles from "./design-works.module.css";

type LoadState = "loading" | "ready" | "error" | "not_found";

function Cover({ design }: { design: DesignRecord }) {
  const [failed, setFailed] = useState(false);
  const url = design.coverImageUrl?.trim();
  return (
    <div className={styles.detailCover}>
      {url && !failed ? (
        <img src={url} alt={design.title} onError={() => setFailed(true)} />
      ) : (
        <div><span>Cover image not provided</span><small>{design.category}</small></div>
      )}
    </div>
  );
}

export function DesignDetailClient({ slug }: { slug: string }) {
  const [design, setDesign] = useState<DesignRecord | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);
  const [files, setFiles] = useState<DesignFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState("loading");
      setError("");
      setFiles([]);
      setFilesError("");
      try {
        const response = await fetch(`/api/designs/${encodeURIComponent(slug)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (response.status === 404) {
          setState("not_found");
          return;
        }
        if (!response.ok) {
          throw new Error(apiMessage(payload, "This design could not be loaded."));
        }
        const parsed = designFromPayload(payload);
        if (!parsed) {
          setState("not_found");
          return;
        }
        setDesign(parsed);
        setState("ready");

        if (parsed.currentRevision?.id) {
          setFilesLoading(true);
          const fileResponse = await fetch(
            `/api/files?revisionId=${encodeURIComponent(parsed.currentRevision.id)}`,
            { cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal },
          );
          const filePayload: unknown = await fileResponse.json().catch(() => null);
          if (!fileResponse.ok) {
            setFilesError(apiMessage(filePayload, "Files for this revision could not be loaded."));
          } else {
            setFiles(filesFromPayload(filePayload));
          }
          setFilesLoading(false);
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "This design could not be loaded.");
        setState("error");
        setFilesLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [requestKey, slug]);

  if (state === "loading") {
    return <div className={styles.statePanel} role="status">Loading the design record…</div>;
  }
  if (state === "not_found") {
    return (
      <div className={styles.statePanel}>
        <h1>Design not found</h1>
        <p>This URL does not resolve to a published database design or an owned private draft.</p>
        <Link className={styles.secondaryButton} href="/marketplace">Return to the marketplace</Link>
      </div>
    );
  }
  if (state === "error" || !design) {
    return (
      <div className={styles.statePanel} role="alert">
        <h1>Design temporarily unavailable</h1><p>{error}</p>
        <button className={styles.secondaryButton} type="button" onClick={() => setRequestKey((key) => key + 1)}>Try again</button>
      </div>
    );
  }

  const currentRevision = design.currentRevision;
  const revisions = design.revisions ?? [];

  return (
    <>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/">Home</Link><span aria-hidden="true">/</span>
        <Link href="/marketplace">Thevenin Works</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{design.title}</span>
      </nav>

      <section className={styles.detailHero} aria-labelledby="design-title">
        <Cover design={design} />
        <div className={styles.detailHeading}>
          <div className={styles.cardMeta}><span>{design.category}</span><span>{labelStatus(design.publicationStatus)}</span></div>
          <h1 id="design-title">{design.title}</h1>
          {design.summary ? <p>{design.summary}</p> : <p className={styles.muted}>No summary provided.</p>}
          <dl className={styles.detailFacts}>
            <div><dt>Owner</dt><dd>{design.owner?.displayName ?? "Not available"}</dd></div>
            <div><dt>License</dt><dd>{design.license}</dd></div>
            <div><dt>Listed price</dt><dd>{design.priceCents === 0 ? "Free" : formatMoney(design.priceCents)}</dd></div>
            <div><dt>Updated</dt><dd>{formatDate(design.updatedAt)}</dd></div>
          </dl>
        </div>
      </section>

      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <section className={styles.detailSection} aria-labelledby="overview-title">
            <header><span>DESIGN RECORD</span><h2 id="overview-title">Description</h2></header>
            {design.description ? <p className={styles.description}>{design.description}</p> : <p className={styles.muted}>No detailed description was provided.</p>}
          </section>

          <section className={styles.detailSection} aria-labelledby="files-title">
            <header><span>CURRENT REVISION</span><h2 id="files-title">Files</h2></header>
            {!currentRevision ? (
              <div className={styles.inlineEmpty}>No current revision is assigned, so there are no revision files to show.</div>
            ) : filesLoading ? (
              <div className={styles.inlineEmpty} role="status">Loading revision files…</div>
            ) : filesError ? (
              <div className={styles.inlineError} role="alert">{filesError}</div>
            ) : files.length ? (
              <ul className={styles.fileList}>
                {files.map((file) => (
                  <li key={file.id}>
                    <div><strong>{file.originalName}</strong><span>{labelStatus(file.kind)} · {formatBytes(file.byteSize)} · {file.visibility}</span></div>
                    <code title={file.checksumSha256}>SHA-256 {file.checksumSha256.slice(0, 16)}…</code>
                    <a href={`/api/files/${encodeURIComponent(file.id)}`}>Download</a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.inlineEmpty}>No accessible files are attached to the current revision.</div>
            )}
          </section>

          <section className={styles.detailSection} aria-labelledby="revisions-title">
            <header><span>PERSISTED HISTORY</span><h2 id="revisions-title">Revisions</h2></header>
            {revisions.length ? (
              <ol className={styles.revisionList}>
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    <div className={styles.revisionHead}>
                      <div><strong>Revision {revision.version}</strong><span>{labelStatus(revision.lifecycleStatus)}</span></div>
                      <time dateTime={revision.createdAt}>{formatDate(revision.createdAt)}</time>
                    </div>
                    <dl>
                      <div><dt>Verification</dt><dd>{labelStatus(revision.verificationStatus)}</dd></div>
                      <div><dt>Published</dt><dd>{formatDate(revision.publishedAt)}</dd></div>
                      <div><dt>Verified</dt><dd>{formatDate(revision.verifiedAt)}</dd></div>
                    </dl>
                    {revision.changelog ? <p>{revision.changelog}</p> : <p className={styles.muted}>No changelog provided.</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.inlineEmpty}>No revision history is available.</div>
            )}
          </section>
        </div>

        <aside className={styles.detailAside} aria-labelledby="current-revision-title">
          <span>CURRENT REVISION</span>
          {currentRevision ? (
            <>
              <h2 id="current-revision-title">Revision {currentRevision.version}</h2>
              <dl>
                <div><dt>Lifecycle</dt><dd>{labelStatus(currentRevision.lifecycleStatus)}</dd></div>
                <div><dt>Verification</dt><dd>{labelStatus(currentRevision.verificationStatus)}</dd></div>
                <div><dt>Created</dt><dd>{formatDate(currentRevision.createdAt)}</dd></div>
                <div><dt>Verified</dt><dd>{formatDate(currentRevision.verifiedAt)}</dd></div>
                {currentRevision.verificationBadgeExpiresAt ? <div><dt>Badge expires</dt><dd>{formatDate(currentRevision.verificationBadgeExpiresAt)}</dd></div> : null}
              </dl>
              {currentRevision.verificationStatus !== "verified" ? (
                <Link className={styles.primaryButton} href={`/lab?revisionId=${encodeURIComponent(currentRevision.id)}`}>Commission paid verification</Link>
              ) : (
                <p className={styles.verifiedNote}>This revision has a recorded verified status.</p>
              )}
            </>
          ) : (
            <><h2 id="current-revision-title">No current revision</h2><p>The design record does not point to a revision.</p></>
          )}
          <Link className={styles.secondaryButton} href={`/contact?type=license&design=${encodeURIComponent(design.id)}`}>Ask about this design</Link>
          {design.publicationStatus !== "published" ? <Link className={styles.textLink} href={`/sell?designId=${encodeURIComponent(design.id)}`}>Edit owned draft →</Link> : null}
        </aside>
      </div>
    </>
  );
}
