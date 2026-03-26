import { PROJECT_ARCHIVE_BUCKET } from './supabase';

export function createSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function formatDate(value) {
  if (!value) {
    return new Date().toISOString().split('T')[0];
  }

  return new Date(value).toISOString().split('T')[0];
}

export function getArchivePublicUrl(supabase, archivePath) {
  if (!supabase || !archivePath) {
    return null;
  }

  const { data } = supabase.storage.from(PROJECT_ARCHIVE_BUCKET).getPublicUrl(archivePath);
  return data?.publicUrl ?? null;
}

export function mapProjectRowToUiProject(row, supabase, currentUserId) {
  return {
    id: row.slug || row.id,
    dbId: row.id,
    ownerId: row.user_id,
    title: row.title,
    author: row.author_name,
    summary: row.summary,
    description: row.description || row.summary,
    tool: row.tool,
    license: row.license,
    tags: row.tags || [],
    category: row.category,
    stars: row.stars ?? 0,
    forks: row.forks ?? 0,
    difficulty: row.difficulty || 'Custom',
    files: row.archive_name ? [row.archive_name] : ['Metadata only'],
    archiveName: row.archive_name,
    archivePath: row.archive_path,
    archiveUrl: getArchivePublicUrl(supabase, row.archive_path),
    updatedAt: formatDate(row.updated_at),
    createdAt: row.created_at,
    isPublic: row.is_public,
    parentProjectId: row.parent_project_id,
    isUserProject: Boolean(currentUserId && row.user_id === currentUserId),
    source: 'supabase',
  };
}
