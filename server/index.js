import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import PocketBase from 'pocketbase';
import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 20, fileSize: 50 * 1024 * 1024 } });
const pb = new PocketBase(process.env.POCKETBASE_URL);
const { PORT = 8080, FRONTEND_ORIGIN = '*', POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD } = process.env;
const allowedOrigins = FRONTEND_ORIGIN === '*' ? [] : FRONTEND_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean);

app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : allowedOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(clerkMiddleware(allowedOrigins.length ? { authorizedParties: allowedOrigins } : {}));

async function ensurePocketBaseAdmin() {
  if (pb.authStore.isValid) return;
  await pb.collection('_superusers').authWithPassword(POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD);
}

function createSlug(text = '') {
  return String(text).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes, index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function mapProjectRecord(record) {
  const tags = parseJsonField(record.tags, []);
  const fileMeta = parseJsonField(record.fileMeta, []);
  const archiveNames = Array.isArray(record.archives) ? record.archives : [];
  const files = archiveNames.map((filename, index) => {
    const meta = fileMeta[index] || {};
    return {
      id: `${record.id}-${index}`,
      name: meta.originalName || filename,
      mimeType: meta.mimeType || 'application/octet-stream',
      size: Number(meta.size || 0),
      sizeLabel: formatBytes(Number(meta.size || 0)),
      url: pb.files.getURL(record, filename),
    };
  });
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    authorName: record.authorName,
    ownerClerkId: record.ownerClerkId,
    ownerEmail: record.ownerEmail,
    summary: record.summary,
    description: record.description,
    tool: record.tool,
    license: record.license,
    tags: Array.isArray(tags) ? tags : [],
    category: record.category,
    isPublic: Boolean(record.isPublic),
    forkedFrom: record.forkedFrom || null,
    files,
    created: record.created,
    updated: record.updated,
  };
}

async function requireSignedInUser(req) {
  const auth = getAuth(req, { acceptsToken: 'session_token' });
  if (!auth?.isAuthenticated || !auth.userId) {
    const error = new Error('You must be signed in.');
    error.statusCode = 401;
    throw error;
  }
  const user = await clerkClient.users.getUser(auth.userId);
  return {
    clerkId: auth.userId,
    email: user.primaryEmailAddress?.emailAddress || '',
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'OpenPCB user',
  };
}

async function getPublicProjectsViaPocketBase() {
  const response = await fetch(`${POCKETBASE_URL}/api/collections/projects/records?perPage=200`);
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.message || 'Could not fetch public projects from PocketBase.');
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }
  return payload?.items || [];
}

async function getAllProjectsAsAdmin() {
  await ensurePocketBaseAdmin();
  return pb.collection('projects').getFullList();
}

function sortNewestFirst(records) {
  return [...records].sort((a, b) => {
    const aTime = new Date(a.updated || a.created || 0).getTime();
    const bTime = new Date(b.updated || b.created || 0).getTime();
    return bTime - aTime;
  });
}

app.get('/health', async (_req, res, next) => {
  try {
    await ensurePocketBaseAdmin();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects', async (_req, res, next) => {
  try {
    const records = await getPublicProjectsViaPocketBase();
    const publicRecords = sortNewestFirst(records.filter((record) => Boolean(record.isPublic)));
    res.json(publicRecords.map(mapProjectRecord));
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects/:slug', async (req, res, next) => {
  try {
    const records = await getPublicProjectsViaPocketBase();
    const record = records.find((item) => item.slug === req.params.slug);
    if (!record) return res.status(404).json({ message: 'Project not found.' });
    res.json(mapProjectRecord(record));
  } catch (error) {
    next(error);
  }
});

app.get('/api/users/me/projects', async (req, res, next) => {
  try {
    const user = await requireSignedInUser(req);
    const records = await getAllProjectsAsAdmin();
    const mine = sortNewestFirst(records.filter((record) => record.ownerClerkId === user.clerkId));
    res.json(mine.map(mapProjectRecord));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects', upload.array('files', 20), async (req, res, next) => {
  try {
    const user = await requireSignedInUser(req);
    await ensurePocketBaseAdmin();
    const payload = JSON.parse(req.body.payload || '{}');
    const formData = new FormData();
    formData.append('slug', `${createSlug(payload.title || 'project')}-${Date.now()}`);
    formData.append('title', String(payload.title || '').trim());
    formData.append('authorName', String(payload.authorName || user.name).trim());
    formData.append('ownerClerkId', user.clerkId);
    formData.append('ownerEmail', user.email);
    formData.append('summary', String(payload.summary || '').trim());
    formData.append('description', String(payload.description || payload.summary || '').trim());
    formData.append('tool', String(payload.tool || 'Other'));
    formData.append('license', String(payload.license || 'MIT'));
    formData.append('tags', JSON.stringify(Array.isArray(payload.tags) ? payload.tags : []));
    formData.append('category', String(payload.category || 'General'));
    formData.append('isPublic', payload.isPublic === false ? 'false' : 'true');
    const fileMeta = [];
    for (const file of req.files || []) {
      formData.append('archives', new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }), file.originalname);
      fileMeta.push({ originalName: file.originalname, mimeType: file.mimetype || 'application/octet-stream', size: file.size || 0 });
    }
    formData.append('fileMeta', JSON.stringify(fileMeta));
    const created = await pb.collection('projects').create(formData);
    res.status(201).json(mapProjectRecord(created));
  } catch (error) {
    next(error);
  }
});

app.post('/api/projects/:id/fork', async (req, res, next) => {
  try {
    const user = await requireSignedInUser(req);
    await ensurePocketBaseAdmin();
    const source = await pb.collection('projects').getOne(req.params.id);
    const cloned = await pb.collection('projects').create({
      slug: `${createSlug(source.title || 'project')}-fork-${Date.now()}`,
      title: `${source.title} (Fork)`,
      authorName: user.name,
      ownerClerkId: user.clerkId,
      ownerEmail: user.email,
      summary: source.summary,
      description: source.description,
      tool: source.tool,
      license: source.license,
      tags: source.tags,
      category: source.category,
      isPublic: true,
      forkedFrom: source.id,
      fileMeta: JSON.stringify([]),
      archives: [],
    });
    res.status(201).json(mapProjectRecord(cloned));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    message: error.message || 'Internal server error.',
    details: error.details || error.originalError?.data || null,
  });
});

app.listen(PORT, () => console.log(`OpenPCB API listening on :${PORT}`));
