"use client";

import { type FormEvent, useState } from "react";
import { CheckCircle2, CircleAlert, FileArchive, LoaderCircle, UploadCloud } from "lucide-react";

type SaveResult = {
  tone: "success" | "warning" | "error";
  message: string;
  revisionId?: string;
  authenticationRequired?: boolean;
};

export function SellForm() {
  const [result, setResult] = useState<SaveResult | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const price = Number(form.get("price") ?? 0);

    try {
      const response = await fetch("/api/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: formText(form, "title"),
          category: formText(form, "category"),
          summary: formText(form, "summary"),
          license: formText(form, "license"),
          description: formText(form, "description"),
          priceCents: Number.isFinite(price) ? Math.round(price * 100) : 0,
          version: "1.0.0",
        }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        setResult({
          tone: "error",
          message: apiMessage(payload, "Unable to save this design draft."),
          authenticationRequired: response.status === 401,
        });
        return;
      }

      const revisionId = nestedString(payload, "revision", "id");
      if (!revisionId) throw new Error("The draft was created without a revision ID.");

      const failedUploads: string[] = [];
      let uploadedCount = 0;
      for (const file of files) {
        const upload = new FormData();
        upload.set("revisionId", revisionId);
        upload.set("kind", inferFileKind(file.name));
        upload.set("visibility", "private");
        upload.set("file", file, file.name);
        const uploadResponse = await fetch("/api/files", {
          method: "POST",
          body: upload,
        });
        if (uploadResponse.ok) uploadedCount += 1;
        else failedUploads.push(file.name);
      }

      if (failedUploads.length) {
        setResult({
          tone: "warning",
          revisionId,
          message: `Draft saved and ${uploadedCount} of ${files.length} files uploaded. Retry these files later: ${failedUploads.join(", ")}.`,
        });
      } else {
        setResult({
          tone: "success",
          revisionId,
          message: files.length
            ? `Draft saved with ${uploadedCount} private ${uploadedCount === 1 ? "file" : "files"}. Add release notes and publish when ready.`
            : "Draft saved. Add manufacturing files before publishing the revision.",
        });
      }
    } catch (error) {
      setResult({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to save this design draft.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="publish-form" onSubmit={submit}>
      <div className="form-grid"><label>Design title<input name="title" required placeholder="3 kW GaN LLC converter" /></label><label>Category<select name="category"><option>Power converter</option><option>Motor control</option><option>Test fixture</option><option>RF / microwave</option><option>Instrumentation</option></select></label></div>
      <label>One-line summary<input name="summary" required placeholder="300–420 VDC to 48 V, 97.8% peak efficiency" /></label>
      <div className="form-grid"><label>License<select name="license"><option>CERN-OHL-S-2.0</option><option>CERN-OHL-W-2.0</option><option>Proprietary commercial license</option><option>CC BY-SA 4.0 documentation</option></select></label><label>Digital license price<input name="price" type="number" min="0" step="1" defaultValue="79" /></label></div>
      <label>Operating limits and description<textarea name="description" required rows={6} placeholder="State switching frequency, cooling assumptions, isolation, protections, known limits, and required test equipment." /></label>
      <label className="drop-field"><UploadCloud size={26} /><b>Gerber, project source, BOM, firmware, simulation, and evidence</b><span>ZIP or individual files · private until you publish</span><input multiple type="file" onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
      {files.length ? <div className="selected-files">{files.map((file, index) => <span key={`${file.name}-${file.size}-${index}`}><FileArchive size={14} />{file.name}</span>)}</div> : null}
      <label className="check-row"><input name="revisionLocked" type="checkbox" required /><span>I confirm this is an immutable release revision. Any source change will create a new revision and invalidate inherited verification.</span></label>
      <button className="button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : null}{saving ? "Saving and uploading…" : "Save design draft"} <span>→</span></button>
      {result ? (
        <p className="inline-notice" data-state={result.tone} role={result.tone === "error" ? "alert" : "status"}>
          {result.tone === "success" ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
          <span>{result.message}</span>
          {result.authenticationRequired ? <a href="/signin-with-chatgpt?return_to=%2Fsell">Sign in to save</a> : null}
          {result.revisionId ? <a href={`/lab?revisionId=${encodeURIComponent(result.revisionId)}`}>Commission verification for this revision</a> : null}
        </p>
      ) : null}
    </form>
  );
}

function formText(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
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

function apiMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function nestedString(payload: unknown, parent: string, key: string): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const nested = (payload as Record<string, unknown>)[parent];
  if (!nested || typeof nested !== "object") return undefined;
  const value = (nested as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : undefined;
}
