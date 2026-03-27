const GERBER_EXTENSIONS = ['gbr', 'gtl', 'gbl', 'gto', 'gbo', 'gko', 'gm1', 'gml', 'pho', 'art', 'cmp', 'sol'];
const DRILL_EXTENSIONS = ['drl', 'txt', 'xln'];
const SCHEMATIC_EXTENSIONS = ['kicad_sch', 'sch'];
const BOARD_EXTENSIONS = ['kicad_pcb', 'pcbdoc'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

export function getFileExtension(name = '') {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function detectFileKind(file) {
  const ext = getFileExtension(file?.name || '');
  const type = file?.type || '';

  if (type.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'zip') return 'zip';
  if (SCHEMATIC_EXTENSIONS.includes(ext)) return 'schematic';
  if (BOARD_EXTENSIONS.includes(ext)) return 'board';
  if (GERBER_EXTENSIONS.includes(ext)) return 'gerber';
  if (DRILL_EXTENSIONS.includes(ext)) return 'drill';
  return 'text';
}

export async function buildFilePreview(file) {
  if (!file) return null;

  const kind = detectFileKind(file);
  const base = {
    kind,
    name: file.name,
    size: file.size,
  };

  if (kind === 'image' || kind === 'pdf') {
    return {
      ...base,
      objectUrl: URL.createObjectURL(file),
    };
  }

  if (kind === 'zip') {
    return {
      ...base,
      notes: ['Zip bundles upload normally. Instant in-browser rendering is enabled for individual Gerber, PDF, image, and KiCad text files.'],
    };
  }

  const text = await file.text();

  if (kind === 'gerber' || kind === 'drill') {
    return {
      ...base,
      text,
      render: createGerberRenderData(text, kind === 'drill'),
      notes: summarizeGerber(text, kind === 'drill'),
    };
  }

  if (kind === 'schematic') {
    return {
      ...base,
      text,
      render: summarizeSchematic(text),
    };
  }

  if (kind === 'board') {
    return {
      ...base,
      text,
      render: summarizeBoard(text),
    };
  }

  return {
    ...base,
    text,
    notes: ['Plain-text preview available.'],
  };
}

function summarizeGerber(text, isDrill) {
  const lines = text.split(/\r?\n/);
  const apertures = (text.match(/%ADD\d+/g) || []).length;
  const flashes = (text.match(/D03\*/g) || []).length;
  const draws = (text.match(/D01\*/g) || []).length;

  return [
    isDrill ? 'NC drill preview' : 'Gerber layer preview',
    `${lines.length} lines parsed`,
    `${apertures} aperture definitions`,
    `${draws} draw commands`,
    `${flashes} flash commands`,
  ];
}

function summarizeSchematic(text) {
  const symbols = (text.match(/\(symbol\s/g) || []).length;
  const wires = (text.match(/\(wire\s/g) || []).length;
  const labels = (text.match(/\(label\s/g) || []).length;
  const junctions = (text.match(/\(junction\s/g) || []).length;
  const refs = [...new Set([...text.matchAll(/\(property\s+"Reference"\s+"([^"]+)"/g)].map((match) => match[1]))].slice(0, 24);

  return {
    metrics: [
      `${symbols} symbols`,
      `${wires} wires`,
      `${labels} labels`,
      `${junctions} junctions`,
    ],
    refs,
    excerpt: text.slice(0, 2400),
  };
}

function summarizeBoard(text) {
  const footprints = (text.match(/\(footprint\s/g) || []).length;
  const vias = (text.match(/\(via\s/g) || []).length;
  const segments = (text.match(/\(segment\s/g) || []).length;
  const nets = (text.match(/\(net\s\d+\s/g) || []).length;

  return {
    metrics: [
      `${footprints} footprints`,
      `${nets} nets`,
      `${segments} routed segments`,
      `${vias} vias`,
    ],
    excerpt: text.slice(0, 2400),
  };
}

function createGerberRenderData(text, isDrill) {
  const commands = [];
  const flashes = [];
  const drills = [];
  const apertureMap = new Map();
  let currentAperture = '10';
  let currentX = 0;
  let currentY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const apertureDef = trimmed.match(/%ADD(\d+)([A-Z]),?([0-9.]+)?/);
    if (apertureDef) {
      apertureMap.set(apertureDef[1], {
        shape: apertureDef[2],
        size: Number(apertureDef[3] || 0.2),
      });
      continue;
    }

    const selectAperture = trimmed.match(/^D(\d+)\*$/);
    if (selectAperture && Number(selectAperture[1]) >= 10) {
      currentAperture = selectAperture[1];
      continue;
    }

    if (isDrill) {
      const drill = trimmed.match(/^X(-?\d+)Y(-?\d+)/);
      if (drill) {
        const x = Number(drill[1]);
        const y = Number(drill[2]);
        drills.push({ x, y, r: 1200 });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      continue;
    }

    const draw = trimmed.match(/^(?:G0[123])?X(-?\d+)Y(-?\d+)(?:D0([123]))?\*$/);
    if (!draw) continue;

    const x = Number(draw[1]);
    const y = Number(draw[2]);
    const op = draw[3] || '1';
    const aperture = apertureMap.get(currentAperture) || { shape: 'C', size: 1500 };

    if (op === '2') {
      currentX = x;
      currentY = y;
    } else if (op === '1') {
      commands.push({ x1: currentX, y1: currentY, x2: x, y2: y, width: aperture.size || 1500 });
      currentX = x;
      currentY = y;
    } else if (op === '3') {
      flashes.push({ x, y, r: aperture.size || 1500, shape: aperture.shape || 'C' });
      currentX = x;
      currentY = y;
    }

    minX = Math.min(minX, x, currentX);
    minY = Math.min(minY, y, currentY);
    maxX = Math.max(maxX, x, currentX);
    maxY = Math.max(maxY, y, currentY);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100000;
    maxY = 100000;
  }

  return {
    bounds: { minX, minY, maxX, maxY },
    commands,
    flashes,
    drills,
  };
}
