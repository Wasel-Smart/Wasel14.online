export const ANALYTICS_CONSENT_CHANGED = 'wasel:analytics-consent-changed';

const ANALYTICS_KEY = 'consent-analytics';
const COOKIE_DECISION_KEY = 'wasel-cookie-consent';
const LEGACY_COOKIE_DECISION_KEY = 'wasel_cookie_consent';

export type CookieDecision = 'accepted' | 'declined';

function getStoredValue ( key: string ): string | null {
  if ( typeof window === 'undefined' ) { return null; }
  try {
    return window.localStorage.getItem( key );
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent (): boolean {
  return getStoredValue( ANALYTICS_KEY ) === 'true';
}

export function setAnalyticsConsent ( granted: boolean ): void {
  if ( typeof window === 'undefined' ) { return; }
  try {
    if ( granted ) {
      window.localStorage.setItem( ANALYTICS_KEY, 'true' );
    } else {
      window.localStorage.removeItem( ANALYTICS_KEY );
    }
  } catch {
    // If storage is blocked, analytics remains disabled for this session.
  }
  window.dispatchEvent( new Event( ANALYTICS_CONSENT_CHANGED ) );
}

export function readCookieDecision (): CookieDecision | null {
  const stored = getStoredValue( COOKIE_DECISION_KEY ) ?? getStoredValue( LEGACY_COOKIE_DECISION_KEY );
  if ( stored === 'accepted' || stored === 'declined' ) { return stored; }
  if ( !stored ) { return null; }
  try {
    const parsed: unknown = JSON.parse( stored );
    if ( typeof parsed === 'object' && parsed !== null && 'accepted' in parsed ) {
      return ( parsed as { accepted?: unknown } ).accepted === true ? 'accepted' : 'declined';
    }
  } catch {
    // Unknown historic consent value: ask the user again.
  }
  return null;
}

export function saveCookieDecision ( decision: CookieDecision ): void {
  if ( typeof window !== 'undefined' ) {
    try {
      window.localStorage.setItem( COOKIE_DECISION_KEY, decision );
      window.localStorage.setItem( LEGACY_COOKIE_DECISION_KEY, JSON.stringify( {
        accepted: decision === 'accepted',
        timestamp: Date.now(),
        version: '1.0',
      } ) );
    } catch {
      // Consent still applies to the current runtime even if persistence is blocked.
    }
  }
  setAnalyticsConsent( decision === 'accepted' );
}
