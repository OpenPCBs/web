"use client";

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
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
} from "react";

import { ExternalToolGate } from "./privacy-controls";
import { DemoBoard } from "../features/gerber/demo-board";
import { loadPcbStackup, extractProject, sanitizeSvg, formatBytes, formatDimension, toMillimeters, countDrillHits, sideLabel, INPUT_ACCEPT, LAYER_COLORS, LAYER_LABELS, DEMO_LAYERS, DEMO_WIDTH_MM, DEMO_HEIGHT_MM, UCAMCO_VIEWER_URL, type LayerSummary, type BoardSide, type ViewerMode, type RenderState, type IngestState, type GerberLayer, type RenderedBoard, type BrowserStackupInput } from "../features/gerber/project";

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
                    <img className="gw-svg-host" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(currentRenderedSide.svg)}`} alt={`${side} view of the uploaded circuit board`} draggable={false} />
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
            <ExternalToolGate><iframe
              id="gerberviewer"
              className="gw-reference-frame"
              src={UCAMCO_VIEWER_URL}
              title="Ucamco Reference Gerber Viewer"
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-downloads"
            /></ExternalToolGate>
          </div>
          <p className="gw-reference-footnote"><ShieldCheck size={14} /> This embedded mode is provided directly by Ucamco and is distinct from Trace Works’ private local preview.</p>
        </div>
      )}
    </section>
  );
}
