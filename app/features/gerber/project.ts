import JSZip from "jszip";

export type BoardSide = "top" | "bottom";
export type ViewerMode = "local" | "reference";
export type RenderState = "idle" | "rendering";
export type IngestState = "idle" | "reading";
export type LayerKind =
  | "copper"
  | "soldermask"
  | "silkscreen"
  | "solderpaste"
  | "drill"
  | "outline"
  | "drawing"
  | "unknown";
export type LayerSide = BoardSide | "inner" | "all" | "unknown";

export interface GerberLayer {
  id: string;
  filename: string;
  displayName: string;
  data: string;
  sourceName: string;
  bytes: number;
  kind: LayerKind;
  side: LayerSide;
  enabled: boolean;
}

export interface LayerSummary {
  id: string;
  displayName: string;
  kind: LayerKind;
  side: LayerSide;
  enabled: boolean;
}

export interface RenderedSide {
  svg: string;
  width: number;
  height: number;
  units: "in" | "mm";
}

export interface RenderedBoard {
  top: RenderedSide;
  bottom: RenderedSide;
}

export interface ExtractedProject {
  layers: GerberLayer[];
  warnings: string[];
  label: string;
}

export interface BrowserStackupInput {
  filename: string;
  gerber: string;
  externalId: string;
  type?: Exclude<LayerKind, "drawing" | "unknown">;
  side?: Exclude<LayerSide, "unknown">;
}

export interface BrowserStackupSide {
  svg: string;
  width: number;
  height: number;
  units: "in" | "mm";
}

export interface BrowserStackupResult {
  top: BrowserStackupSide;
  bottom: BrowserStackupSide;
}

export interface BrowserStackupOptions {
  id: string;
  outlineGapFill: number;
  useOutline: boolean;
  color: Record<string, string>;
  attributes: Record<string, unknown>;
}

export type BrowserPcbStackup = (layers: BrowserStackupInput[], options: BrowserStackupOptions) => Promise<BrowserStackupResult>;

declare global {
  interface Window {
    pcbStackup?: BrowserPcbStackup;
  }
}

export const MAX_ARCHIVE_BYTES = 40 * 1024 * 1024;
export const MAX_LAYER_BYTES = 16 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 100 * 1024 * 1024;
export const MAX_LAYER_COUNT = 96;
export const DEMO_WIDTH_MM = 98.4;
export const DEMO_HEIGHT_MM = 64;
export const UCAMCO_VIEWER_URL = "https://gerber.ucamco.com";
export const PCB_STACKUP_SCRIPT_URL = "/vendor/pcb-stackup-4.2.8.min.js";
let pcbStackupLoader: Promise<BrowserPcbStackup> | null = null;

export function loadPcbStackup(): Promise<BrowserPcbStackup> {
  if (typeof window === "undefined") return Promise.reject(new Error("The local renderer is only available in a browser."));
  if (window.pcbStackup) return Promise.resolve(window.pcbStackup);
  if (pcbStackupLoader) return pcbStackupLoader;

  pcbStackupLoader = new Promise<BrowserPcbStackup>((resolve, reject) => {
    const selector = 'script[data-trace-pcb-stackup="4.2.8"]';
    const existingScript = document.querySelector<HTMLScriptElement>(selector);
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => {
      if (window.pcbStackup) {
        resolve(window.pcbStackup);
      } else {
        pcbStackupLoader = null;
        script.remove();
        reject(new Error("The local Gerber renderer loaded without its browser API."));
      }
    };
    const handleError = () => {
      pcbStackupLoader = null;
      script.remove();
      reject(new Error("The local Gerber renderer could not be loaded."));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existingScript) {
      script.src = PCB_STACKUP_SCRIPT_URL;
      script.async = true;
      script.dataset.tracePcbStackup = "4.2.8";
      document.head.appendChild(script);
    }
  });
  return pcbStackupLoader;
}

export const INPUT_ACCEPT = [
  ".zip",
  ".gbr",
  ".ger",
  ".gtl",
  ".gbl",
  ".gto",
  ".gbo",
  ".gts",
  ".gbs",
  ".gtp",
  ".gbp",
  ".gko",
  ".gml",
  ".drl",
  ".xln",
  ".exc",
  ".txt",
  ".cnc",
  "application/zip",
].join(",");

export const LAYER_COLORS: Record<LayerKind, string> = {
  copper: "#dfa33b",
  soldermask: "#16805e",
  silkscreen: "#eef1e9",
  solderpaste: "#aeb7af",
  drill: "#78aee8",
  outline: "#ec7650",
  drawing: "#a78bda",
  unknown: "#77817a",
};

export const LAYER_LABELS: Record<LayerKind, string> = {
  copper: "Copper",
  soldermask: "Solder mask",
  silkscreen: "Silkscreen",
  solderpaste: "Paste",
  drill: "Drill",
  outline: "Board outline",
  drawing: "Drawing",
  unknown: "Unclassified",
};

export const DEMO_LAYERS: readonly LayerSummary[] = [
  { id: "demo-silk", displayName: "PowerStage-F.Silkscreen.gto", kind: "silkscreen", side: "top", enabled: true },
  { id: "demo-mask", displayName: "PowerStage-F.Mask.gts", kind: "soldermask", side: "top", enabled: true },
  { id: "demo-copper", displayName: "PowerStage-F.Cu.gtl", kind: "copper", side: "top", enabled: true },
  { id: "demo-bottom", displayName: "PowerStage-B.Cu.gbl", kind: "copper", side: "bottom", enabled: true },
  { id: "demo-drill", displayName: "PowerStage-PTH.drl", kind: "drill", side: "all", enabled: true },
  { id: "demo-outline", displayName: "PowerStage-Edge.Cuts.gm1", kind: "outline", side: "all", enabled: true },
];

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function extensionOf(filename: string): string {
  const cleanName = basename(filename).toLowerCase();
  const dot = cleanName.lastIndexOf(".");
  return dot >= 0 ? cleanName.slice(dot + 1) : "";
}

export function isZip(filename: string): boolean {
  return extensionOf(filename) === "zip";
}

export function isSupportedFabricationFile(filename: string): boolean {
  const cleanName = basename(filename).toLowerCase();
  if (!cleanName || cleanName.startsWith(".") || /(?:^|[._-])(?:gpi|dri)$/.test(cleanName)) return false;

  const extension = extensionOf(cleanName);
  return /^(?:gbr|ger|gbx|pho|art|gtl|gbl|gto|gbo|gts|gbs|gtp|gbp|gko|gml|gm\d+|g\d+|gp\d+|drl|xln|exc|drd|tap|npt|cnc|dim|mil|cmp|sol|plc|pls|stc|sts|crc|crs|tsk|bsk|tsm|bsm|smt|smb|sst|ssb|spt|spb|top|bot|fab|txt)$/.test(
    extension,
  );
}

export function classifyLayer(filename: string): { kind: LayerKind; side: LayerSide } {
  const name = basename(filename).toLowerCase();
  const extension = extensionOf(name);
  const top = /(?:^|[._ -])(?:f|front|top)(?:[._ -]|$)/.test(name) || /^(?:gtl|gto|gts|gtp|cmp|plc|stc|crc|tsk|tsm|smt|sst|spt|top)$/.test(extension);
  const bottom = /(?:^|[._ -])(?:b|back|bottom)(?:[._ -]|$)/.test(name) || /^(?:gbl|gbo|gbs|gbp|sol|pls|sts|crs|bsk|bsm|smb|ssb|spb|bot)$/.test(extension);
  const inner = /(?:inner|internal|in\d+|(?:^|[._-])g?p?\d+(?:[._-]|$))/.test(name);
  const inferredSide: LayerSide = top ? "top" : bottom ? "bottom" : inner ? "inner" : "unknown";

  if (/^(?:gko|gml|gm\d+|dim|mil)$/.test(extension) || /(?:edge[._ -]?cuts|board[._ -]?outline|outline|profile)/.test(name)) {
    return { kind: "outline", side: "all" };
  }
  if (/^(?:drl|xln|exc|drd|tap|npt|cnc|txt)$/.test(extension) || /(?:drill|npth|pth|excellon)/.test(name)) {
    return { kind: "drill", side: "all" };
  }
  if (/^(?:gts|gbs|stc|sts|tsm|bsm|smt|smb)$/.test(extension) || /(?:solder[._ -]?mask|[fb][._ -]?mask)/.test(name)) {
    return { kind: "soldermask", side: inferredSide };
  }
  if (/^(?:gto|gbo|plc|pls|tsk|bsk|sst|ssb)$/.test(extension) || /(?:silk|legend)/.test(name)) {
    return { kind: "silkscreen", side: inferredSide };
  }
  if (/^(?:gtp|gbp|crc|crs|spt|spb)$/.test(extension) || /(?:paste|cream)/.test(name)) {
    return { kind: "solderpaste", side: inferredSide };
  }
  if (/^(?:gtl|gbl|cmp|sol|top|bot|g\d+|gp\d+)$/.test(extension) || /(?:copper|[fb][._ -]?cu|inner\d*)/.test(name)) {
    return { kind: "copper", side: inferredSide };
  }
  if (/^(?:gbr|ger|gbx|pho|art|fab)$/.test(extension)) {
    return { kind: "drawing", side: inferredSide };
  }
  return { kind: "unknown", side: inferredSide };
}

export function makeLayerId(source: string, filename: string, index: number): string {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${index}`;
  return `${source}:${filename}:${uuid}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDimension(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value >= 100 ? value.toFixed(1) : value.toFixed(2);
}

export function toMillimeters(value: number, units: "in" | "mm"): number {
  return units === "in" ? value * 25.4 : value;
}

export function countDrillHits(layers: readonly GerberLayer[]): number {
  return layers
    .filter((layer) => layer.kind === "drill")
    .reduce((total, layer) => {
      const coordinateLines = layer.data.match(/^\s*(?:X[-+]?\d+Y[-+]?\d+|Y[-+]?\d+X[-+]?\d+)(?:D0?3)?\*?\s*$/gim);
      const slots = layer.data.match(/G85/gi);
      return total + (coordinateLines?.length ?? 0) + (slots?.length ?? 0);
    }, 0);
}

export function sanitizeSvg(svg: string): string {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error("The generated board SVG could not be decoded.");

  documentNode.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());
  documentNode.querySelectorAll("*").forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on")) node.removeAttribute(attribute.name);
      if ((name === "href" || name === "xlink:href") && value && !value.startsWith("#")) node.removeAttribute(attribute.name);
      if ((name === "style" || name === "fill" || name === "stroke") && /(?:javascript:|data:text\/html)/.test(value)) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  documentNode.documentElement.setAttribute("focusable", "false");
  documentNode.documentElement.setAttribute("aria-hidden", "true");
  return new XMLSerializer().serializeToString(documentNode.documentElement);
}

export async function extractProject(files: readonly File[]): Promise<ExtractedProject> {
  const layers: GerberLayer[] = [];
  const warnings: string[] = [];
  let expandedBytes = 0;
  let supportedSourceCount = 0;

  const addLayer = (filename: string, data: string, sourceName: string, knownBytes?: number) => {
    if (layers.length >= MAX_LAYER_COUNT) {
      if (!warnings.some((warning) => warning.includes("layer limit"))) {
        warnings.push(`The ${MAX_LAYER_COUNT}-layer limit was reached; remaining files were skipped.`);
      }
      return;
    }

    const bytes = knownBytes ?? data.length;
    if (!data.trim()) {
      warnings.push(`${basename(filename)} is empty and was skipped.`);
      return;
    }
    if (bytes > MAX_LAYER_BYTES) {
      warnings.push(`${basename(filename)} is larger than ${formatBytes(MAX_LAYER_BYTES)} and was skipped.`);
      return;
    }
    if (expandedBytes + bytes > MAX_PROJECT_BYTES) {
      warnings.push(`The expanded project exceeded ${formatBytes(MAX_PROJECT_BYTES)}; remaining files were skipped.`);
      return;
    }

    const classification = classifyLayer(filename);
    expandedBytes += bytes;
    layers.push({
      id: makeLayerId(sourceName, filename, layers.length),
      filename,
      displayName: basename(filename),
      data,
      sourceName,
      bytes,
      kind: classification.kind,
      side: classification.side,
      enabled: true,
    });
  };

  for (const file of files) {
    if (isZip(file.name)) {
      supportedSourceCount += 1;
      if (file.size > MAX_ARCHIVE_BYTES) {
        warnings.push(`${file.name} is larger than ${formatBytes(MAX_ARCHIVE_BYTES)} and was skipped.`);
        continue;
      }

      let archive: JSZip;
      try {
        archive = await JSZip.loadAsync(file);
      } catch {
        warnings.push(`${file.name} is not a readable ZIP archive.`);
        continue;
      }

      const entries = Object.values(archive.files).filter(
        (entry) => !entry.dir && !/(?:^|\/)__MACOSX(?:\/|$)/i.test(entry.name) && isSupportedFabricationFile(entry.name),
      );
      if (Object.keys(archive.files).length > 2000) {
        warnings.push(`${file.name} contains too many entries and was skipped.`);
        continue;
      }
      if (!entries.length) warnings.push(`${file.name} did not contain recognized Gerber or Excellon files.`);

      for (const entry of entries) {
        if (layers.length >= MAX_LAYER_COUNT || expandedBytes >= MAX_PROJECT_BYTES) break;
        try {
          const { data, bytes } = await readZipEntry(entry, Math.min(MAX_LAYER_BYTES, MAX_PROJECT_BYTES - expandedBytes));
          addLayer(entry.name, data, file.name, bytes);
        } catch {
          warnings.push(`${basename(entry.name)} could not be extracted from ${file.name}.`);
        }
      }
      continue;
    }

    if (!isSupportedFabricationFile(file.name)) {
      warnings.push(`${file.name} is not a supported fabrication layer and was skipped.`);
      continue;
    }
    supportedSourceCount += 1;
    if (file.size > MAX_LAYER_BYTES) {
      warnings.push(`${file.name} is larger than ${formatBytes(MAX_LAYER_BYTES)} and was skipped.`);
      continue;
    }
    try {
      addLayer(file.name, await file.text(), file.name, file.size);
    } catch {
      warnings.push(`${file.name} could not be read.`);
    }
  }

  if (!layers.length) {
    const reason = supportedSourceCount ? "No renderable layers were found in the selected files." : "Choose a ZIP or Gerber/Excellon fabrication file.";
    throw new Error(reason);
  }

  const hasOutline = layers.some((layer) => layer.kind === "outline");
  const hasCopper = layers.some((layer) => layer.kind === "copper");
  const ambiguousLayers = layers.filter((layer) => layer.kind === "drawing" || layer.kind === "unknown");
  if (!hasOutline) warnings.push("No board outline was recognized; the renderer will fit the visible artwork bounds.");
  if (!hasCopper) warnings.push("No copper layer was recognized. Check the filenames if the preview looks incomplete.");
  if (ambiguousLayers.length) {
    const sample = ambiguousLayers.slice(0, 2).map((layer) => layer.displayName).join(", ");
    warnings.push(`${ambiguousLayers.length} layer${ambiguousLayers.length === 1 ? "" : "s"} could not be classified with confidence (${sample}).`);
  }

  const label = files.length === 1 ? files[0].name.replace(/\.zip$/i, "") : `${files.length} fabrication sources`;
  return { layers, warnings, label };
}

export function sideLabel(side: LayerSide): string {
  if (side === "all") return "All sides";
  if (side === "inner") return "Inner";
  if (side === "unknown") return "Unassigned";
  return side === "top" ? "Top" : "Bottom";
}


/** Stop decompression as soon as expanded output reaches the configured bound. */
export function readZipEntry(entry: JSZip.JSZipObject, limit: number): Promise<{ data: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const parts: string[] = [];
    const decoder = new TextDecoder();
    // JSZip 3.10 exposes internalStream publicly but omits it from JSZipObject types.
    const stream = (entry as JSZip.JSZipObject & { internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array> }).internalStream("uint8array");
    stream.on("data", (chunk: Uint8Array) => {
      bytes += chunk.byteLength;
      if (bytes > limit) {
        stream.pause();
        reject(new Error("Expanded ZIP entry exceeds the size limit."));
        return;
      }
      parts.push(decoder.decode(chunk, { stream: true }));
    });
    stream.on("error", reject);
    stream.on("end", () => resolve({ data: parts.join("") + decoder.decode(), bytes }));
    stream.resume();
  });
}
