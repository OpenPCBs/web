"use client";

import JSZip from "jszip";
import {
  CheckCircle2,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  FileArchive,
  FlipHorizontal2,
  Layers3,
  LoaderCircle,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
} from "react";

type BoardSide = "top" | "bottom";
type ViewerMode = "local" | "reference";
type RenderState = "idle" | "rendering";
type IngestState = "idle" | "reading";
type LayerKind =
  | "copper"
  | "soldermask"
  | "silkscreen"
  | "solderpaste"
  | "drill"
  | "outline"
  | "drawing"
  | "unknown";
type LayerSide = BoardSide | "inner" | "all" | "unknown";

interface GerberLayer {
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

interface LayerSummary {
  id: string;
  displayName: string;
  kind: LayerKind;
  side: LayerSide;
  enabled: boolean;
}

interface RenderedSide {
  svg: string;
  width: number;
  height: number;
  units: "in" | "mm";
}

interface RenderedBoard {
  top: RenderedSide;
  bottom: RenderedSide;
}

interface ExtractedProject {
  layers: GerberLayer[];
  warnings: string[];
  label: string;
}

interface BrowserStackupInput {
  filename: string;
  gerber: string;
  externalId: string;
  type?: Exclude<LayerKind, "drawing" | "unknown">;
  side?: Exclude<LayerSide, "unknown">;
}

interface BrowserStackupSide {
  svg: string;
  width: number;
  height: number;
  units: "in" | "mm";
}

interface BrowserStackupResult {
  top: BrowserStackupSide;
  bottom: BrowserStackupSide;
}

interface BrowserStackupOptions {
  id: string;
  outlineGapFill: number;
  useOutline: boolean;
  color: Record<string, string>;
  attributes: Record<string, unknown>;
}

type BrowserPcbStackup = (layers: BrowserStackupInput[], options: BrowserStackupOptions) => Promise<BrowserStackupResult>;

declare global {
  interface Window {
    pcbStackup?: BrowserPcbStackup;
  }
}

const MAX_ARCHIVE_BYTES = 40 * 1024 * 1024;
const MAX_LAYER_BYTES = 16 * 1024 * 1024;
const MAX_PROJECT_BYTES = 100 * 1024 * 1024;
const MAX_LAYER_COUNT = 96;
const DEMO_WIDTH_MM = 98.4;
const DEMO_HEIGHT_MM = 64;
const UCAMCO_VIEWER_URL = "https://gerber.ucamco.com";
const PCB_STACKUP_SCRIPT_URL = "/vendor/pcb-stackup-4.2.8.min.js";
let pcbStackupLoader: Promise<BrowserPcbStackup> | null = null;

function loadPcbStackup(): Promise<BrowserPcbStackup> {
  if (typeof window === "undefined") return Promise.reject(new Error("The local renderer is only available in a browser."));
  if (window.pcbStackup) return Promise.resolve(window.pcbStackup);
  if (pcbStackupLoader) return pcbStackupLoader;

  pcbStackupLoader = new Promise<BrowserPcbStackup>((resolve, reject) => {
    const selector = 'script[data-tw-pcb-stackup="4.2.8"]';
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
      script.dataset.twPcbStackup = "4.2.8";
      document.head.appendChild(script);
    }
  });
  return pcbStackupLoader;
}

const INPUT_ACCEPT = [
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

const LAYER_COLORS: Record<LayerKind, string> = {
  copper: "#dfa33b",
  soldermask: "#16805e",
  silkscreen: "#eef1e9",
  solderpaste: "#aeb7af",
  drill: "#78aee8",
  outline: "#ec7650",
  drawing: "#a78bda",
  unknown: "#77817a",
};

const LAYER_LABELS: Record<LayerKind, string> = {
  copper: "Copper",
  soldermask: "Solder mask",
  silkscreen: "Silkscreen",
  solderpaste: "Paste",
  drill: "Drill",
  outline: "Board outline",
  drawing: "Drawing",
  unknown: "Unclassified",
};

const DEMO_LAYERS: readonly LayerSummary[] = [
  { id: "demo-silk", displayName: "PowerStage-F.Silkscreen.gto", kind: "silkscreen", side: "top", enabled: true },
  { id: "demo-mask", displayName: "PowerStage-F.Mask.gts", kind: "soldermask", side: "top", enabled: true },
  { id: "demo-copper", displayName: "PowerStage-F.Cu.gtl", kind: "copper", side: "top", enabled: true },
  { id: "demo-bottom", displayName: "PowerStage-B.Cu.gbl", kind: "copper", side: "bottom", enabled: true },
  { id: "demo-drill", displayName: "PowerStage-PTH.drl", kind: "drill", side: "all", enabled: true },
  { id: "demo-outline", displayName: "PowerStage-Edge.Cuts.gm1", kind: "outline", side: "all", enabled: true },
];

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function extensionOf(filename: string): string {
  const cleanName = basename(filename).toLowerCase();
  const dot = cleanName.lastIndexOf(".");
  return dot >= 0 ? cleanName.slice(dot + 1) : "";
}

function isZip(filename: string): boolean {
  return extensionOf(filename) === "zip";
}

function isSupportedFabricationFile(filename: string): boolean {
  const cleanName = basename(filename).toLowerCase();
  if (!cleanName || cleanName.startsWith(".") || /(?:^|[._-])(?:gpi|dri)$/.test(cleanName)) return false;

  const extension = extensionOf(cleanName);
  return /^(?:gbr|ger|gbx|pho|art|gtl|gbl|gto|gbo|gts|gbs|gtp|gbp|gko|gml|gm\d+|g\d+|gp\d+|drl|xln|exc|drd|tap|npt|cnc|dim|mil|cmp|sol|plc|pls|stc|sts|crc|crs|tsk|bsk|tsm|bsm|smt|smb|sst|ssb|spt|spb|top|bot|fab|txt)$/.test(
    extension,
  );
}

function classifyLayer(filename: string): { kind: LayerKind; side: LayerSide } {
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

function makeLayerId(source: string, filename: string, index: number): string {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${index}`;
  return `${source}:${filename}:${uuid}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDimension(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value >= 100 ? value.toFixed(1) : value.toFixed(2);
}

function toMillimeters(value: number, units: "in" | "mm"): number {
  return units === "in" ? value * 25.4 : value;
}

function countDrillHits(layers: readonly GerberLayer[]): number {
  return layers
    .filter((layer) => layer.kind === "drill")
    .reduce((total, layer) => {
      const coordinateLines = layer.data.match(/^\s*(?:X[-+]?\d+Y[-+]?\d+|Y[-+]?\d+X[-+]?\d+)(?:D0?3)?\*?\s*$/gim);
      const slots = layer.data.match(/G85/gi);
      return total + (coordinateLines?.length ?? 0) + (slots?.length ?? 0);
    }, 0);
}

function sanitizeSvg(svg: string): string {
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

async function extractProject(files: readonly File[]): Promise<ExtractedProject> {
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
      if (!entries.length) warnings.push(`${file.name} did not contain recognized Gerber or Excellon files.`);

      for (const entry of entries) {
        if (layers.length >= MAX_LAYER_COUNT || expandedBytes >= MAX_PROJECT_BYTES) break;
        try {
          const data = await entry.async("string");
          addLayer(entry.name, data, file.name);
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

function DemoBoard({ side, visibility }: { side: BoardSide; visibility: Readonly<Record<string, boolean>> }) {
  const id = useId().replace(/:/g, "");
  const clipId = `gw-demo-clip-${id}`;
  const shadowId = `gw-demo-shadow-${id}`;
  const boardGradientId = `gw-demo-board-${id}`;
  const copperGradientId = `gw-demo-copper-${id}`;
  const faceTransform = side === "bottom" ? "translate(760 0) scale(-1 1)" : undefined;
  const holes = Array.from({ length: 30 }, (_, index) => ({
    x: 143 + (index % 10) * 51 + (index % 2) * 8,
    y: 105 + Math.floor(index / 10) * 127,
    r: index % 7 === 0 ? 8 : 5,
  }));

  return (
    <svg className="gw-demo-board" viewBox="0 0 760 470" role="img" aria-labelledby={`gw-demo-title-${id}`}>
      <title id={`gw-demo-title-${id}`}>Interactive demonstration circuit board, {side} side</title>
      <defs>
        <clipPath id={clipId}>
          <path d="M103 52h525c22 0 40 18 40 40v283c0 22-18 40-40 40H103c-22 0-40-18-40-40V92c0-22 18-40 40-40Z" />
        </clipPath>
        <filter id={shadowId} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#020806" floodOpacity=".38" />
        </filter>
        <linearGradient id={boardGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#127657" />
          <stop offset=".52" stopColor="#095c45" />
          <stop offset="1" stopColor="#073f32" />
        </linearGradient>
        <linearGradient id={copperGradientId} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#f4cb76" />
          <stop offset=".48" stopColor="#c98a30" />
          <stop offset="1" stopColor="#f0bd5d" />
        </linearGradient>
      </defs>
      <g transform={faceTransform}>
        <path
          d="M103 52h525c22 0 40 18 40 40v283c0 22-18 40-40 40H103c-22 0-40-18-40-40V92c0-22 18-40 40-40Z"
          fill="#031d17"
          filter={`url(#${shadowId})`}
          transform="translate(0 8)"
        />
        <g clipPath={`url(#${clipId})`}>
          {visibility["demo-mask"] ? (
            <path d="M45 34h642v399H45z" fill={`url(#${boardGradientId})`} />
          ) : (
            <path d="M45 34h642v399H45z" fill="#a66e2b" />
          )}
          {visibility["demo-bottom"] && side === "bottom" ? (
            <g fill="none" stroke="#b8752d" strokeWidth="12" opacity=".68">
              <path d="M105 116h97l54 54h134l83-83h164" />
              <path d="M92 357h181l77-77h129l98 98h92" />
              <path d="M153 227h112l45 45h223l71-71" />
            </g>
          ) : null}
          {visibility["demo-copper"] && side === "top" ? (
            <g fill="none" stroke={`url(#${copperGradientId})`} strokeLinecap="round" strokeLinejoin="round">
              <path d="M98 119h118l46 46h117l63-63h189" strokeWidth="10" />
              <path d="M104 343h122l57-57h118l77 77h158" strokeWidth="12" />
              <path d="M124 235h99l44-44h87l58 58h189" strokeWidth="7" />
              <path d="M302 88v54m80 151v72M534 91v65M185 286v76" strokeWidth="6" />
              <path d="M108 178h78l34 34m267 75 38 38h107" strokeWidth="4" opacity=".8" />
            </g>
          ) : null}
          {visibility["demo-copper"] ? (
            <g fill="#e1aa48" opacity=".94">
              {holes.map((hole, index) => (
                <circle key={`pad-${index}`} cx={hole.x} cy={hole.y} r={hole.r + 5} />
              ))}
            </g>
          ) : null}
          {visibility["demo-drill"] ? (
            <g fill="#061c17" stroke="#f1c067" strokeWidth="2">
              {holes.map((hole, index) => (
                <circle key={`hole-${index}`} cx={hole.x} cy={hole.y} r={hole.r} />
              ))}
              <circle cx="106" cy="91" r="14" />
              <circle cx="625" cy="91" r="14" />
              <circle cx="106" cy="376" r="14" />
              <circle cx="625" cy="376" r="14" />
            </g>
          ) : null}
          <g>
            <rect x="292" y="177" width="134" height="105" rx="9" fill="#101613" stroke="#657068" strokeWidth="2" />
            <rect x="131" y="151" width="68" height="51" rx="5" fill="#151b17" stroke="#657068" />
            <rect x="518" y="235" width="76" height="58" rx="5" fill="#151b17" stroke="#657068" />
            <g fill="#c4b48c">
              {Array.from({ length: 7 }, (_, index) => (
                <g key={index}>
                  <rect x={300 + index * 18} y="166" width="7" height="13" />
                  <rect x={300 + index * 18} y="281" width="7" height="13" />
                </g>
              ))}
            </g>
          </g>
          {visibility["demo-silk"] ? (
            <g fill="none" stroke="#eef1e7" strokeWidth="2" opacity=".9">
              <path d="M278 161h162v137H278z" />
              <path d="M118 139h95v77h-95zM505 220h102v88H505z" />
              <path d="M82 118v-28h74M579 390h67v-42" />
              <text x="91" y="332" fill="#eef1e7" stroke="none" fontFamily="ui-monospace, monospace" fontSize="13" letterSpacing="2">
                THEVENIN WORKS / POWER STAGE R1.4
              </text>
              <text x="318" y="231" fill="#d8ded6" stroke="none" fontFamily="ui-monospace, monospace" fontSize="12">
                GAN CTRL
              </text>
            </g>
          ) : null}
        </g>
        {visibility["demo-outline"] ? (
          <path
            d="M103 52h525c22 0 40 18 40 40v283c0 22-18 40-40 40H103c-22 0-40-18-40-40V92c0-22 18-40 40-40Z"
            fill="none"
            stroke="#6ed0a8"
            strokeWidth="3"
          />
        ) : null}
      </g>
    </svg>
  );
}

function sideLabel(side: LayerSide): string {
  if (side === "all") return "All sides";
  if (side === "inner") return "Inner";
  if (side === "unknown") return "Unassigned";
  return side === "top" ? "Top" : "Bottom";
}

export default function GerberWorkbench() {
  const inputRef = useRef<HTMLInputElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const renderSequence = useRef(0);
  const ingestSequence = useRef(0);
  const [mode, setMode] = useState<ViewerMode>("local");
  const [side, setSide] = useState<BoardSide>("top");
  const [layers, setLayers] = useState<GerberLayer[]>([]);
  const [projectLabel, setProjectLabel] = useState("POWER_STAGE_R1 · DEMO");
  const [demoVisibility, setDemoVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEMO_LAYERS.map((layer) => [layer.id, true])),
  );
  const [rendered, setRendered] = useState<RenderedBoard | null>(null);
  const [renderState, setRenderState] = useState<RenderState>("idle");
  const [ingestState, setIngestState] = useState<IngestState>("idle");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [mirrored, setMirrored] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const hasUpload = layers.length > 0;
  const working = renderState === "rendering" || ingestState === "reading";
  const currentRenderedSide = rendered?.[side] ?? null;
  const boardWidthMm = currentRenderedSide ? toMillimeters(currentRenderedSide.width, currentRenderedSide.units) : DEMO_WIDTH_MM;
  const boardHeightMm = currentRenderedSide ? toMillimeters(currentRenderedSide.height, currentRenderedSide.units) : DEMO_HEIGHT_MM;
  const drillHits = hasUpload ? countDrillHits(layers) : 226;
  const visibleLayerCount = hasUpload
    ? layers.filter((layer) => layer.enabled).length
    : DEMO_LAYERS.filter((layer) => demoVisibility[layer.id]).length;
  const totalLayerCount = hasUpload ? layers.length : DEMO_LAYERS.length;
  const allWarnings = useMemo(
    () => (renderError ? [...fileWarnings, renderError] : fileWarnings),
    [fileWarnings, renderError],
  );
  const layerSummaries: readonly LayerSummary[] = hasUpload
    ? layers.map(({ id, displayName, kind, side: layerSide, enabled }) => ({ id, displayName, kind, side: layerSide, enabled }))
    : DEMO_LAYERS.map((layer) => ({ ...layer, enabled: demoVisibility[layer.id] }));

  useEffect(() => {
    if (window.matchMedia("(min-width: 961px)").matches) setLayersOpen(true);
  }, []);

  useEffect(() => {
    if (!layers.length) {
      renderSequence.current += 1;
      setRendered(null);
      setRenderState("idle");
      setRenderError(null);
      return;
    }

    const activeLayers = layers.filter((layer) => layer.enabled);
    if (!activeLayers.length) {
      renderSequence.current += 1;
      setRendered(null);
      setRenderState("idle");
      setRenderError(null);
      return;
    }

    const sequence = ++renderSequence.current;
    setRenderState("rendering");
    setRenderError(null);

    const renderBoard = async () => {
      try {
        const inputs: BrowserStackupInput[] = activeLayers.map((layer) => {
          const input: BrowserStackupInput = {
            filename: layer.filename,
            gerber: layer.data,
            externalId: layer.id,
          };
          if (layer.kind !== "drawing" && layer.kind !== "unknown" && layer.side !== "unknown") {
            input.type = layer.kind;
            input.side = layer.side;
          }
          return input;
        });
        const stackupRenderer = await loadPcbStackup();
        const stackup = await stackupRenderer(inputs, {
          id: `tw-gerber-${sequence}`,
          outlineGapFill: 0.011,
          useOutline: true,
          color: {
            fr4: "#07513d",
            cu: "#d69a3b",
            cf: "#e0b25a",
            sm: "#0d7557",
            ss: "#eff2e9",
            sp: "#b8c0ba",
            out: "#071b15",
          },
          attributes: {
            class: "gw-rendered-svg",
            preserveAspectRatio: "xMidYMid meet",
          },
        });

        if (sequence !== renderSequence.current) return;
        const maxWidth = Math.max(stackup.top.width, stackup.bottom.width);
        const maxHeight = Math.max(stackup.top.height, stackup.bottom.height);
        if (!(maxWidth > 0 && maxHeight > 0)) {
          throw new Error("No visible PCB geometry was produced. Check layer names, units, and Gerber format statements.");
        }

        setRendered({
          top: {
            svg: sanitizeSvg(stackup.top.svg),
            width: stackup.top.width,
            height: stackup.top.height,
            units: stackup.top.units,
          },
          bottom: {
            svg: sanitizeSvg(stackup.bottom.svg),
            width: stackup.bottom.width,
            height: stackup.bottom.height,
            units: stackup.bottom.units,
          },
        });
      } catch (error) {
        if (sequence !== renderSequence.current) return;
        setRendered(null);
        setRenderError(error instanceof Error ? error.message : "The fabrication files could not be rendered.");
      } finally {
        if (sequence === renderSequence.current) setRenderState("idle");
      }
    };

    void renderBoard();
  }, [layers]);

  const handleIncomingFiles = useCallback(async (files: readonly File[]) => {
    if (!files.length) return;
    const sequence = ++ingestSequence.current;
    setIngestState("reading");
    setInputError(null);
    setDragActive(false);
    try {
      const project = await extractProject(files);
      if (sequence !== ingestSequence.current) return;
      setLayers(project.layers);
      setProjectLabel(project.label.toUpperCase());
      setFileWarnings(project.warnings);
      setRendered(null);
      setRenderError(null);
      setSide("top");
      setZoom(100);
      setMirrored(false);
      setMode("local");
    } catch (error) {
      if (sequence !== ingestSequence.current) return;
      setInputError(error instanceof Error ? error.message : "Those files could not be opened.");
    } finally {
      if (sequence === ingestSequence.current) setIngestState("idle");
    }
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    void handleIncomingFiles(files);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragActive(false);
    void handleIncomingFiles(Array.from(event.dataTransfer.files));
  };

  const clearProject = () => {
    ingestSequence.current += 1;
    renderSequence.current += 1;
    setLayers([]);
    setRendered(null);
    setFileWarnings([]);
    setRenderError(null);
    setInputError(null);
    setProjectLabel("POWER_STAGE_R1 · DEMO");
    setZoom(100);
    setMirrored(false);
    setCursor(null);
  };

  const toggleLayer = (id: string) => {
    if (hasUpload) {
      setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, enabled: !layer.enabled } : layer)));
    } else {
      setDemoVisibility((current) => ({ ...current, [id]: !current[id] }));
    }
  };

  const setAllLayers = (enabled: boolean) => {
    if (hasUpload) {
      setLayers((current) => current.map((layer) => ({ ...layer, enabled })));
    } else {
      setDemoVisibility(Object.fromEntries(DEMO_LAYERS.map((layer) => [layer.id, enabled])));
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const host = svgHostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    let xRatio = (event.clientX - rect.left) / rect.width;
    const yRatio = (event.clientY - rect.top) / rect.height;
    if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
      setCursor(null);
      return;
    }
    if (mirrored) xRatio = 1 - xRatio;
    setCursor({ x: xRatio * boardWidthMm, y: yRatio * boardHeightMm });
  };

  const zoomBy = (amount: number) => setZoom((current) => Math.min(400, Math.max(25, current + amount)));
  const boardTransform = `scale(${zoom / 100}) scaleX(${mirrored ? -1 : 1})`;

  return (
    <section
      className="gerber-workbench"
      data-mode={mode}
      data-dragging={dragActive || undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="Gerber inspection workbench"
    >
      <input
        ref={inputRef}
        className="gw-file-input"
        type="file"
        multiple
        accept={INPUT_ACCEPT}
        onChange={handleInputChange}
        aria-label="Choose Gerber, Excellon, or ZIP files"
      />

      <header className="gw-header">
        <div className="gw-project-identity">
          <span className="gw-project-icon" aria-hidden="true"><ScanLine size={17} /></span>
          <span className="gw-project-copy">
            <strong>{projectLabel}</strong>
            <small>{hasUpload ? `${layers.length} local layers · ${formatBytes(layers.reduce((sum, layer) => sum + layer.bytes, 0))}` : "Built-in interactive sample"}</small>
          </span>
        </div>

        <div className="gw-mode-switch" role="tablist" aria-label="Inspection engine">
          <button
            className="gw-mode-button"
            type="button"
            role="tab"
            aria-selected={mode === "local"}
            data-active={mode === "local" || undefined}
            onClick={() => setMode("local")}
          >
            <ShieldCheck size={14} /> Local preview
          </button>
          <button
            className="gw-mode-button gw-mode-button-reference"
            type="button"
            role="tab"
            aria-selected={mode === "reference"}
            data-active={mode === "reference" || undefined}
            onClick={() => setMode("reference")}
          >
            <Crosshair size={14} /> Ucamco Reference CAM
          </button>
        </div>

        <div className="gw-header-actions">
          <span className="gw-local-badge"><ShieldCheck size={13} /> Files stay local</span>
          <button className="gw-quiet-button" type="button" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={15} /> {hasUpload ? "Replace" : "Upload"}
          </button>
          {hasUpload ? (
            <button className="gw-icon-button" type="button" onClick={clearProject} aria-label="Close uploaded project" title="Close project">
              <X size={17} />
            </button>
          ) : null}
        </div>
      </header>

      {mode === "local" ? (
        <div className="gw-local-workspace" role="tabpanel">
          <aside className="gw-layer-panel" data-open={layersOpen || undefined} aria-label="Fabrication layers">
            <div className="gw-panel-heading">
              <span><Layers3 size={16} /><strong>Layer stack</strong><small>{visibleLayerCount}/{totalLayerCount}</small></span>
              <button className="gw-icon-button" type="button" onClick={() => setLayersOpen(false)} aria-label="Collapse layer panel">
                <PanelRightClose size={16} />
              </button>
            </div>

            <button className="gw-upload-card" type="button" onClick={() => inputRef.current?.click()} disabled={ingestState === "reading"}>
              <span className="gw-upload-card-icon" aria-hidden="true">
                {ingestState === "reading" ? <LoaderCircle className="gw-spin" size={20} /> : <FileArchive size={20} />}
              </span>
              <span><strong>{hasUpload ? "Load another board" : "Open fabrication files"}</strong><small>ZIP, Gerber or Excellon · local only</small></span>
            </button>
            {inputError ? <p className="gw-input-error" role="alert"><TriangleAlert size={14} /> {inputError}</p> : null}

            <div className="gw-layer-list-actions">
              <span>{hasUpload ? "Detected files" : "Demo layers"}</span>
              <span><button type="button" onClick={() => setAllLayers(true)}>All</button><button type="button" onClick={() => setAllLayers(false)}>None</button></span>
            </div>

            <div className="gw-layer-list">
              {layerSummaries.map((layer) => (
                <button
                  className="gw-layer-row"
                  type="button"
                  key={layer.id}
                  role="switch"
                  aria-checked={layer.enabled}
                  data-enabled={layer.enabled || undefined}
                  data-kind={layer.kind}
                  onClick={() => toggleLayer(layer.id)}
                  title={`${layer.displayName} · ${LAYER_LABELS[layer.kind]} · ${sideLabel(layer.side)}`}
                >
                  <span className="gw-layer-swatch" style={{ backgroundColor: LAYER_COLORS[layer.kind] }} aria-hidden="true" />
                  <span className="gw-layer-name"><strong>{layer.displayName}</strong><small>{LAYER_LABELS[layer.kind]} · {sideLabel(layer.side)}</small></span>
                  <span className="gw-layer-eye" aria-hidden="true">{layer.enabled ? <Eye size={15} /> : <EyeOff size={15} />}</span>
                </button>
              ))}
            </div>

            <div className="gw-preflight" data-warning={allWarnings.length > 0 || undefined}>
              <div className="gw-preflight-heading">
                <span>{allWarnings.length ? <TriangleAlert size={15} /> : <CheckCircle2 size={15} />}{allWarnings.length ? "Preflight notes" : "Preflight clear"}</span>
                <strong>{allWarnings.length}</strong>
              </div>
              {allWarnings.length ? (
                <ul>{allWarnings.slice(0, 4).map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
              ) : (
                <p>{hasUpload ? "No filename or geometry issues detected." : "Demo stack is complete and aligned."}</p>
              )}
            </div>
          </aside>

          <div className="gw-stage-column">
            <div className="gw-stage-toolbar">
              {!layersOpen ? (
                <button className="gw-icon-button gw-open-layers" type="button" onClick={() => setLayersOpen(true)} aria-label="Open layer panel" title="Layers">
                  <PanelRightOpen size={16} />
                </button>
              ) : null}
              <div className="gw-side-switch" role="group" aria-label="Board side">
                <button type="button" data-active={side === "top" || undefined} aria-pressed={side === "top"} onClick={() => setSide("top")}>Top</button>
                <button type="button" data-active={side === "bottom" || undefined} aria-pressed={side === "bottom"} onClick={() => setSide("bottom")}>Bottom</button>
              </div>
              <span className="gw-render-status" role="status" aria-live="polite">
                {working ? <><LoaderCircle className="gw-spin" size={13} /> {ingestState === "reading" ? "Reading files" : "Rendering layers"}</> : <><span className="gw-status-dot" /> {hasUpload ? "Local SVG ready" : "Interactive demo"}</>}
              </span>
              <div className="gw-view-controls" role="group" aria-label="View controls">
                <button type="button" onClick={() => zoomBy(-25)} disabled={zoom <= 25} aria-label="Zoom out" title="Zoom out"><ZoomOut size={16} /></button>
                <output aria-label="Zoom level">{zoom}%</output>
                <button type="button" onClick={() => zoomBy(25)} disabled={zoom >= 400} aria-label="Zoom in" title="Zoom in"><ZoomIn size={16} /></button>
                <span className="gw-control-separator" />
                <button type="button" onClick={() => setMirrored((current) => !current)} data-active={mirrored || undefined} aria-pressed={mirrored} aria-label="Mirror board horizontally" title="Mirror"><FlipHorizontal2 size={16} /></button>
                <button type="button" onClick={() => { setZoom(100); setMirrored(false); }} aria-label="Reset view" title="Reset view"><RotateCcw size={16} /></button>
              </div>
            </div>

            <div className="gw-canvas" onPointerMove={handlePointerMove} onPointerLeave={() => setCursor(null)}>
              <div className="gw-canvas-grid" aria-hidden="true" />
              {dragActive ? (
                <div className="gw-drop-overlay"><UploadCloud size={30} /><strong>Drop fabrication files</strong><span>ZIP, Gerber, or Excellon</span></div>
              ) : null}

              {!hasUpload ? (
                <div className="gw-demo-callout">
                  <span>DEMO BOARD</span>
                  <strong>Inspect the controls, then load your own files.</strong>
                  <button type="button" onClick={() => inputRef.current?.click()}><UploadCloud size={15} /> Choose files</button>
                </div>
              ) : null}

              {hasUpload && !visibleLayerCount ? (
                <div className="gw-empty-state"><EyeOff size={28} /><strong>Every layer is hidden</strong><button type="button" onClick={() => setAllLayers(true)}>Show all layers</button></div>
              ) : hasUpload && renderError ? (
                <div className="gw-empty-state gw-render-error"><TriangleAlert size={28} /><strong>Preview unavailable</strong><p>{renderError}</p><button type="button" onClick={() => inputRef.current?.click()}>Choose another file set</button></div>
              ) : hasUpload && !currentRenderedSide ? (
                <div className="gw-empty-state"><LoaderCircle className="gw-spin" size={28} /><strong>Building the board stack…</strong><span>Parsing RS-274X and Excellon locally</span></div>
              ) : (
                <div
                  ref={svgHostRef}
                  className="gw-artboard"
                  data-side={side}
                  data-mirrored={mirrored || undefined}
                  style={{ transform: boardTransform }}
                >
                  {currentRenderedSide ? (
                    <div className="gw-svg-host" dangerouslySetInnerHTML={{ __html: currentRenderedSide.svg }} />
                  ) : (
                    <DemoBoard side={side} visibility={demoVisibility} />
                  )}
                </div>
              )}
            </div>

            <footer className="gw-readout-bar" aria-label="Board measurements">
              <span><small>Board size</small><strong>{formatDimension(boardWidthMm)} × {formatDimension(boardHeightMm)} <em>mm</em></strong></span>
              <span><small>Drill hits</small><strong>{drillHits.toLocaleString()} <em>holes</em></strong></span>
              <span><small>Visible stack</small><strong>{visibleLayerCount} / {totalLayerCount} <em>layers</em></strong></span>
              <span><small>Cursor</small><strong>{cursor ? `${formatDimension(cursor.x)}, ${formatDimension(cursor.y)}` : "—, —"} <em>mm</em></strong></span>
              <span><small>Preflight</small><strong data-warning={allWarnings.length > 0 || undefined}>{allWarnings.length} <em>{allWarnings.length === 1 ? "note" : "notes"}</em></strong></span>
            </footer>
          </div>
        </div>
      ) : (
        <div className="gw-reference-workspace" role="tabpanel">
          <div className="gw-reference-intro">
            <span className="gw-reference-mark"><Maximize2 size={18} /></span>
            <div>
              <span className="gw-reference-kicker">OFFICIAL EXTERNAL TOOL</span>
              <h2>Ucamco Reference Gerber Viewer</h2>
              <p>Use the Gerber format owner’s reference CAM implementation for an authoritative second inspection. Upload the fabrication package again inside the embedded tool; local preview files are never transferred automatically.</p>
            </div>
            <a className="gw-reference-link" href={UCAMCO_VIEWER_URL} target="_blank" rel="noreferrer">
              Open full screen <ExternalLink size={15} />
            </a>
          </div>
          <div className="gw-reference-frame-shell">
            <div className="gw-reference-frame-bar">
              <span><span className="gw-status-dot" /> gerber.ucamco.com</span>
              <span>Ucamco Reference CAM · separate upload</span>
            </div>
            <iframe
              id="gerberviewer"
              className="gw-reference-frame"
              src={UCAMCO_VIEWER_URL}
              title="Ucamco Reference Gerber Viewer"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="clipboard-read; clipboard-write"
            />
          </div>
          <p className="gw-reference-footnote"><ShieldCheck size={14} /> This embedded mode is provided directly by Ucamco and is distinct from Thevenin Works’ private local preview.</p>
        </div>
      )}
    </section>
  );
}
