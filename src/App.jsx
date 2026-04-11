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
import { ArrowRight, ArrowUpRight, Boxes, Download, Files, GitFork, ShieldCheck } from 'lucide-react';
import JSZip from 'jszip';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
  let value = bytes; let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fileExt(name = '') { return name.split('.').pop()?.toLowerCase() || ''; }
const GERBER_EXTENSIONS = ['gbr', 'gtl', 'gbl', 'gto', 'gbo', 'gko', 'gm1', 'gml', 'pho', 'art', 'cmp', 'sol'];
const DRILL_EXTENSIONS = ['drl', 'xln', 'txt'];
function isDrillName(name = '') { const lower = name.toLowerCase(); return lower.includes('drill') || lower.endsWith('.drl') || lower.endsWith('.xln'); }

function createGerberRenderData(text, isDrill = false) {
  const commands = [], flashes = [], drills = [];
  const apertureMap = new Map();
  let currentAperture = '10', currentX = 0, currentY = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const apertureDef = line.match(/%ADD(\d+)([A-Z]),?([0-9.]+)?/);
    if (apertureDef) { apertureMap.set(apertureDef[1], { shape: apertureDef[2], size: Number(apertureDef[3] || 1500) }); continue; }
    const selectAperture = line.match(/^D(\d+)\*$/);
    if (selectAperture && Number(selectAperture[1]) >= 10) { currentAperture = selectAperture[1]; continue; }
    if (isDrill) {
      const drill = line.match(/^X(-?\d+)Y(-?\d+)/);
      if (drill) {
        const x = Number(drill[1]), y = Number(drill[2]);
        drills.push({ x, y, r: 1200 });
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      continue;
    }
    const draw = line.match(/^(?:G0[123])?X(-?\d+)Y(-?\d+)(?:D0([123]))?\*$/);
    if (!draw) continue;
    const x = Number(draw[1]), y = Number(draw[2]), op = draw[3] || '1';
    const aperture = apertureMap.get(currentAperture) || { size: 1500, shape: 'C' };
    if (op === '2') { currentX = x; currentY = y; }
    else if (op === '1') { commands.push({ x1: currentX, y1: currentY, x2: x, y2: y, width: aperture.size || 1500 }); currentX = x; currentY = y; }
    else if (op === '3') { flashes.push({ x, y, r: aperture.size || 1500, shape: aperture.shape || 'C' }); currentX = x; currentY = y; }
    minX = Math.min(minX, x, currentX); minY = Math.min(minY, y, currentY); maxX = Math.max(maxX, x, currentX); maxY = Math.max(maxY, y, currentY);
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 100000; maxY = 100000; }
  return { bounds: { minX, minY, maxX, maxY }, commands, flashes, drills };
}

function mergeRenderData(items) {
  const merged = { bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }, commands: [], flashes: [], drills: [] };
  for (const item of items) {
    merged.commands.push(...item.commands); merged.flashes.push(...item.flashes); merged.drills.push(...item.drills);
    merged.bounds.minX = Math.min(merged.bounds.minX, item.bounds.minX);
    merged.bounds.minY = Math.min(merged.bounds.minY, item.bounds.minY);
    merged.bounds.maxX = Math.max(merged.bounds.maxX, item.bounds.maxX);
    merged.bounds.maxY = Math.max(merged.bounds.maxY, item.bounds.maxY);
  }
  if (!Number.isFinite(merged.bounds.minX)) merged.bounds = { minX: 0, minY: 0, maxX: 100000, maxY: 100000 };
  return merged;
}

async function buildFilePreview(file) {
  const extension = fileExt(file.name);
  const isImage = (file.type || '').startsWith('image/') || ['png','jpg','jpeg','webp','gif','svg'].includes(extension);
  const isPdf = file.type === 'application/pdf' || extension === 'pdf';
  const base = { name: file.name, sizeLabel: bytesToLabel(file.size), kind: extension || 'file' };
  if (isImage || isPdf) return { ...base, kind: isImage ? 'image' : 'pdf', objectUrl: URL.createObjectURL(file) };
  if (extension === 'zip') {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const layers = [];
    for (const entry of entries) {
      const ext = fileExt(entry.name);
      if (GERBER_EXTENSIONS.includes(ext) || (DRILL_EXTENSIONS.includes(ext) && isDrillName(entry.name))) {
        layers.push({ name: entry.name, text: await entry.async('text'), isDrill: DRILL_EXTENSIONS.includes(ext) && isDrillName(entry.name) });
      }
    }
    if (layers.length) {
      return {
        ...base,
        kind: 'zip-gerber',
        layers: layers.map((layer) => layer.name),
        render: mergeRenderData(layers.map((layer) => createGerberRenderData(layer.text, layer.isDrill))),
        text: layers.slice(0, 3).map((layer) => `### ${layer.name}\n${layer.text.slice(0, 700)}`).join('\n\n'),
        notes: [`${entries.length} files in bundle`, `${layers.length} renderable layers detected`],
      };
    }
    return { ...base, kind: 'zip', text: entries.map((entry) => entry.name).join('\n'), notes: [`${entries.length} files in bundle`, 'No Gerber or drill layers detected'] };
  }
  const text = await file.text();
  if (GERBER_EXTENSIONS.includes(extension) || (DRILL_EXTENSIONS.includes(extension) && isDrillName(file.name))) {
    return { ...base, kind: GERBER_EXTENSIONS.includes(extension) ? 'gerber' : 'drill', render: createGerberRenderData(text, !GERBER_EXTENSIONS.includes(extension)), text };
  }
  return { ...base, kind: extension || 'text', text };
}

async function buildPreviewFromRemoteFile(fileDescriptor) {
  const response = await fetch(fileDescriptor.url);
  if (!response.ok) throw new Error(`Could not load ${fileDescriptor.name}.`);
  const blob = await response.blob();
  return buildFilePreview(new File([blob], fileDescriptor.name, { type: fileDescriptor.mimeType || blob.type || 'application/octet-stream' }));
}

function drawGerberPreview(canvas, renderData) {
  if (!canvas || !renderData) return;
  const ctx = canvas.getContext('2d');
  const { minX, minY, maxX, maxY } = renderData.bounds;
  const width = Math.max(maxX - minX, 1), height = Math.max(maxY - minY, 1), padding = 24;
  const scale = Math.min((canvas.width - padding * 2) / width, (canvas.height - padding * 2) / height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#08131c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.translate(padding, canvas.height - padding); ctx.scale(scale, -scale); ctx.translate(-minX, -minY);
  ctx.strokeStyle = '#6ef0c2'; ctx.fillStyle = '#6ef0c2'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const command of renderData.commands) { ctx.lineWidth = Math.max(command.width / 1000, 0.6 / scale); ctx.beginPath(); ctx.moveTo(command.x1, command.y1); ctx.lineTo(command.x2, command.y2); ctx.stroke(); }
  ctx.fillStyle = '#9ff7dd';
  for (const flash of renderData.flashes) { const radius = Math.max(flash.r / 2000, 0.8 / scale); ctx.beginPath(); ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#6fb7ff';
  for (const drill of renderData.drills) { const radius = Math.max(drill.r / 2000, 0.8 / scale); ctx.beginPath(); ctx.arc(drill.x, drill.y, radius, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function FilePreview({ preview }) {
  const canvasRef = useRef(null);
  useEffect(() => { if (preview?.render && ['gerber', 'drill', 'zip-gerber'].includes(preview.kind)) drawGerberPreview(canvasRef.current, preview.render); }, [preview]);
  useEffect(() => () => { if (preview?.objectUrl) URL.revokeObjectURL(preview.objectUrl); }, [preview]);
  if (!preview) return null;
  return (
    <article className="preview-card">
      <div className="preview-card-header">
        <div><strong>{preview.name}</strong><p>{preview.sizeLabel}</p></div>
        <span className="chip chip-muted">{preview.kind}</span>
      </div>
      {preview.kind === 'image' ? <img className="preview-image" src={preview.objectUrl} alt={preview.name} /> : null}
      {preview.kind === 'pdf' ? <iframe className="preview-frame" title={preview.name} src={preview.objectUrl} /> : null}
      {['gerber', 'drill', 'zip-gerber'].includes(preview.kind) ? <canvas ref={canvasRef} className="preview-canvas" width="860" height="520" /> : null}
      {preview.layers?.length ? <div className="tag-row">{preview.layers.map((layer) => <span key={layer} className="chip chip-soft">{layer}</span>)}</div> : null}
      {preview.notes?.length ? <div className="tag-row">{preview.notes.map((note) => <span key={note} className="chip chip-soft">{note}</span>)}</div> : null}
      {preview.text && !['image','pdf'].includes(preview.kind) ? <pre className="code-panel">{preview.text.slice(0, 2400)}</pre> : null}
    </article>
  );
}

function ProjectCard({ project }) {
  return (
    <article className="project-card">
      <div className="project-card-top">
        <div><div className="card-eyebrow">{project.category || 'General'}</div><h3>{project.title}</h3></div>
        <span className="chip chip-muted">{project.tool}</span>
      </div>
      <p className="project-summary">{project.summary}</p>
      <div className="tag-row">{(project.tags || []).slice(0, 4).map((tag) => <span key={tag} className="chip chip-soft">{tag}</span>)}</div>
      <div className="project-card-footer">
        <div><strong>{project.authorName || 'OpenPCB creator'}</strong><p>Updated {formatDate(project.updated)}</p></div>
        <Link className="inline-action" to={`/project/${project.slug}`}>View project <ArrowUpRight size={16} /></Link>
      </div>
    </article>
  );
}

function Navbar() {
  const { user } = useUser();
  const items = [{to:'/',label:'Home'},{to:'/explore',label:'Explore'},{to:'/publish',label:'Publish'},{to:'/dashboard',label:'Dashboard'},{to:'/login',label:'Account'}];
  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Link to="/" className="brand-mark"><span className="brand-icon">◫</span><div><strong>OpenPCB</strong><span>Share real hardware files with less friction</span></div></Link>
        <nav className="nav-links">{items.map((item) => <NavLink key={item.to} to={item.to} className={({isActive}) => isActive ? 'nav-link nav-link-active' : 'nav-link'}>{item.label}</NavLink>)}</nav>
        <div className="nav-auth-area">
          <div className="nav-user-chip"><SignedOut><span>Guest mode</span></SignedOut><SignedIn><span>{user?.fullName || user?.username || 'Signed in'}</span></SignedIn></div>
          <div className="nav-auth-buttons">
            <SignedOut>
              <SignInButton mode="modal"><button className="button button-secondary">Sign in</button></SignInButton>
              <SignUpButton mode="modal"><button className="button button-primary">Create account</button></SignUpButton>
            </SignedOut>
            <SignedIn><UserButton /></SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return <footer className="site-footer"><div className="container footer-shell"><div><div className="brand-mark"><span className="brand-icon">◫</span><div><strong>OpenPCB</strong><span>Clerk for identity. PocketBase for cloud records and files.</span></div></div><p>Cleaner publishing, multi-file uploads, and browser Gerber rendering.</p></div></div></footer>;
}

function HomePage({ projects, loading }) {
  const recent = projects.slice(0, 3);
  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div>
            <div className="hero-badge">Open hardware, cleaned up</div>
            <h1>Publish PCB work that is actually reusable.</h1>
            <p className="hero-copy">OpenPCB now has a sleeker file flow: multiple uploads, Gerber zip rendering, and a cleaner path from discovery to reuse.</p>
            <div className="hero-actions"><Link className="button button-primary" to="/publish">Publish a project</Link><Link className="button button-secondary" to="/explore">Browse public boards</Link></div>
            {!API_BASE_URL ? <div className="status-banner status-banner-warning">Add <code>VITE_API_BASE_URL</code> and rebuild to load live data.</div> : null}
          </div>
          <div className="hero-panel">
            <div className="hero-stat-grid">
              <div className="stat-card"><span className="stat-label">Projects</span><strong>{loading ? '…' : projects.length}</strong></div>
              <div className="stat-card"><span className="stat-label">Upload flow</span><strong>Multi-file</strong></div>
              <div className="stat-card"><span className="stat-label">Gerber bundles</span><strong>Rendered</strong></div>
              <div className="stat-card"><span className="stat-label">Auth</span><strong>Clerk</strong></div>
            </div>
            <div className="hero-diagram"><div className="hero-diagram-node">Clerk</div><div className="hero-diagram-node">API</div><div className="hero-diagram-node">PocketBase</div><div className="hero-diagram-node">File previews</div></div>
          </div>
        </div>
      </section>
      <section className="section"><div className="container"><div className="section-heading"><span className="eyebrow">Why it feels better</span><h2>Cleaner flow, less UI clutter.</h2></div><div className="feature-grid"><article className="feature-card"><Files size={20} /><h3>File-first publishing</h3><p>Upload multiple files in one pass instead of forcing a single archive.</p></article><article className="feature-card"><Boxes size={20} /><h3>Gerber zip rendering</h3><p>Gerber and drill files inside a zip bundle are parsed together and rendered in-browser.</p></article><article className="feature-card"><ShieldCheck size={20} /><h3>Clerk stays in place</h3><p>Identity remains polished while writes move behind a small API so PocketBase can stay private.</p></article></div></div></section>
      <section className="section section-soft"><div className="container"><div className="section-heading section-heading-inline"><div><span className="eyebrow">Recent projects</span><h2>Latest public uploads</h2></div><Link className="inline-action" to="/explore">See everything <ArrowRight size={16} /></Link></div>{loading ? <div className="empty-state">Loading public projects…</div> : recent.length ? <div className="project-grid">{recent.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state">No public projects yet.</div>}</div></section>
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
  return <section className="section"><div className="container"><div className="section-heading"><span className="eyebrow">Explore</span><h1>Search public PCB projects</h1><p className="hero-copy">The browsing flow is flatter now: search, filter, and jump straight into the project page.</p></div><div className="filters-shell"><label className="field"><span>Search</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, summary, author, or tag" /></label><label className="field"><span>Tool</span><select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)}><option>All</option><option>KiCad</option><option>Altium</option><option>Eagle</option><option>Other</option></select></label></div>{error ? <div className="status-banner status-banner-error">{error}</div> : null}{loading ? <div className="empty-state">Loading public projects…</div> : filtered.length ? <div className="project-grid">{filtered.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state">No projects match that search yet.</div>}</div></section>;
}

function PublishPage({ refreshProjects }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [formState, setFormState] = useState({ title: '', authorName: '', tool: 'KiCad', license: 'CERN-OHL-S', summary: '', description: '', tags: '', category: 'General', isPublic: true });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setFormState((current) => ({ ...current, authorName: user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || current.authorName })); }, [user]);
  const totalSizeLabel = useMemo(() => {
    const bytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (!bytes) return 'No files selected';
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB total` : `${(bytes / (1024 * 1024)).toFixed(1)} MB total`;
  }, [selectedFiles]);
  function onChange(event) { const { name, value, type, checked } = event.target; setFormState((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value })); }
  async function onFileChange(event) {
    const files = Array.from(event.target.files || []); setSelectedFiles(files); setMessage('');
    const nextPreviews = []; for (const file of files) nextPreviews.push(await buildFilePreview(file)); setPreviews(nextPreviews); setPreviewIndex(0);
  }
  async function onSubmit(event) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const token = await getToken(); if (!token) throw new Error('You must be signed in to publish a project.');
      const formData = new FormData(); formData.append('payload', JSON.stringify({ ...formState, tags: parseTags(formState.tags) })); selectedFiles.forEach((file) => formData.append('files', file));
      await request('/api/projects', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      setMessage('Project published. Redirecting to your dashboard…'); await refreshProjects(); setTimeout(() => navigate('/dashboard'), 700);
    } catch (error) { setMessage(error.message || 'Could not publish this project.'); } finally { setSaving(false); }
  }
  return <section className="section"><div className="container publish-layout"><div><div className="section-heading"><span className="eyebrow">Publish</span><h1>Ship a cleaner project page.</h1><p className="hero-copy">Upload multiple files, including Gerber zip bundles. If a zip contains Gerber and drill layers, OpenPCB renders the bundle before you publish it.</p></div>{previews.length ? <div className="hero-surface"><div className="preview-tab-row">{previews.map((preview, index) => <button key={`${preview.name}-${index}`} className={index === previewIndex ? 'preview-tab preview-tab-active' : 'preview-tab'} onClick={() => setPreviewIndex(index)}>{preview.name}</button>)}</div><FilePreview preview={previews[previewIndex]} /></div> : <div className="empty-state">Select one or more files to see previews before publishing.</div>}</div><div><SignedOut><div className="hero-surface"><h3>Sign in first</h3><p>You need a Clerk session to publish and own a project.</p><SignInButton mode="modal"><button className="button button-primary">Sign in</button></SignInButton></div></SignedOut><SignedIn><form className="publish-form" onSubmit={onSubmit}><div className="form-grid"><label className="field"><span>Project title</span><input required name="title" value={formState.title} onChange={onChange} /></label><label className="field"><span>Author name</span><input required name="authorName" value={formState.authorName} onChange={onChange} /></label><label className="field"><span>EDA tool</span><select name="tool" value={formState.tool} onChange={onChange}><option>KiCad</option><option>Altium</option><option>Eagle</option><option>Other</option></select></label><label className="field"><span>License</span><select name="license" value={formState.license} onChange={onChange}><option>CERN-OHL-S</option><option>CERN-OHL-W</option><option>MIT</option><option>Apache-2.0</option><option>GPL-3.0</option></select></label></div><label className="field"><span>Short summary</span><textarea required name="summary" value={formState.summary} onChange={onChange} rows="3" /></label><label className="field"><span>Detailed description</span><textarea name="description" value={formState.description} onChange={onChange} rows="5" /></label><div className="form-grid"><label className="field"><span>Tags</span><input name="tags" value={formState.tags} onChange={onChange} placeholder="RFID, audio, Linux SBC" /></label><label className="field"><span>Category</span><input name="category" value={formState.category} onChange={onChange} placeholder="RF, Audio, Power" /></label></div><label className="field"><span>Files</span><input type="file" multiple accept=".zip,.gbr,.gtl,.gbl,.gto,.gbo,.gko,.gm1,.gml,.pho,.art,.cmp,.sol,.drl,.xln,.txt,.kicad_pcb,.kicad_sch,.sch,.pcbdoc,.prjpcb,.pdf,.png,.jpg,.jpeg,.webp,.svg" onChange={onFileChange} /></label><label className="toggle-row"><div><strong>Publish publicly</strong><p>Public projects appear in Explore immediately.</p></div><input type="checkbox" name="isPublic" checked={formState.isPublic} onChange={onChange} /></label><div className="status-inline"><span>{selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected</span><span>{totalSizeLabel}</span></div>{message ? <div className={message.includes('published') ? 'status-banner status-banner-success' : 'status-banner status-banner-error'}>{message}</div> : null}<button className="button button-primary" type="submit" disabled={saving || !API_BASE_URL}>{saving ? 'Publishing…' : 'Publish project'}</button></form></SignedIn></div></div></section>;
}

function ProjectPage({ refreshProjects }) {
  const { projectId } = useParams();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [project, setProject] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    request(`/api/projects/${encodeURIComponent(projectId)}`).then(async (nextProject) => {
      if (!active) return; setProject(nextProject);
      const firstFile = nextProject.files?.[0];
      if (firstFile) { setSelectedFileId(firstFile.id); try { if (active) setPreview(await buildPreviewFromRemoteFile(firstFile)); } catch {} }
    }).catch((error) => active && setMessage(error.message || 'Could not load the project.')).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [projectId]);
  async function handleFork() {
    setMessage('');
    try {
      const token = await getToken(); if (!token) throw new Error('You must be signed in to fork this project.');
      const forked = await request(`/api/projects/${encodeURIComponent(project.id)}/fork`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      setMessage(`Forked to your dashboard as "${forked.title}".`); await refreshProjects();
    } catch (error) { setMessage(error.message || 'Could not fork this project.'); }
  }
  async function selectFile(file) { setSelectedFileId(file.id); try { setPreview(await buildPreviewFromRemoteFile(file)); } catch { setPreview(null); } }
  if (loading) return <section className="section"><div className="container"><div className="empty-state">Loading project…</div></div></section>;
  if (!project) return <section className="section"><div className="container"><div className="status-banner status-banner-error">{message || 'Project not found.'}</div></div></section>;
  const isOwner = Boolean(user?.id && project.ownerClerkId === user.id);
  return <section className="section"><div className="container project-layout"><div><div className="hero-surface"><div className="project-hero-top"><div><div className="hero-badge">{project.category || 'General'}</div><h1>{project.title}</h1><p className="hero-copy">{project.description || project.summary}</p></div><div className="project-meta-box"><span className="chip chip-muted">{project.tool}</span><span className="chip chip-muted">{project.license}</span></div></div><div className="meta-grid"><div><span className="meta-label">Author</span><strong>{project.authorName || 'OpenPCB creator'}</strong></div><div><span className="meta-label">Updated</span><strong>{formatDate(project.updated)}</strong></div><div><span className="meta-label">Files</span><strong>{project.files?.length || 0}</strong></div></div><div className="tag-row">{(project.tags || []).map((tag) => <span key={tag} className="chip chip-soft">{tag}</span>)}</div><div className="button-row"><SignedIn>{!isOwner ? <button className="button button-primary" onClick={handleFork}><GitFork size={16} />Fork project</button> : <Link className="button button-secondary" to="/dashboard">Go to dashboard</Link>}</SignedIn><SignedOut><SignInButton mode="modal"><button className="button button-primary">Sign in to fork</button></SignInButton></SignedOut></div>{message ? <div className={message.includes('Forked') ? 'status-banner status-banner-success' : 'status-banner status-banner-error'}>{message}</div> : null}</div>{preview ? <FilePreview preview={preview} /> : null}</div><aside className="sidebar-card"><h3>Project files</h3><div className="field">{project.files?.map((file) => <button key={file.id} className={selectedFileId === file.id ? 'file-row file-row-active' : 'file-row'} onClick={() => selectFile(file)}><span>{file.name}</span><span>{file.sizeLabel}</span></button>)}</div><div className="field">{project.files?.map((file) => <a key={`download-${file.id}`} className="download-link" href={file.url} target="_blank" rel="noreferrer"><Download size={14} />Download {file.name}</a>)}</div></aside></div></section>;
}

function DashboardPage({ projects, loading, error }) {
  return <section className="section"><div className="container"><div className="section-heading section-heading-inline"><div><span className="eyebrow">Dashboard</span><h1>Your projects</h1><p className="hero-copy">Everything you have published or forked lives here.</p></div><Link className="button button-primary" to="/publish">Publish another project</Link></div><SignedOut><div className="hero-surface"><h3>Sign in to view your dashboard</h3><SignInButton mode="modal"><button className="button button-primary">Sign in</button></SignInButton></div></SignedOut><SignedIn>{error ? <div className="status-banner status-banner-error">{error}</div> : null}{loading ? <div className="empty-state">Loading your projects…</div> : projects.length ? <div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state">You have not published anything yet.</div>}</SignedIn></div></section>;
}

function LoginPage() {
  return <section className="section"><div className="container"><SignedOut><div className="auth-card"><div className="section-heading"><span className="eyebrow">Account</span><h1>Sign in to publish or fork</h1><p className="hero-copy">Clerk still powers the login flow. All data writes happen through the backend API after sign-in.</p></div><SignInButton mode="modal"><button className="button button-primary">Sign in with Clerk</button></SignInButton></div></SignedOut><SignedIn><div className="auth-card"><div className="section-heading"><span className="eyebrow">Account</span><h1>Manage your profile</h1></div><UserProfile /></div></SignedIn></div></section>;
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
    if (!API_BASE_URL) { setProjects([]); setUserProjects([]); setProjectsLoading(false); setDashboardLoading(false); return; }
    setProjectsLoading(true); setProjectsError('');
    try { setProjects(await request('/api/projects')); } catch (error) { setProjectsError(error.message || 'Could not load projects.'); setProjects([]); } finally { setProjectsLoading(false); }
    if (!user?.id) { setUserProjects([]); setDashboardLoading(false); return; }
    setDashboardLoading(true);
    try { const token = await getToken(); setUserProjects(token ? await request('/api/users/me/projects', { headers: { Authorization: `Bearer ${token}` } }) : []); } catch { setUserProjects([]); } finally { setDashboardLoading(false); }
  }
  useEffect(() => { refreshProjects(); }, [user?.id]);
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
            <Route path="/dashboard" element={<DashboardPage projects={userProjects} loading={dashboardLoading} error={projectsError} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<section className="section"><div className="container"><div className="empty-state"><h2>That page does not exist.</h2><Link className="button button-primary" to="/explore">Go to Explore</Link></div></div></section>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </ClerkLoaded>
  );
}
