export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
export const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || '';

export function getFunctionUrl(functionName) {
  if (!SUPABASE_FUNCTIONS_URL) {
    return '';
  }

  return `${SUPABASE_FUNCTIONS_URL.replace(/\/$/, '')}/${functionName}`;
}

export function hasServerIntegrations() {
  return Boolean(SUPABASE_FUNCTIONS_URL);
}
