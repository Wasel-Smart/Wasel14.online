import { API_URL } from './api-resolver';
import { getConfig } from '../../utils/env';
import { validateApiUrl } from '../../utils/sanitization';
import { circuitBreakers } from '../../utils/circuitBreaker';
import { addCSRFHeader } from '../../utils/csrf';
import { supabase as supabaseClient } from '../../utils/supabase/client';
import {
  isEdgeFunctionAvailable,
  setEdgeFunctionAvailability,
  getNetworkOnline,
  setBackendStatus,
} from './availability';

export interface FetchWithRetryOptions extends RequestInit {
  timeout?: number;
}

// Public, read-only map endpoints the app calls directly (mosque lookup and
// driving routes). They are not part of the Supabase backend, so they have to
// be allowlisted explicitly or fetchWithRetry rejects them as untrusted.
// Neither host accepts credentials, so allowing them cannot leak a token.
const TRUSTED_MAP_HOSTS = ['overpass-api.de', 'router.project-osrm.org'];

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
  retries = 1,
  backoff = 500,
): Promise<Response> {
  if (!url) {
    throw new Error(
      'Backend API is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  const { allowedApiDomain } = getConfig();
  const allowedDomains = [
    'supabase.co',
    'supabase.net',
    'localhost',
    allowedApiDomain,
    ...TRUSTED_MAP_HOSTS,
  ].filter(Boolean);

  if (!validateApiUrl(url, allowedDomains)) { // nosec CWE-918
    throw new Error('Invalid or unauthorized URL');
  }

  const breaker = circuitBreakers.get('api-calls', {
    failureThreshold: 5,
    timeout: 5000,
  });

  // No manual reset here: the breaker resets itself on success and on manual
  // reset (resetApiCircuitBreaker), and fails fast while OPEN until its reset
  // window elapses. Resetting on entry made the breaker incapable of opening.

  // The retries run as a loop inside the breaker-protected call, so one logical
  // request counts as exactly one breaker outcome. Recursing through
  // fetchWithRetry would re-enter the breaker for every attempt and trip it
  // after ~3 requests instead of the configured 5 consecutive failures.
  const attemptFetch = async (): Promise<Response> => {
    const { timeout = 5_000, signal: callerSignal, ...fetchOptions } = options;

    if (fetchOptions.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(fetchOptions.method)) {
      fetchOptions.headers = addCSRFHeader(fetchOptions.headers);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    if (callerSignal?.aborted) {
      clearTimeout(timer);
      throw new DOMException('Request aborted', 'AbortError');
    }

    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      if (response.ok) {
        if (!isEdgeFunctionAvailable() && url.includes('/health')) {
          setEdgeFunctionAvailability(true);
        }
        return response;
      }

      if (response.status >= 500) {
        setBackendStatus(getNetworkOnline() ? 'degraded' : 'offline');
      }

      return response;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  };

  const markBackendDown = (): void => {
    setBackendStatus(getNetworkOnline() ? 'degraded' : 'offline');

    if (url.startsWith(API_URL)) {
      setEdgeFunctionAvailability(false);
    }
  };

  const isRetryableFailure = (error: unknown): boolean => {
    if (options.signal?.aborted === true) {
      return false;
    }

    return (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === 'AbortError')
    );
  };

  const executeFetch = async (): Promise<Response> => {
    let remainingRetries = retries;
    let currentBackoff = backoff;

    for (;;) {
      try {
        const response = await attemptFetch();

        if (remainingRetries <= 0 || !RETRYABLE_STATUS_CODES.includes(response.status)) {
          return response;
        }
      } catch (error: unknown) {
        if (remainingRetries <= 0 || !isRetryableFailure(error)) {
          if (options.signal?.aborted !== true) {
            markBackendDown();
          }

          throw error;
        }
      }

      remainingRetries -= 1;
      await delay(currentBackoff);
      currentBackoff *= 2;
    }
  };

  return breaker.execute(executeFetch);
}

const RETRYABLE_STATUS_CODES = [502, 503, 504];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const supabase = supabaseClient;

export function resetApiCircuitBreaker(): void {
  const breaker = circuitBreakers.get('api-calls');
  breaker.reset();
  if (import.meta.env.DEV) {
    console.info('[Wasel] API circuit breaker manually reset');
  }
}

export function getApiCircuitBreakerState() {
  const breaker = circuitBreakers.get('api-calls');
  return breaker.getStats();
}

export interface AuthDetails {
  token: string;
  userId: string;
}

export async function getAuthDetails(): Promise<AuthDetails> {
  if (!supabase) {
    throw new Error('Supabase client is not initialised');
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const needsRefresh = !session || (session.expires_at ?? 0) - nowSeconds < 60;

  if (needsRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      throw new Error('Session expired. Please sign in again.');
    }
    return {
      token: refreshed.session.access_token,
      userId: refreshed.session.user.id,
    };
  }

  return {
    token: session.access_token,
    userId: session.user.id,
  };
}
