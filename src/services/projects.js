import { PROJECT_ARCHIVE_BUCKET } from '../lib/supabase';
import { createSlug, mapProjectRowToUiProject } from '../lib/projectMappers';

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => tag.trim()).filter(Boolean);
  }

  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function fetchProjects(supabase, currentUserId) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapProjectRowToUiProject(row, supabase, currentUserId));
}

export async function publishProject({ supabase, user, formState, archiveFile }) {
  if (!supabase) {
    throw new Error('Supabase is not configured yet.');
  }

  if (!user?.id) {
    throw new Error('You must be signed in to publish a project.');
  }

  const slugRoot = createSlug(formState.title) || 'untitled-project';
  const slug = `${slugRoot}-${Date.now()}`;
  const projectId = crypto.randomUUID();

  let archivePath = null;
  let archiveName = null;
  let archiveSize = null;

  if (archiveFile) {
    archiveName = archiveFile.name;
    archiveSize = archiveFile.size;
    archivePath = `${user.id}/${projectId}/${archiveFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from(PROJECT_ARCHIVE_BUCKET)
      .upload(archivePath, archiveFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }
  }

  const payload = {
    id: projectId,
    user_id: user.id,
    slug,
    title: formState.title.trim(),
    author_name:
      formState.author?.trim() ||
      user.fullName ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      'OpenPCB user',
    summary: formState.summary.trim(),
    description: formState.description.trim() || formState.summary.trim(),
    tool: formState.tool,
    license: formState.license,
    tags: normalizeTags(formState.tags),
    category: formState.category.trim() || 'General',
    difficulty: 'Custom',
    archive_path: archivePath,
    archive_name: archiveName,
    archive_size: archiveSize,
    is_public: true,
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRowToUiProject(data, supabase, user.id);
}

export async function forkProject({ supabase, user, project }) {
  if (!supabase) {
    throw new Error('Supabase is not configured yet.');
  }

  if (!user?.id) {
    throw new Error('You must be signed in to fork a project.');
  }

  const slugRoot = createSlug(`${project.title} fork`) || 'forked-project';
  const payload = {
    user_id: user.id,
    slug: `${slugRoot}-${Date.now()}`,
    title: `${project.title} (Fork)`,
    author_name:
      user.fullName || user.username || user.primaryEmailAddress?.emailAddress || 'OpenPCB user',
    summary: project.summary,
    description: project.description || project.summary,
    tool: project.tool,
    license: project.license,
    tags: normalizeTags(project.tags),
    category: project.category,
    difficulty: project.difficulty || 'Custom',
    parent_project_id: project.dbId || null,
    is_public: true,
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapProjectRowToUiProject(data, supabase, user.id);
}
