/**
 * Local-session detection.
 *
 * True when the app is running on a seeded local session instead of a real
 * Supabase login: Playwright E2E runs (VITE_E2E_LOCAL_AUTH) or the local demo
 * user (backendMode === 'local'). Such sessions carry no access token, so any
 * backend write can only answer "Session expired". Services use this to fall
 * back to local persistence instead of failing the whole workflow.
 *
 * Real signed-in users are never affected: their session has no
 * `backendMode: 'local'` marker and the E2E flag is only set by the Playwright
 * dev-server launcher.
 *
 * This module intentionally has no imports so any service can use it without
 * creating a circular dependency.
 */
export function isLocalOnlySession(): boolean {
  if (import.meta.env.VITE_E2E_LOCAL_AUTH === 'true') {
    return true;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const storageKey = import.meta.env.VITE_LOCAL_AUTH_STORAGE_KEY || 'wasel_user_session';
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as { backendMode?: string } | null;
    return parsed?.backendMode === 'local';
  } catch {
    return false;
  }
}
