"use client";

import Link from "./native-link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  apiMessage,
  filesFromPayload,
  formatBytes,
  formatMoney,
  labelStatus,
  ownedDesignsFromPayload,
  type DesignFile,
  type DesignRecord,
  type PublicationStatus,
} from "./design-api";
import styles from "./design-works.module.css";

type Fields = {
  title: string;
  category: string;
  summary: string;
  license: string;
  price: string;
  description: string;
  version: string;
};

type Notice = { tone: "success" | "warning" | "error"; message: string };

const EMPTY_FIELDS: Fields = {
  title: "",
  category: "",
  summary: "",
  license: "CERN-OHL-P-2.0",
  price: "0",
  description: "",
  version: "1.0.0",
};

function stringAt(payload: unknown, parent: string, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const nested = (payload as Record<string, unknown>)[parent];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return null;
  const value = (nested as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

export function SellForm({
  initialDesignId,
  signedIn,
  signInHref,
}: {
  initialDesignId: string;
  signedIn: boolean;
  signInHref: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [recordId, setRecordId] = useState(initialDesignId);
  const [design, setDesign] = useState<DesignRecord | null>(null);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [storedFiles, setStoredFiles] = useState<DesignFile[]>([]);
  const [loading, setLoading] = useState(Boolean(initialDesignId && signedIn));
  const [saving, setSaving] = useState(false);
  const [fileBusyId, setFileBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadFiles = useCallback(async (revisionId: string) => {
    const response = await fetch(`/api/files?revisionId=${encodeURIComponent(revisionId)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(apiMessage(payload, "Revision files could not be loaded."));
    setStoredFiles(filesFromPayload(payload));
  }, []);

  const loadOwnedDesign = useCallback(async (designId: string) => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/designs?mine=1", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiMessage(payload, "Your designs could not be loaded."));
      const found = ownedDesignsFromPayload(payload).find((item) => item.id === designId);
      if (!found) throw new Error("This design was not found in your account.");
      setDesign(found);
      setFields({
        title: found.title,
        category: found.category,
        summary: found.summary,
        license: found.license,
        price: (found.priceCents / 100).toFixed(2),
        description: found.description,
        version: found.currentRevision?.version ?? "",
      });
      if (found.currentRevision?.id) await loadFiles(found.currentRevision.id);
      else setStoredFiles([]);
    } catch (caught) {
      setDesign(null);
      setStoredFiles([]);
      setNotice({ tone: "error", message: caught instanceof Error ? caught.message : "This design could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [loadFiles]);

  useEffect(() => {
    if (initialDesignId && signedIn) void loadOwnedDesign(initialDesignId);
  }, [initialDesignId, loadOwnedDesign, signedIn]);

  function setField<Key extends keyof Fields>(key: Key, value: Fields[Key]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function requestBody(status?: PublicationStatus) {
    const price = Number(fields.price);
    return {
      title: fields.title.trim(),
      category: fields.category.trim() || "Other",
      summary: fields.summary.trim(),
      license: fields.license.trim(),
      description: fields.description.trim(),
      priceCents: Number.isFinite(price) ? Math.max(0, Math.round(price * 100)) : 0,
      ...(status ? { publicationStatus: status } : {}),
    };
  }

  async function uploadFiles(revisionId: string): Promise<{ uploaded: number; failed: string[] }> {
    let uploaded = 0;
    const failed: string[] = [];
    for (const file of selectedFiles) {
      const body = new FormData();
      body.set("revisionId", revisionId);
      body.set("kind", inferFileKind(file.name));
      body.set("visibility", "private");
      body.set("file", file, file.name);
      const response = await fetch("/api/files", { method: "POST", body });
      if (response.ok) uploaded += 1;
      else failed.push(file.name);
    }
    return { uploaded, failed };
  }

  async function persist(status?: PublicationStatus) {
    if (!formRef.current?.reportValidity() || saving) return;
    if (status === "archived" && !window.confirm("Archive this design and remove it from the public marketplace?")) return;
    setSaving(true);
    setNotice(null);
    try {
      let activeId = recordId;
      let revisionId = design?.currentRevision?.id ?? null;
      if (activeId) {
        const response = await fetch(`/api/designs/${encodeURIComponent(activeId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(requestBody(status)),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(apiMessage(payload, "The design could not be updated."));
      } else {
        if (status) throw new Error("Save the design draft before publishing or archiving it.");
        const response = await fetch("/api/designs", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ ...requestBody(), version: fields.version.trim() || "1.0.0" }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(apiMessage(payload, "The design draft could not be created."));
        activeId = stringAt(payload, "design", "id") ?? "";
        revisionId = stringAt(payload, "revision", "id");
        if (!activeId || !revisionId) throw new Error("The draft was created without its design or revision identifier.");
        setRecordId(activeId);
        window.history.replaceState(null, "", `/sell?designId=${encodeURIComponent(activeId)}`);
      }

      let uploadSummary = "";
      if (selectedFiles.length) {
        if (!revisionId) throw new Error("The current revision is missing, so files cannot be attached.");
        const upload = await uploadFiles(revisionId);
        uploadSummary = upload.failed.length
          ? ` ${upload.uploaded} of ${selectedFiles.length} files uploaded; failed: ${upload.failed.join(", ")}.`
          : ` ${upload.uploaded} ${upload.uploaded === 1 ? "file" : "files"} uploaded privately.`;
      }
      setSelectedFiles([]);
      await loadOwnedDesign(activeId);
      setNotice({
        tone: uploadSummary.includes("failed") ? "warning" : "success",
        message: status === "published"
          ? `Design published.${uploadSummary} Choose which revision files should be public below.`
          : status === "archived"
            ? `Design archived.${uploadSummary}`
            : `Design draft saved.${uploadSummary}`,
      });
    } catch (caught) {
      setNotice({ tone: "error", message: caught instanceof Error ? caught.message : "The design could not be saved." });
    } finally {
      setSaving(false);
    }
  }

  async function changeVisibility(file: DesignFile) {
    if (fileBusyId) return;
    const visibility = file.visibility === "public" ? "private" : "public";
    setFileBusyId(file.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(file.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ visibility }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiMessage(payload, "File visibility could not be changed."));
      if (design?.currentRevision?.id) await loadFiles(design.currentRevision.id);
      setNotice({ tone: "success", message: `${file.originalName} is now ${visibility}.` });
    } catch (caught) {
      setNotice({ tone: "error", message: caught instanceof Error ? caught.message : "File visibility could not be changed." });
    } finally {
      setFileBusyId(null);
    }
  }

  if (!signedIn) {
    return (
      <section className={styles.signInPanel}>
        <h2>Sign in to create or edit a design</h2>
        <p>Drafts, revisions, and uploaded files are stored with your account.</p>
        <Link className={styles.primaryButton} href={signInHref}>Sign in with ChatGPT</Link>
      </section>
    );
  }

  if (loading) return <div className={styles.statePanel} role="status">Loading your design draft…</div>;

  return (
    <form className={styles.sellForm} ref={formRef} onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void persist(); }}>
      <header>
        <div><span>{recordId ? "EDIT DESIGN" : "NEW PRIVATE DRAFT"}</span><h2>{recordId ? design?.title ?? "Owned design" : "Design record"}</h2></div>
        {design ? <b data-status={design.publicationStatus}>{labelStatus(design.publicationStatus)}</b> : null}
      </header>

      {notice ? <p className={styles.formNotice} data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.message}</p> : null}

      <div className={styles.formGrid}>
        <label>Design title<input required maxLength={140} value={fields.title} onChange={(event) => setField("title", event.target.value)} /></label>
        <label>Category<input required maxLength={80} value={fields.category} onChange={(event) => setField("category", event.target.value)} placeholder="e.g. Motor control" /></label>
      </div>
      <label>One-line summary<input required maxLength={400} value={fields.summary} onChange={(event) => setField("summary", event.target.value)} /></label>
      <div className={styles.formGrid}>
        <label>License<input required maxLength={80} value={fields.license} onChange={(event) => setField("license", event.target.value)} /></label>
        <label>Listed price (USD)<input required type="number" min="0" max="100000" step="0.01" value={fields.price} onChange={(event) => setField("price", event.target.value)} /></label>
      </div>
      <label>Detailed description<textarea required maxLength={20000} rows={8} value={fields.description} onChange={(event) => setField("description", event.target.value)} placeholder="State operating limits, assumptions, known issues, and required equipment." /></label>

      <div className={styles.revisionEditor}>
        <div><span>CURRENT REVISION</span><strong>{design?.currentRevision?.version ?? (fields.version || "Not assigned")}</strong><small>{design?.currentRevision ? `${labelStatus(design.currentRevision.lifecycleStatus)} · ${labelStatus(design.currentRevision.verificationStatus)}` : "Created with the new design"}</small></div>
        {!recordId ? <label>Initial version<input required maxLength={40} value={fields.version} onChange={(event) => setField("version", event.target.value)} /></label> : null}
        {design?.currentRevision?.id ? <Link href={`/lab?revisionId=${encodeURIComponent(design.currentRevision.id)}`}>Commission paid verification →</Link> : null}
      </div>

      <label className={styles.filePicker}>
        <strong>Attach files to the current revision</strong>
        <span>Up to 50 MiB each. New uploads stay private until you explicitly change their visibility.</span>
        <input multiple type="file" onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} />
      </label>
      {selectedFiles.length ? <ul className={styles.selectedFiles}>{selectedFiles.map((file, index) => <li key={`${file.name}-${file.size}-${index}`}>{file.name}<span>{formatBytes(file.size)}</span></li>)}</ul> : null}

      {storedFiles.length ? (
        <section className={styles.storedFiles} aria-labelledby="stored-files-title">
          <h3 id="stored-files-title">Current revision files</h3>
          <ul>{storedFiles.map((file) => (
            <li key={file.id}>
              <div><strong>{file.originalName}</strong><span>{labelStatus(file.kind)} · {formatBytes(file.byteSize)}</span></div>
              <b>{file.visibility}</b>
              <a href={`/api/files/${encodeURIComponent(file.id)}`}>Download</a>
              <button type="button" disabled={fileBusyId === file.id} onClick={() => void changeVisibility(file)}>{fileBusyId === file.id ? "Updating…" : file.visibility === "public" ? "Make private" : "Make public"}</button>
            </li>
          ))}</ul>
        </section>
      ) : design?.currentRevision ? <p className={styles.inlineEmpty}>No files are attached to the current revision.</p> : null}

      <footer className={styles.formActions}>
        <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Saving…" : recordId ? "Save changes" : "Create private draft"}</button>
        {recordId && design?.publicationStatus !== "published" ? <button className={styles.publishButton} type="button" disabled={saving} onClick={() => void persist("published")}>Publish design</button> : null}
        {recordId && design?.publicationStatus === "published" ? <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => void persist("draft")}>Return to draft</button> : null}
        {recordId && design?.publicationStatus !== "archived" ? <button className={styles.archiveButton} type="button" disabled={saving} onClick={() => void persist("archived")}>Archive</button> : null}
        {recordId && design?.publicationStatus === "archived" ? <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => void persist("draft")}>Restore as draft</button> : null}
      </footer>
      {design ? <p className={styles.recordNote}>Stored price: {formatMoney(design.priceCents)} · Design ID {design.id}</p> : null}
    </form>
  );
}

function inferFileKind(name: string): string {
  const lower = name.toLowerCase();
  if (/\.(gbr|ger|pho|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp|gm\d)$/i.test(lower)) return "gerber";
  if (/\.(drl|xln|drd)$/i.test(lower)) return "drill";
  if (/bom|bill[-_ ]?of[-_ ]?materials/i.test(lower)) return "bom";
  if (/pick[-_ ]?and[-_ ]?place|position|centroid/i.test(lower)) return "pick_and_place";
  if (/\.(kicad_sch|sch|dsn)$/i.test(lower)) return "schematic";
  if (/\.(hex|bin|uf2|elf)$/i.test(lower)) return "firmware";
  if (/\.(zip|tar|tgz|gz|7z)$/i.test(lower)) return "archive";
  if (/\.(png|jpe?g|webp|svg)$/i.test(lower)) return "render";
  return "source";
}
