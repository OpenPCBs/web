import { createClient } from '@supabase/supabase-js';
import { useMemo } from 'react';
import { useSession } from '@clerk/react';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const PROJECT_ARCHIVE_BUCKET = 'project-archives';

const PROJECTS_SCHEMA_CACHE_MESSAGE = "Could not find the table 'public.projects' in the schema cache";
const CLERK_TOKEN_MESSAGE = 'No suitable key or wrong key type';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function createPublicSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

export function createClerkSupabaseClient(getToken) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => {
      if (!getToken) {
        return null;
      }

      try {
        return (await getToken()) ?? null;
      } catch {
        return null;
      }
    },
  });
}

export function getSupabaseErrorMessage(error, options = {}) {
  const { operation = 'Supabase request' } = options;
  const message = String(error?.message || '').trim();

  if (message.includes(PROJECTS_SCHEMA_CACHE_MESSAGE)) {
    return "Supabase cannot see public.projects yet. Run supabase/openpcb_schema.sql in the Supabase SQL editor, then run NOTIFY pgrst, 'reload schema'; and refresh the app.";
  }

  if (error?.code === 'PGRST301' || message.includes(CLERK_TOKEN_MESSAGE)) {
    return 'Supabase rejected the Clerk session token. Connect this exact Clerk instance to this exact Supabase project, enable Clerk as a Third-Party Auth provider in Supabase, then try again.';
  }

  return message || `${operation} failed.`;
}

export function usePublicSupabaseClient() {
  return useMemo(() => createPublicSupabaseClient(), []);
}

export function useAuthenticatedSupabaseClient() {
  const { session } = useSession();

  return useMemo(() => {
    return createClerkSupabaseClient(() => session?.getToken());
  }, [session?.id]);
}

export const useSupabaseClient = useAuthenticatedSupabaseClient;
