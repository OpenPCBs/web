import { useEffect, useRef } from 'react';
import JSZip from 'jszip';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DOC_EXTENSIONS = ['pdf', 'md', 'txt', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'svg'];
const GERBER_EXTENSIONS = ['gbr', 'gtl', 'gbl', 'gto', 'gbo', 'gts', 'gbs', 'gtp', 'gbp', 'gko', 'gm1', 'gml', 'pho', 'art', 'cmp', 'sol'];
const DRILL_EXTENSIONS = ['drl', 'xln', 'txt'];

function fileExt(name = '') {
  return name.split('.').pop()?.toLowerCase() || '';
}

function bytesToLabel(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function inferFileGroup(file = {}) {
  if (file.group) return file.group;
  const ext = fileExt(file.name || '');
  if (ext === 'zip') return 'gerber_zip';
  if (DOC_EXTENSIONS.includes(ext) || (file.mimeType || '').startsWith('image/')) return 'documentation';
  return 'project_files';
}

function isDrillName(name = '') {
  const lower = name.toLowerCase();
  return lower.includes('drill') || lower.endsWith('.drl') || lower.endsWith('.xln');
}

function classifyLayer(name = '') {
  const lower = name.toLowerCase();
  if (isDrillName(lower)) return 'drill';
  if (lower.endsWith('.gtl') || lower.endsWith('.cmp') || lower.includes('f_cu') || lower.includes('top_copper') || lower.includes('front copper')) return 'top_copper';
  if (lower.endsWith('.gbl') || lower.endsWith('.sol') || lower.includes('b_cu') || lower.includes('bottom_copper') || lower.includes('back copper')) return 'bottom_copper';
  if (lower.endsWith('.gto') || lower.includes('f_silk') || lower.includes('top overlay') || lower.includes('front silk')) return 'top_silk';
  if (lower.endsWith('.gbo') || lower.includes('b_silk') || lower.includes('bottom overlay') || lower.includes('back silk')) return 'bottom_silk';
  if (lower.endsWith('.gts') || lower.includes('f_mask') || lower.includes('top mask') || lower.includes('front mask')) return 'top_mask';
  if (lower.endsWith('.gbs') || lower.includes('b_mask') || lower.includes('bottom mask') || lower.includes('back mask')) return 'bottom_mask';
  if (lower.endsWith('.gko') || lower.endsWith('.gm1') || lower.endsWith('.gml') || lower.endsWith('.gm2') || lower.includes('edge_cuts') || lower.includes('outline') || lower.includes('profile') || lower.includes('board shape')) return 'outline';
  return 'other';
}

function parseGerberFormatLine(line) {
  const match = line.match(/%FS([LT])A?X(\d)(\d)Y(\d)(\d)\*%/i);
  if (!match) return null;
  return {
    zeroOmission: match[1].toUpperCase(),
    xInteger: Number(match[2]),
    xDecimal: Number(match[3]),
    yInteger: Number(match[4]),
    yDecimal: Number(match[5]),
  };
}

function parseGerberUnitsLine(line) {
  const match = line.match(/%MO(IN|MM)\*%/i);
  return match ? match[1].toUpperCase() : null;
}

function parseDrillUnitsLine(line) {
  const upper = line.toUpperCase();
  if (upper.includes('M72') || upper.includes('INCH')) return 'IN';
  if (upper.includes('M71') || upper.includes('METRIC')) return 'MM';
  return null;
}

function parseDrillZeroMode(line) {
  const upper = line.toUpperCase();
  if (upper.includes('TZ')) return 'T';
  if (upper.includes('LZ')) return 'L';
  return null;
}

function coordinateScale(units) {
  return units === 'IN' ? 25.4 : 1;
}

function parseFormattedCoordinate(rawValue, integerDigits, decimalDigits, zeroOmission = 'L') {
  if (rawValue == null) return 0;
  if (String(rawValue).includes('.')) return Number(rawValue);
  const sign = String(rawValue).startsWith('-') ? -1 : 1;
  const digitsOnly = String(rawValue).replace(/^[+-]/, '');
  const expectedLength = integerDigits + decimalDigits;
  let padded = digitsOnly;
  if (digitsOnly.length < expectedLength) {
    padded = zeroOmission === 'T' ? digitsOnly.padEnd(expectedLength, '0') : digitsOnly.padStart(expectedLength, '0');
  }
  const numeric = Number(padded || '0') / (10 ** decimalDigits);
  return sign * numeric;
}

function parseApertureSize(rawValue, units) {
  if (!rawValue) return 0.22;
  const first = String(rawValue).split('X')[0];
  const numeric = Number(first || 0);
  if (!Number.isFinite(numeric)) return 0.22;
  return numeric * coordinateScale(units);
}

function parseDrillDiameterLine(line, units) {
  const match = line.match(/^T(\d+)C([0-9.]+)/i);
  if (!match) return null;
  return { tool: match[1], diameter: Number(match[2]) * coordinateScale(units) };
}

function mergeBounds(target, bounds) {
  target.minX = Math.min(target.minX, bounds.minX);
  target.minY = Math.min(target.minY, bounds.minY);
  target.maxX = Math.max(target.maxX, bounds.maxX);
  target.maxY = Math.max(target.maxY, bounds.maxY);
}

function normalizeBounds(bounds, fallback = { minX: 0, minY: 0, maxX: 100, maxY: 100 }) {
  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) {
    return { ...fallback };
  }
  return bounds;
}

function createEmptyBounds() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function createGerberLayerData(text, layerName = '', isDrill = false) {
  const layerType = isDrill ? 'drill' : classifyLayer(layerName);
  const commands = [];
  const flashes = [];
  const drills = [];
  const bounds = createEmptyBounds();
  const apertureMap = new Map();
  const drillToolDiameters = new Map();
  let currentAperture = '10';
  let currentDrillDiameter = 0.35;
  let currentX = 0;
  let currentY = 0;
  let currentOperation = '2';
  let units = 'MM';
  let format = { zeroOmission: 'L', xInteger: 2, xDecimal: 5, yInteger: 2, yDecimal: 5 };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const fs = parseGerberFormatLine(line);
    if (fs) {
      format = fs;
      continue;
    }

    const mo = parseGerberUnitsLine(line);
    if (mo) {
      units = mo;
      continue;
    }

    if (isDrill) {
      const drillUnits = parseDrillUnitsLine(line);
      if (drillUnits) {
        units = drillUnits;
        const zeroMode = parseDrillZeroMode(line);
        if (zeroMode) format.zeroOmission = zeroMode;
        continue;
      }

      const toolDef = parseDrillDiameterLine(line, units);
      if (toolDef) {
        drillToolDiameters.set(toolDef.tool, toolDef.diameter);
        continue;
      }

      const toolSelect = line.match(/^T(\d+)$/i);
      if (toolSelect) {
        currentDrillDiameter = drillToolDiameters.get(toolSelect[1]) || currentDrillDiameter;
        continue;
      }

      const xMatch = line.match(/X([+-]?\d+(?:\.\d+)?)/i);
      const yMatch = line.match(/Y([+-]?\d+(?:\.\d+)?)/i);
      if (xMatch || yMatch) {
        const x = xMatch ? parseFormattedCoordinate(xMatch[1], format.xInteger, format.xDecimal, format.zeroOmission) * coordinateScale(units) : currentX;
        const y = yMatch ? parseFormattedCoordinate(yMatch[1], format.yInteger, format.yDecimal, format.zeroOmission) * coordinateScale(units) : currentY;
        drills.push({ x, y, diameter: currentDrillDiameter });
        currentX = x;
        currentY = y;
        mergeBounds(bounds, { minX: x, minY: y, maxX: x, maxY: y });
      }
      continue;
    }

    const apertureDef = line.match(/%ADD(\d+)([A-Z]),?([0-9.Xx+-]+)?/i);
    if (apertureDef) {
      apertureMap.set(apertureDef[1], { shape: apertureDef[2].toUpperCase(), size: parseApertureSize(apertureDef[3], units) });
      continue;
    }

    const selectAperture = line.match(/^D(\d+)\*$/);
    if (selectAperture && Number(selectAperture[1]) >= 10) {
      currentAperture = selectAperture[1];
      continue;
    }

    const xMatch = line.match(/X([+-]?\d+(?:\.\d+)?)/i);
    const yMatch = line.match(/Y([+-]?\d+(?:\.\d+)?)/i);
    const dMatch = line.match(/D0?([123])/i);
    const hasCoordinate = Boolean(xMatch || yMatch);
    if (!hasCoordinate && !dMatch) continue;

    const nextX = xMatch ? parseFormattedCoordinate(xMatch[1], format.xInteger, format.xDecimal, format.zeroOmission) * coordinateScale(units) : currentX;
    const nextY = yMatch ? parseFormattedCoordinate(yMatch[1], format.yInteger, format.yDecimal, format.zeroOmission) * coordinateScale(units) : currentY;
    const operation = dMatch ? dMatch[1] : currentOperation;
    currentOperation = operation;
    const aperture = apertureMap.get(currentAperture) || { shape: 'C', size: 0.22 };

    if (operation === '2') {
      currentX = nextX;
      currentY = nextY;
      mergeBounds(bounds, { minX: nextX, minY: nextY, maxX: nextX, maxY: nextY });
      continue;
    }

    if (operation === '1') {
      commands.push({ x1: currentX, y1: currentY, x2: nextX, y2: nextY, width: aperture.size || 0.22 });
      mergeBounds(bounds, { minX: Math.min(currentX, nextX), minY: Math.min(currentY, nextY), maxX: Math.max(currentX, nextX), maxY: Math.max(currentY, nextY) });
      currentX = nextX;
      currentY = nextY;
      continue;
    }

    if (operation === '3') {
      flashes.push({ x: nextX, y: nextY, diameter: aperture.size || 0.22, shape: aperture.shape || 'C' });
      const r = (aperture.size || 0.22) / 2;
      mergeBounds(bounds, { minX: nextX - r, minY: nextY - r, maxX: nextX + r, maxY: nextY + r });
      currentX = nextX;
      currentY = nextY;
    }
  }

  return { layerName, layerType, bounds: normalizeBounds(bounds), commands, flashes, drills };
}

function createEmptySide() {
  return { copperCommands: [], copperFlashes: [], silkCommands: [], silkFlashes: [] };
}

function mergeLayerPreviewData(parsedLayers) {
  const overallBounds = createEmptyBounds();
  const outlineBounds = createEmptyBounds();
  const outlineCommands = [];
  let hasOutline = false;
  const top = createEmptySide();
  const bottom = createEmptySide();
  const drills = [];

  for (const layer of parsedLayers) {
    mergeBounds(overallBounds, layer.bounds);
    switch (layer.layerType) {
      case 'outline':
        hasOutline = true;
        mergeBounds(outlineBounds, layer.bounds);
        outlineCommands.push(...layer.commands);
        break;
      case 'top_copper':
        top.copperCommands.push(...layer.commands);
        top.copperFlashes.push(...layer.flashes);
        break;
      case 'bottom_copper':
        bottom.copperCommands.push(...layer.commands);
        bottom.copperFlashes.push(...layer.flashes);
        break;
      case 'top_silk':
        top.silkCommands.push(...layer.commands);
        top.silkFlashes.push(...layer.flashes);
        break;
      case 'bottom_silk':
        bottom.silkCommands.push(...layer.commands);
        bottom.silkFlashes.push(...layer.flashes);
        break;
      case 'drill':
        drills.push(...layer.drills);
        break;
      default:
        break;
    }
  }

  const bounds = normalizeBounds(overallBounds);
  const boardBounds = hasOutline ? normalizeBounds(outlineBounds, bounds) : bounds;
  const boardWidthMm = Math.max(boardBounds.maxX - boardBounds.minX, 0);
  const boardHeightMm = Math.max(boardBounds.maxY - boardBounds.minY, 0);

  return {
    bounds,
    boardBounds,
    outlineCommands,
    top,
    bottom,
    drills,
    sizeLabel: `${boardWidthMm.toFixed(2)} mm × ${boardHeightMm.toFixed(2)} mm`,
  };
}

function drawLayerSet(ctx, sideData) {
  ctx.strokeStyle = '#d1b160';
  ctx.fillStyle = '#e8cb77';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const command of sideData.copperCommands) {
    ctx.lineWidth = Math.max(command.width, 0.08);
    ctx.beginPath();
    ctx.moveTo(command.x1, command.y1);
    ctx.lineTo(command.x2, command.y2);
    ctx.stroke();
  }

  for (const flash of sideData.copperFlashes) {
    const r = Math.max(flash.diameter / 2, 0.08);
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#f8fbff';
  ctx.fillStyle = '#ffffff';
  for (const command of sideData.silkCommands) {
    ctx.lineWidth = Math.max(command.width, 0.06);
    ctx.beginPath();
    ctx.moveTo(command.x1, command.y1);
    ctx.lineTo(command.x2, command.y2);
    ctx.stroke();
  }

  for (const flash of sideData.silkFlashes) {
    const r = Math.max(flash.diameter / 2, 0.06);
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function buildBoardTexture(previewData, side = 'top', width = 2048, height = 1400) {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  const bounds = previewData.boardBounds || previewData.bounds;
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const padding = 56;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;

  ctx.save();
  if (side === 'bottom') {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.translate(padding, height - padding);
  ctx.scale(scale, -scale);
  ctx.translate(-bounds.minX, -bounds.minY);

  drawLayerSet(ctx, side === 'bottom' ? previewData.bottom : previewData.top);

  ctx.restore();
  return offscreen;
}

function createRoundedRectShape(width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function createBoardShape(previewData) {
  const bounds = previewData.boardBounds || previewData.bounds;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const outline = previewData.outlineCommands || [];

  if (outline.length >= 2) {
    const shape = new THREE.Shape();
    let started = false;
    let lastX = null;
    let lastY = null;

    for (const command of outline) {
      const x1 = command.x1 - centerX;
      const y1 = command.y1 - centerY;
      const x2 = command.x2 - centerX;
      const y2 = command.y2 - centerY;

      if (!started) {
        shape.moveTo(x1, y1);
        started = true;
      } else if (lastX !== null && (Math.abs(lastX - x1) > 0.001 || Math.abs(lastY - y1) > 0.001)) {
        shape.lineTo(x1, y1);
      }

      shape.lineTo(x2, y2);
      lastX = x2;
      lastY = y2;
    }

    shape.closePath();
    return shape;
  }

  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  return createRoundedRectShape(width, height, Math.min(width, height) * 0.04);
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  if (material.map) material.map.dispose();
  material.dispose();
}

function createSurfaceMaterial(texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.56,
    metalness: 0.1,
    side: THREE.FrontSide,
    transparent: true,
    alphaTest: 0.05,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
}

function mountBoardViewer(canvas, previewData, { interactive = true } = {}) {
  if (!canvas || !previewData) return () => {};

  const boardBounds = previewData.boardBounds || previewData.bounds;
  const spanX = Math.max(boardBounds.maxX - boardBounds.minX, 1);
  const spanY = Math.max(boardBounds.maxY - boardBounds.minY, 1);
  const boardWidth = spanX;
  const boardHeight = spanY;
  const boardLongest = Math.max(boardWidth, boardHeight);
  const thickness = 1.6;
  const surfaceLift = Math.max(thickness * 0.01, 0.02);
  const centerX = (boardBounds.minX + boardBounds.maxX) / 2;
  const centerY = (boardBounds.minY + boardBounds.maxY) / 2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1f6fc);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, Math.max(boardLongest * 50, 300));
  camera.up.set(0, 0, 1);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;

  const shape = createBoardShape(previewData);
  const boardGeometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 28, steps: 1 });
  boardGeometry.translate(0, 0, -thickness / 2);
  const boardMesh = new THREE.Mesh(boardGeometry, new THREE.MeshStandardMaterial({ color: 0x0e694b, roughness: 0.72, metalness: 0.08 }));
  boardMesh.renderOrder = 0;
  scene.add(boardMesh);

  const topTexture = new THREE.CanvasTexture(buildBoardTexture(previewData, 'top'));
  const bottomTexture = new THREE.CanvasTexture(buildBoardTexture(previewData, 'bottom'));
  if ('colorSpace' in topTexture) {
    topTexture.colorSpace = THREE.SRGBColorSpace;
    bottomTexture.colorSpace = THREE.SRGBColorSpace;
  } else {
    topTexture.encoding = THREE.sRGBEncoding;
    bottomTexture.encoding = THREE.sRGBEncoding;
  }

  const anisotropy = renderer.capabilities?.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  topTexture.anisotropy = anisotropy;
  bottomTexture.anisotropy = anisotropy;

  const topGeometry = new THREE.ShapeGeometry(shape, 40);
  topGeometry.translate(0, 0, thickness / 2 + surfaceLift);
  const topMesh = new THREE.Mesh(topGeometry, createSurfaceMaterial(topTexture));
  topMesh.renderOrder = 2;
  scene.add(topMesh);

  const bottomGeometry = new THREE.ShapeGeometry(shape, 40);
  bottomGeometry.translate(0, 0, -thickness / 2 - surfaceLift);
  const bottomMesh = new THREE.Mesh(bottomGeometry, createSurfaceMaterial(bottomTexture));
  bottomMesh.rotateY(Math.PI);
  bottomMesh.renderOrder = 2;
  scene.add(bottomMesh);

  for (const drill of previewData.drills.slice(0, 800)) {
    const localX = drill.x - centerX;
    const localY = drill.y - centerY;
    const radiusValue = Math.max((drill.diameter || 0.35) / 2, 0.14);
    const holeGeometry = new THREE.CylinderGeometry(radiusValue, radiusValue, thickness + 0.04, 18);
    holeGeometry.rotateX(Math.PI / 2);
    const holeMesh = new THREE.Mesh(holeGeometry, new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.4, metalness: 0.2 }));
    holeMesh.position.set(localX, localY, 0);
    holeMesh.renderOrder = 1;
    scene.add(holeMesh);
  }

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8d8e8, 1.25));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(boardLongest * 0.9, -boardLongest * 1.2, boardLongest * 1.1);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xb9d3ff, 0.7);
  fillLight.position.set(-boardLongest * 0.9, boardLongest * 0.8, boardLongest * 0.7);
  scene.add(fillLight);

  const controls = interactive ? new OrbitControls(camera, canvas) : null;
  if (controls) {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.minDistance = boardLongest * 0.6;
    controls.maxDistance = boardLongest * 8;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.minPolarAngle = 0.01;
    controls.maxPolarAngle = Math.PI - 0.01;
  }

  camera.position.set(boardWidth * 0.9, -boardHeight * 1.5, Math.max(boardLongest * 0.9, 25));
  camera.lookAt(0, 0, 0);

  const renderScene = () => {
    controls?.update();
    renderer.render(scene, camera);
  };

  const resize = () => {
    const width = canvas.clientWidth || (interactive ? 860 : 560);
    const height = canvas.clientHeight || (interactive ? 420 : 180);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderScene();
  };

  let frameId = 0;
  const tick = () => {
    renderScene();
    frameId = requestAnimationFrame(tick);
  };

  let observer = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  resize();
  if (interactive) tick();
  else renderScene();

  return () => {
    if (frameId) cancelAnimationFrame(frameId);
    if (observer) observer.disconnect();
    else window.removeEventListener('resize', resize);
    controls?.dispose();
    scene.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) disposeMaterial(child.material);
    });
    topTexture.dispose();
    bottomTexture.dispose();
    renderer.dispose();
  };
}

export function BoardViewer3DFixed({ renderData, className, interactive = true }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!renderData) return undefined;
    return mountBoardViewer(canvasRef.current, renderData, { interactive });
  }, [renderData, interactive]);
  return <canvas ref={canvasRef} className={className} />;
}

function buildPreviewFromParsedLayers(file, parsedLayers, groupHint) {
  const merged = mergeLayerPreviewData(parsedLayers);
  return {
    name: file.name,
    sizeLabel: bytesToLabel(file.size),
    kind: 'zip-gerber',
    group: groupHint || inferFileGroup(file),
    render: merged,
    layers: parsedLayers.map((layer) => layer.layerName),
    notes: [`${parsedLayers.length} renderable layers detected`, merged.sizeLabel, 'Top and bottom copper rendered'],
  };
}

export async function buildGerberPreviewFile(file, groupHint) {
  const extension = fileExt(file.name);
  const isImage = (file.type || '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension);
  const isPdf = file.type === 'application/pdf' || extension === 'pdf';
  const base = { name: file.name, sizeLabel: bytesToLabel(file.size), kind: extension || 'file', group: groupHint || inferFileGroup(file) };

  if (isImage || isPdf) {
    return { ...base, kind: isImage ? 'image' : 'pdf', objectUrl: URL.createObjectURL(file) };
  }

  if (extension === 'zip') {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const parsedLayers = [];
    for (const entry of entries) {
      const ext = fileExt(entry.name);
      if (GERBER_EXTENSIONS.includes(ext) || (DRILL_EXTENSIONS.includes(ext) && isDrillName(entry.name))) {
        const text = await entry.async('text');
        parsedLayers.push(createGerberLayerData(text, entry.name, DRILL_EXTENSIONS.includes(ext) && isDrillName(entry.name)));
      }
    }
    if (parsedLayers.length) {
      const merged = mergeLayerPreviewData(parsedLayers);
      return {
        ...buildPreviewFromParsedLayers(file, parsedLayers, groupHint),
        notes: [`${entries.length} files in bundle`, `${parsedLayers.length} renderable layers detected`, merged.sizeLabel, 'Top and bottom copper rendered'],
      };
    }
    return {
      ...base,
      kind: 'zip',
      text: entries.map((entry) => entry.name).join('\n'),
      notes: [`${entries.length} files in bundle`, 'No Gerber or drill layers detected'],
    };
  }

  const text = await file.text();
  if (GERBER_EXTENSIONS.includes(extension) || (DRILL_EXTENSIONS.includes(extension) && isDrillName(file.name))) {
    const parsed = createGerberLayerData(text, file.name, DRILL_EXTENSIONS.includes(extension) && isDrillName(file.name));
    const merged = mergeLayerPreviewData([parsed]);
    return { ...base, kind: 'gerber', render: merged, text, notes: [merged.sizeLabel] };
  }

  return { ...base, kind: extension || 'text', text: await file.text() };
}
