import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  ClerkLoaded,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  UserProfile,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { Archive, ArrowRight, ArrowUpRight, Download, Files, FileText, FolderOpen, GitFork, ImageIcon, Layers3, Rocket, Trash2 } from 'lucide-react';
import JSZip from 'jszip';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const DOC_EXTENSIONS = ['pdf', 'md', 'txt', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp', 'svg'];
const GERBER_EXTENSIONS = ['gbr', 'gtl', 'gbl', 'gto', 'gbo', 'gko', 'gm1', 'gml', 'pho', 'art', 'cmp', 'sol'];
const DRILL_EXTENSIONS = ['drl', 'xln', 'txt'];

function request(path, options = {}) {
  if (!API_BASE_URL) return Promise.reject(new Error('The frontend is missing VITE_API_BASE_URL.'));
  return fetch(`${API_BASE_URL}${path}`, options).then(async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : await response.text();
    if (!response.ok) throw new Error((typeof payload === 'object' && payload?.message) || payload || 'Request failed.');
    return payload;
  });
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
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

function fileExt(name = '') {
  return name.split('.').pop()?.toLowerCase() || '';
}

function isDrillName(name = '') {
  const lower = name.toLowerCase();
  return lower.includes('drill') || lower.endsWith('.drl') || lower.endsWith('.xln');
}

function inferFileGroup(file = {}) {
  if (file.group) return file.group;
  const ext = fileExt(file.name || '');
  if (ext === 'zip') return 'gerber_zip';
  if (DOC_EXTENSIONS.includes(ext) || (file.mimeType || '').startsWith('image/')) return 'documentation';
  return 'project_files';
}

function fileGroupLabel(group) {
  if (group === 'gerber_zip') return 'Gerber ZIP';
  if (group === 'documentation') return 'Documentation';
  return 'Project files';
}

function groupFiles(files = []) {
  return files.reduce((acc, file) => {
    const group = inferFileGroup(file);
    if (!acc[group]) acc[group] = [];
    acc[group].push(file);
    return acc;
  }, { gerber_zip: [], documentation: [], project_files: [] });
}

function getPrimaryGerberFile(files = []) {
  return files.find((file) => inferFileGroup(file) === 'gerber_zip') || files.find((file) => fileExt(file.name) === 'zip') || files[0] || null;
}

function createGerberRenderData(text, isDrill = false) {
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

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const apertureDef = line.match(/%ADD(\d+)([A-Z]),?([0-9.]+)?/);
    if (apertureDef) {
      apertureMap.set(apertureDef[1], { shape: apertureDef[2], size: Number(apertureDef[3] || 1500) });
      continue;
    }
    const selectAperture = line.match(/^D(\d+)\*$/);
    if (selectAperture && Number(selectAperture[1]) >= 10) {
      currentAperture = selectAperture[1];
      continue;
    }
    if (isDrill) {
      const drill = line.match(/^X(-?\d+)Y(-?\d+)/);
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
    const draw = line.match(/^(?:G0[123])?X(-?\d+)Y(-?\d+)(?:D0([123]))?\*$/);
    if (!draw) continue;
    const x = Number(draw[1]);
    const y = Number(draw[2]);
    const op = draw[3] || '1';
    const aperture = apertureMap.get(currentAperture) || { size: 1500, shape: 'C' };
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

  return { bounds: { minX, minY, maxX, maxY }, commands, flashes, drills };
}

function mergeRenderData(items) {
  const merged = { bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }, commands: [], flashes: [], drills: [] };
  for (const item of items) {
    merged.commands.push(...item.commands);
    merged.flashes.push(...item.flashes);
    merged.drills.push(...item.drills);
    merged.bounds.minX = Math.min(merged.bounds.minX, item.bounds.minX);
    merged.bounds.minY = Math.min(merged.bounds.minY, item.bounds.minY);
    merged.bounds.maxX = Math.max(merged.bounds.maxX, item.bounds.maxX);
    merged.bounds.maxY = Math.max(merged.bounds.maxY, item.bounds.maxY);
  }
  if (!Number.isFinite(merged.bounds.minX)) {
    merged.bounds = { minX: 0, minY: 0, maxX: 100000, maxY: 100000 };
  }
  return merged;
}

function createRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function buildBoardTexture(renderData, width = 1000, height = 700) {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  const { minX, minY, maxX, maxY } = renderData.bounds;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const padding = 50;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(padding, height - padding);
  ctx.scale(scale, -scale);
  ctx.translate(-minX, -minY);

  ctx.strokeStyle = '#d4b25c';
  ctx.fillStyle = '#d4b25c';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const command of renderData.commands) {
    ctx.lineWidth = Math.max(command.width / 1000, 1.2 / scale);
    ctx.beginPath();
    ctx.moveTo(command.x1, command.y1);
    ctx.lineTo(command.x2, command.y2);
    ctx.stroke();
  }

  ctx.fillStyle = '#e8d38c';
  for (const flash of renderData.flashes) {
    const radius = Math.max(flash.r / 2000, 1.2 / scale);
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#08131c';
  for (const drill of renderData.drills) {
    const radius = Math.max(drill.r / 2000, 1 / scale);
    ctx.beginPath();
    ctx.arc(drill.x, drill.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  return offscreen;
}

function drawBoardPreview(canvas, renderData) {
  if (!canvas || !renderData) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const boardWidth = width * 0.7;
  const boardHeight = height * 0.46;
  const thickness = 18;
  const boardX = (width - boardWidth) / 2;
  const boardY = (height - boardHeight) / 2 - 8;

  ctx.clearRect(0, 0, width, height);
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#eef3fb');
  background.addColorStop(1, '#dde8f8');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(boardX + boardWidth / 2, boardY + boardHeight / 2);
  ctx.rotate(-0.08);

  const x = -boardWidth / 2;
  const y = -boardHeight / 2;
  const texture = buildBoardTexture(renderData, 1100, 700);

  ctx.fillStyle = 'rgba(7, 12, 22, 0.18)';
  createRoundedRectPath(ctx, x + 18, y + 22, boardWidth, boardHeight, 18);
  ctx.fill();

  ctx.fillStyle = '#0b4c35';
  createRoundedRectPath(ctx, x + 10, y + boardHeight - 2, boardWidth, thickness, 16);
  ctx.fill();
  createRoundedRectPath(ctx, x + boardWidth - 2, y + 10, thickness, boardHeight, 16);
  ctx.fill();

  const boardGradient = ctx.createLinearGradient(x, y, x, y + boardHeight);
  boardGradient.addColorStop(0, '#17835a');
  boardGradient.addColorStop(1, '#0c5d40');
  ctx.fillStyle = boardGradient;
  createRoundedRectPath(ctx, x, y, boardWidth, boardHeight, 18);
  ctx.fill();

  ctx.save();
  createRoundedRectPath(ctx, x, y, boardWidth, boardHeight, 18);
  ctx.clip();
  ctx.drawImage(texture, x + 12, y + 12, boardWidth - 24, boardHeight - 24);
  ctx.restore();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  createRoundedRectPath(ctx, x, y, boardWidth, boardHeight, 18);
  ctx.stroke();

  ctx.restore();
}

async function buildFilePreview(file, groupHint) {
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
    const layers = [];
    for (const entry of entries) {
      const ext = fileExt(entry.name);
      if (GERBER_EXTENSIONS.includes(ext) || (DRILL_EXTENSIONS.includes(ext) && isDrillName(entry.name))) {
        layers.push({
          name: entry.name,
          text: await entry.async('text'),
          isDrill: DRILL_EXTENSIONS.includes(ext) && isDrillName(entry.name),
        });
      }
    }
    if (layers.length) {
      return {
        ...base,
        kind: 'zip-gerber',
        layers: layers.map((layer) => layer.name),
        render: mergeRenderData(layers.map((layer) => createGerberRenderData(layer.text, layer.isDrill))),
        notes: [`${entries.length} files in bundle`, `${layers.length} renderable layers detected`],
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
    return { ...base, kind: 'gerber', render: createGerberRenderData(text, !GERBER_EXTENSIONS.includes(extension)), text };
  }
  return { ...base, kind: extension || 'text', text };
}

async function buildPreviewFromRemoteFile(fileDescriptor) {
  const response = await fetch(fileDescriptor.url);
  if (!response.ok) throw new Error(`Could not load ${fileDescriptor.name}.`);
  const blob = await response.blob();
  return buildFilePreview(
    new File([blob], fileDescriptor.name, { type: fileDescriptor.mimeType || blob.type || 'application/octet-stream' }),
    inferFileGroup(fileDescriptor),
  );
}

function FilePreview({ preview }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (preview?.render && ['gerber', 'drill', 'zip-gerber'].includes(preview.kind)) {
      drawBoardPreview(canvasRef.current, preview.render);
    }
  }, [preview]);
  useEffect(() => () => {
    if (preview?.objectUrl) URL.revokeObjectURL(preview.objectUrl);
  }, [preview]);
  if (!preview) return null;
  return (
    <article className="preview-card">
      <div className="preview-card-header">
        <div>
          <strong>{preview.name}</strong>
          <p>{preview.sizeLabel}</p>
        </div>
        <span className="chip chip-muted">{preview.kind}</span>
      </div>
      {preview.kind === 'image' ? <img className="preview-image" src={preview.objectUrl} alt={preview.name} /> : null}
      {preview.kind === 'pdf' ? <iframe className="preview-frame" title={preview.name} src={preview.objectUrl} /> : null}
      {['gerber', 'drill', 'zip-gerber'].includes(preview.kind) ? <canvas ref={canvasRef} className="preview-canvas" width="860" height="520" /> : null}
      {preview.layers?.length ? <div className="tag-row">{preview.layers.map((layer) => <span key={layer} className="chip chip-soft">{layer}</span>)}</div> : null}
      {preview.notes?.length ? <div className="tag-row">{preview.notes.map((note) => <span key={note} className="chip chip-soft">{note}</span>)}</div> : null}
      {preview.text && !['image', 'pdf'].includes(preview.kind) ? <pre className="code-panel">{preview.text.slice(0, 2400)}</pre> : null}
    </article>
  );
}

function ProjectBoardThumbnail({ project }) {
  const canvasRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const gerberFile = useMemo(() => getPrimaryGerberFile(project.files || []), [project.files]);

  useEffect(() => {
    let active = true;
    if (!gerberFile || inferFileGroup(gerberFile) !== 'gerber_zip') {
      setPreview(null);
      return () => {};
    }
    buildPreviewFromRemoteFile(gerberFile)
      .then((nextPreview) => {
        if (active) setPreview(nextPreview);
      })
      .catch(() => {
        if (active) setPreview({ kind: 'unavailable' });
      });
    return () => {
      active = false;
    };
  }, [gerberFile?.url]);

  useEffect(() => {
    if (preview?.render) drawBoardPreview(canvasRef.current, preview.render);
  }, [preview]);

  if (!gerberFile || inferFileGroup(gerberFile) !== 'gerber_zip') {
    return <div className="project-card-thumbnail project-card-thumbnail-empty">No Gerber preview</div>;
  }

  if (!preview?.render) {
    return <div className="project-card-thumbnail project-card-thumbnail-empty">Generating board preview…</div>;
  }

  return (
    <div className="project-card-thumbnail">
      <canvas ref={canvasRef} className="project-card-thumbnail-canvas" width="560" height="320" />
    </div>
  );
}

function ProjectCard({ project, onDelete, deleting = false }) {
  return (
    <article className="project-card">
      <ProjectBoardThumbnail project={project} />
      <div className="project-card-top">
        <div>
          <div className="card-eyebrow">{project.category || 'General'}</div>
          <h3>{project.title}</h3>
        </div>
        <span className="chip chip-muted">{project.tool}</span>
      </div>
      <p className="project-summary">{project.summary}</p>
      <div className="tag-row">{(project.tags || []).slice(0, 4).map((tag) => <span key={tag} className="chip chip-soft">{tag}</span>)}</div>
      <div className="project-card-footer">
        <div>
          <strong>{project.authorName || 'OpenPCB creator'}</strong>
          <p>Updated {formatDate(project.updated)}</p>
        </div>
        <div className="button-row">
          <Link className="inline-action" to={`/project/${project.slug}`}>View project <ArrowUpRight size={16} /></Link>
          {onDelete ? (
            <button type="button" className="icon-action icon-action-danger" onClick={() => onDelete(project)} disabled={deleting}>
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function UploadBucket({ icon, title, help, accept, multiple = false, required = false, onChange, files }) {
  return (
    <label className="upload-bucket">
      <div className="upload-bucket-header">
        <div className="upload-bucket-title-row">
          {icon}
          <strong>{title}</strong>
          {required ? <span className="chip chip-soft">Required</span> : null}
        </div>
        <p>{help}</p>
      </div>
      <input type="file" accept={accept} multiple={multiple} onChange={onChange} />
      {files?.length ? (
        <div className="selected-file-list">
          {files.map((file) => <span key={`${file.name}-${file.size}`} className="selected-file-pill">{file.name}</span>)}
        </div>
      ) : null}
    </label>
  );
}

function Navbar() {
  const items = [{ to: '/', label: 'Home' }, { to: '/explore', label: 'Explore' }, { to: '/publish', label: 'Upload' }, { to: '/dashboard', label: 'Dashboard' }];
  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Link to="/" className="brand-mark">
          <span className="brand-icon">◫</span>
          <div><strong>OpenPCB</strong></div>
        </Link>
        <nav className="nav-links">{items.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}>{item.label}</NavLink>)}</nav>
        <div className="nav-auth-area">
          <SignedOut>
            <SignInButton mode="modal"><button className="button button-secondary">Sign in</button></SignInButton>
            <SignUpButton mode="modal"><button className="button button-primary">Create account</button></SignUpButton>
          </SignedOut>
          <SignedIn><UserButton /></SignedIn>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-shell">
        <div>
          <div className="brand-mark">
            <span className="brand-icon">◫</span>
            <div><strong>OpenPCB</strong><span>Upload project files, browse open boards, and reuse real hardware faster.</span></div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function HomePage({ projects, loading }) {
  const recent = projects.slice(0, 3);
  return (
    <>
      <section className="hero-section">
        <div className="container hero-copy-shell">
          <div className="hero-badge">Open-source PCB sharing</div>
          <h1>Upload board files. Explore open hardware. Reuse real designs.</h1>
          <p className="hero-copy">OpenPCB is a cleaner front end for publishing PCB projects, previewing files, and discovering reusable board designs without surfacing backend internals to users.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/publish">Upload a project</Link>
            <Link className="button button-secondary" to="/explore">Browse open boards</Link>
          </div>
          {!API_BASE_URL ? <div className="status-banner status-banner-warning">Connect the frontend to your live data source to show public projects here.</div> : null}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Core flow</span>
            <h2>Keep the homepage focused on what people can do.</h2>
          </div>
          <div className="feature-grid">
            <article className="feature-card"><Files size={20} /><h3>Upload project files</h3><p>Share schematics, layouts, Gerbers, PDFs, renders, and documentation in one place.</p></article>
            <article className="feature-card"><Layers3 size={20} /><h3>Browse open boards</h3><p>Search public projects by title, tool, category, author, or tags and jump into the files fast.</p></article>
            <article className="feature-card"><Rocket size={20} /><h3>Fork and build faster</h3><p>Reuse existing hardware work as a starting point instead of rebuilding projects from scratch.</p></article>
          </div>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <div className="ad-slot ad-slot-banner">
            <span className="eyebrow">Optional sponsor area</span>
            <h3>Add one wide ad or sponsor banner here.</h3>
            <p>This placement sits between major content sections, so it stays visible without interrupting uploads or project browsing.</p>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Visual section</span>
            <h2>Use background imagery to make the site feel more like hardware.</h2>
            <p className="hero-copy">This section is a good place for full-width board photography, PCB macro shots, assembly scenes, or a collage of featured projects.</p>
          </div>
          <div className="background-image-panel">
            <div className="background-image-panel-inner">
              <ImageIcon size={22} />
              <div>
                <strong>Background image section</strong>
                <p>Drop in one strong background image or layer multiple featured board renders here.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading section-heading-inline">
            <div>
              <span className="eyebrow">Recent projects</span>
              <h2>Latest public uploads</h2>
            </div>
            <Link className="inline-action" to="/explore">See everything <ArrowRight size={16} /></Link>
          </div>
          {loading ? <div className="empty-state">Loading public projects…</div> : recent.length ? <div className="project-grid">{recent.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state">No public projects yet.</div>}
        </div>
      </section>

      <section className="section section-tight">
        <div className="container sponsor-grid">
          <div className="ad-slot">
            <span className="eyebrow">Optional partner slot</span>
            <p>Add a compact sponsor card for tools, fabs, or component partners.</p>
          </div>
          <div className="ad-slot">
            <span className="eyebrow">Optional partner slot</span>
            <p>Use this for a second sponsor or a house ad for featured projects or premium listings.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function ExplorePage({ projects, loading, error }) {
  const [query, setQuery] = useState('');
  const [toolFilter, setToolFilter] = useState('All');
  const filtered = useMemo(() => projects.filter((project) => {
    const haystack = [project.title, project.summary, project.authorName, ...(project.tags || []), project.category].join(' ').toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (toolFilter === 'All' || project.tool === toolFilter);
  }), [projects, query, toolFilter]);

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">Explore</span>
          <h1>Search public PCB projects</h1>
          <p className="hero-copy">Search, filter, and jump straight into project pages and downloadable files.</p>
        </div>
        <div className="filters-shell">
          <label className="field">
            <span>Search</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, summary, author, or tag" />
          </label>
          <label className="field">
            <span>Tool</span>
            <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)}>
              <option>All</option>
              <option>KiCad</option>
              <option>Altium</option>
              <option>Eagle</option>
              <option>Other</option>
            </select>
          </label>
        </div>
        {error ? <div className="status-banner status-banner-error">{error}</div> : null}
        {loading ? <div className="empty-state">Loading public projects…</div> : filtered.length ? <div className="project-grid">{filtered.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state">No projects match that search yet.</div>}
      </div>
    </section>
  );
}

function PublishPage({ refreshProjects }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [formState, setFormState] = useState({ title: '', authorName: '', tool: 'KiCad', license: 'CERN-OHL-S', summary: '', description: '', tags: '', category: 'General', isPublic: true });
  const [gerberZipFile, setGerberZipFile] = useState(null);
  const [documentationFiles, setDocumentationFiles] = useState([]);
  const [projectFiles, setProjectFiles] = useState([]);
  const [gerberPreview, setGerberPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      authorName: user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || current.authorName,
    }));
  }, [user]);

  const totalSizeLabel = useMemo(() => {
    const allFiles = [gerberZipFile, ...documentationFiles, ...projectFiles].filter(Boolean);
    const bytes = allFiles.reduce((sum, file) => sum + file.size, 0);
    if (!bytes) return 'No files selected';
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB total` : `${(bytes / (1024 * 1024)).toFixed(1)} MB total`;
  }, [gerberZipFile, documentationFiles, projectFiles]);

  function onChange(event) {
    const { name, value, type, checked } = event.target;
    setFormState((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function onGerberChange(event) {
    const file = event.target.files?.[0] || null;
    setGerberZipFile(file);
    setMessage('');
    if (!file) {
      setGerberPreview(null);
      return;
    }
    setGerberPreview(await buildFilePreview(file, 'gerber_zip'));
  }

  function onDocumentationChange(event) {
    setDocumentationFiles(Array.from(event.target.files || []));
    setMessage('');
  }

  function onProjectFilesChange(event) {
    setProjectFiles(Array.from(event.target.files || []));
    setMessage('');
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (!gerberZipFile) throw new Error('A Gerber ZIP is required.');
      const token = await getToken();
      if (!token) throw new Error('You must be signed in to publish a project.');
      const formData = new FormData();
      formData.append('payload', JSON.stringify({ ...formState, tags: parseTags(formState.tags) }));
      formData.append('gerberZip', gerberZipFile);
      documentationFiles.forEach((file) => formData.append('documentationFiles', file));
      projectFiles.forEach((file) => formData.append('projectFiles', file));
      await request('/api/projects', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      setMessage('Project published. Redirecting to your dashboard…');
      await refreshProjects();
      setTimeout(() => navigate('/dashboard'), 700);
    } catch (error) {
      setMessage(error.message || 'Could not publish this project.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section">
      <div className="container publish-layout">
        <div>
          <div className="section-heading">
            <span className="eyebrow">Upload</span>
            <h1>Publish a hardware project.</h1>
            <p className="hero-copy">Use the Gerber ZIP as the main required upload, then add documentation and project files if you want. The board preview is generated from the Gerber ZIP bundle.</p>
          </div>
          {gerberPreview ? <FilePreview preview={gerberPreview} /> : <div className="empty-state">Add a Gerber ZIP to generate the board preview.</div>}
        </div>
        <div>
          <SignedOut>
            <div className="hero-surface">
              <h3>Sign in first</h3>
              <p>You need an account to publish and own a project.</p>
              <SignInButton mode="modal"><button className="button button-primary">Sign in</button></SignInButton>
            </div>
          </SignedOut>
          <SignedIn>
            <form className="publish-form" onSubmit={onSubmit}>
              <div className="form-grid">
                <label className="field"><span>Project title</span><input required name="title" value={formState.title} onChange={onChange} /></label>
                <label className="field"><span>Author name</span><input required name="authorName" value={formState.authorName} onChange={onChange} /></label>
                <label className="field"><span>EDA tool</span><select name="tool" value={formState.tool} onChange={onChange}><option>KiCad</option><option>Altium</option><option>Eagle</option><option>Other</option></select></label>
                <label className="field"><span>License</span><select name="license" value={formState.license} onChange={onChange}><option>CERN-OHL-S</option><option>CERN-OHL-W</option><option>MIT</option><option>Apache-2.0</option><option>GPL-3.0</option></select></label>
              </div>
              <label className="field"><span>Short summary</span><textarea required name="summary" value={formState.summary} onChange={onChange} rows="3" /></label>
              <label className="field"><span>Detailed description</span><textarea name="description" value={formState.description} onChange={onChange} rows="5" /></label>
              <div className="form-grid">
                <label className="field"><span>Tags</span><input name="tags" value={formState.tags} onChange={onChange} placeholder="RFID, audio, Linux SBC" /></label>
                <label className="field"><span>Category</span><input name="category" value={formState.category} onChange={onChange} placeholder="RF, Audio, Power" /></label>
              </div>
              <div className="upload-bucket-grid">
                <UploadBucket
                  icon={<Archive size={18} />}
                  title="Gerber ZIP"
                  help="Required. Upload the zipped manufacturing package that should drive the board preview."
                  accept=".zip"
                  onChange={onGerberChange}
                  files={gerberZipFile ? [gerberZipFile] : []}
                  required
                />
                <UploadBucket
                  icon={<FileText size={18} />}
                  title="Documentation"
                  help="Optional. PDFs, images, notes, assembly instructions, or other documentation."
                  accept=".pdf,.md,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp,.svg"
                  multiple
                  onChange={onDocumentationChange}
                  files={documentationFiles}
                />
                <UploadBucket
                  icon={<FolderOpen size={18} />}
                  title="Project files / other"
                  help="Optional. Native CAD files, schematics, source files, and anything else useful to builders."
                  accept=".kicad_pcb,.kicad_sch,.sch,.pcbdoc,.prjpcb,.zip,.step,.stp,.brd,.dsn,.txt"
                  multiple
                  onChange={onProjectFilesChange}
                  files={projectFiles}
                />
              </div>
              <label className="toggle-row">
                <div><strong>Publish publicly</strong><p>Public projects appear in Explore immediately.</p></div>
                <input type="checkbox" name="isPublic" checked={formState.isPublic} onChange={onChange} />
              </label>
              <div className="status-inline">
                <span>{[gerberZipFile, ...documentationFiles, ...projectFiles].filter(Boolean).length} file{[gerberZipFile, ...documentationFiles, ...projectFiles].filter(Boolean).length === 1 ? '' : 's'} selected</span>
                <span>{totalSizeLabel}</span>
              </div>
              {message ? <div className={message.includes('published') ? 'status-banner status-banner-success' : 'status-banner status-banner-error'}>{message}</div> : null}
              <button className="button button-primary" type="submit" disabled={saving || !API_BASE_URL}>{saving ? 'Publishing…' : 'Publish project'}</button>
            </form>
          </SignedIn>
        </div>
      </div>
    </section>
  );
}

function ProjectPage({ refreshProjects }) {
  const { projectId } = useParams();
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    request(`/api/projects/${encodeURIComponent(projectId)}`)
      .then(async (nextProject) => {
        if (!active) return;
        setProject(nextProject);
        const primaryFile = getPrimaryGerberFile(nextProject.files || []);
        if (primaryFile) {
          setSelectedFileId(primaryFile.id);
          try {
            if (active) setPreview(await buildPreviewFromRemoteFile(primaryFile));
          } catch {
            if (active) setPreview(null);
          }
        }
      })
      .catch((error) => active && setMessage(error.message || 'Could not load the project.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId]);

  async function handleFork() {
    setMessage('');
    try {
      const token = await getToken();
      if (!token) throw new Error('You must be signed in to fork this project.');
      const forked = await request(`/api/projects/${encodeURIComponent(project.id)}/fork`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      setMessage(`Forked to your dashboard as "${forked.title}".`);
      await refreshProjects();
    } catch (error) {
      setMessage(error.message || 'Could not fork this project.');
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setMessage('');
    try {
      const token = await getToken();
      if (!token) throw new Error('You must be signed in to delete this project.');
      await request(`/api/projects/${encodeURIComponent(project.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await refreshProjects();
      navigate('/dashboard');
    } catch (error) {
      setMessage(error.message || 'Could not delete this project.');
    } finally {
      setDeleting(false);
    }
  }

  async function selectFile(file) {
    setSelectedFileId(file.id);
    try {
      setPreview(await buildPreviewFromRemoteFile(file));
    } catch {
      setPreview(null);
    }
  }

  if (loading) return <section className="section"><div className="container"><div className="empty-state">Loading project…</div></div></section>;
  if (!project) return <section className="section"><div className="container"><div className="status-banner status-banner-error">{message || 'Project not found.'}</div></div></section>;

  const isOwner = Boolean(user?.id && project.ownerClerkId === user.id);
  const filesByGroup = groupFiles(project.files || []);

  return (
    <section className="section">
      <div className="container project-layout">
        <div>
          <div className="hero-surface">
            <div className="project-hero-top">
              <div>
                <div className="hero-badge">{project.category || 'General'}</div>
                <h1>{project.title}</h1>
                <p className="hero-copy">{project.description || project.summary}</p>
              </div>
              <div className="project-meta-box">
                <span className="chip chip-muted">{project.tool}</span>
                <span className="chip chip-muted">{project.license}</span>
              </div>
            </div>
            <div className="meta-grid">
              <div><span className="meta-label">Author</span><strong>{project.authorName || 'OpenPCB creator'}</strong></div>
              <div><span className="meta-label">Updated</span><strong>{formatDate(project.updated)}</strong></div>
              <div><span className="meta-label">Files</span><strong>{project.files?.length || 0}</strong></div>
            </div>
            <div className="tag-row">{(project.tags || []).map((tag) => <span key={tag} className="chip chip-soft">{tag}</span>)}</div>
            <div className="button-row">
              <SignedIn>
                {!isOwner ? <button className="button button-primary" onClick={handleFork}><GitFork size={16} />Fork project</button> : <Link className="button button-secondary" to="/dashboard">Go to dashboard</Link>}
                {isOwner ? <button type="button" className="button button-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete project'}</button> : null}
              </SignedIn>
              <SignedOut><SignInButton mode="modal"><button className="button button-primary">Sign in to fork</button></SignInButton></SignedOut>
            </div>
            {message ? <div className={message.includes('Forked') ? 'status-banner status-banner-success' : 'status-banner status-banner-error'}>{message}</div> : null}
          </div>
          {preview ? <FilePreview preview={preview} /> : null}
        </div>
        <aside className="sidebar-card">
          <h3>Project files</h3>
          {['gerber_zip', 'documentation', 'project_files'].map((group) => filesByGroup[group]?.length ? (
            <div key={group} className="file-group">
              <div className="file-group-title">{fileGroupLabel(group)}</div>
              <div className="field">
                {filesByGroup[group].map((file) => (
                  <button key={file.id} className={selectedFileId === file.id ? 'file-row file-row-active' : 'file-row'} onClick={() => selectFile(file)}>
                    <span>{file.name}</span>
                    <span>{file.sizeLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null)}
          <div className="field">
            {(project.files || []).map((file) => <a key={`download-${file.id}`} className="download-link" href={file.url} target="_blank" rel="noreferrer"><Download size={14} />Download {file.name}</a>)}
          </div>
        </aside>
      </div>
    </section>
  );
}

function DashboardPage({ projects, loading, error, refreshProjects }) {
  const { getToken } = useAuth();
  const [deletingId, setDeletingId] = useState('');

  async function handleDelete(project) {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    setDeletingId(project.id);
    try {
      const token = await getToken();
      if (!token) throw new Error('You must be signed in to delete this project.');
      await request(`/api/projects/${encodeURIComponent(project.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await refreshProjects();
    } finally {
      setDeletingId('');
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading section-heading-inline">
          <div>
            <span className="eyebrow">Dashboard</span>
            <h1>Your projects</h1>
            <p className="hero-copy">Everything you have published or forked lives here.</p>
          </div>
          <Link className="button button-primary" to="/publish">Upload another project</Link>
        </div>
        <SignedOut>
          <div className="hero-surface">
            <h3>Sign in to view your dashboard</h3>
            <SignInButton mode="modal"><button className="button button-primary">Sign in</button></SignInButton>
          </div>
        </SignedOut>
        <SignedIn>
          {error ? <div className="status-banner status-banner-error">{error}</div> : null}
          {loading ? <div className="empty-state">Loading your projects…</div> : projects.length ? <div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} onDelete={handleDelete} deleting={deletingId === project.id} />)}</div> : <div className="empty-state">You have not published anything yet.</div>}
        </SignedIn>
      </div>
    </section>
  );
}

function LoginPage() {
  return (
    <section className="section">
      <div className="container">
        <SignedOut>
          <div className="auth-card">
            <div className="section-heading">
              <span className="eyebrow">Account</span>
              <h1>Sign in to publish, fork, and manage projects</h1>
              <p className="hero-copy">Use your account to upload boards, save work, and manage your projects.</p>
            </div>
            <SignInButton mode="modal"><button className="button button-primary">Sign in</button></SignInButton>
          </div>
        </SignedOut>
        <SignedIn>
          <div className="auth-card">
            <div className="section-heading">
              <span className="eyebrow">Account</span>
              <h1>Manage your profile</h1>
            </div>
            <UserProfile />
          </div>
        </SignedIn>
      </div>
    </section>
  );
}

export default function App() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [projects, setProjects] = useState([]);
  const [userProjects, setUserProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  async function refreshProjects() {
    if (!API_BASE_URL) {
      setProjects([]);
      setUserProjects([]);
      setProjectsLoading(false);
      setDashboardLoading(false);
      return;
    }
    setProjectsLoading(true);
    setProjectsError('');
    try {
      setProjects(await request('/api/projects'));
    } catch (error) {
      setProjectsError(error.message || 'Could not load projects.');
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
    if (!user?.id) {
      setUserProjects([]);
      setDashboardLoading(false);
      return;
    }
    setDashboardLoading(true);
    try {
      const token = await getToken();
      setUserProjects(token ? await request('/api/users/me/projects', { headers: { Authorization: `Bearer ${token}` } }) : []);
    } catch {
      setUserProjects([]);
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    refreshProjects();
  }, [user?.id]);

  return (
    <ClerkLoaded>
      <div className="app-shell">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<HomePage projects={projects.slice(0, 3)} loading={projectsLoading} />} />
            <Route path="/explore" element={<ExplorePage projects={projects} loading={projectsLoading} error={projectsError} />} />
            <Route path="/project/:projectId" element={<ProjectPage refreshProjects={refreshProjects} />} />
            <Route path="/publish" element={<PublishPage refreshProjects={refreshProjects} />} />
            <Route path="/dashboard" element={<DashboardPage projects={userProjects} loading={dashboardLoading} error={projectsError} refreshProjects={refreshProjects} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<section className="section"><div className="container"><div className="empty-state"><h2>That page does not exist.</h2><Link className="button button-primary" to="/explore">Go to Explore</Link></div></div></section>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </ClerkLoaded>
  );
}
