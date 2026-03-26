import { createClient } from '@supabase/supabase-js';
import { useMemo } from 'react';
import { useSession } from '@clerk/react';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const PROJECT_ARCHIVE_BUCKET = 'project-archives';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
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

      return (await getToken()) ?? null;
    },
  });
}

export function useSupabaseClient() {
  const { session } = useSession();

  return useMemo(() => {
    return createClerkSupabaseClient(() => session?.getToken());
  }, [session?.id]);
}
