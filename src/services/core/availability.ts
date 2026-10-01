import { API_URL, publicAnonKey } from './api-resolver';
import {
  checkSupabaseConnection,
  supabase as supabaseClient,
} from '../../utils/supabase/client';
import { circuitBreakers, CircuitState } from '../../utils/circuitBreaker';
import { createEdgeHeaders } from './edge-headers';

export type BackendStatus = 'unknown' | 'healthy' | 'degraded' | 'offline';

export interface AvailabilitySnapshot {
  networkOnline: boolean;
  edgeFunctionAvailable: boolean;
  backendStatus: BackendStatus;
  usingFallbackMode: boolean;
  lastCheckedAt: number | null;
}

type AvailabilityListener = (snapshot: AvailabilitySnapshot) => void;

let edgeFunctionAvailable = Boolean(supabaseClient || API_URL);
let backendStatus: BackendStatus = supabaseClient ? 'unknown' : 'degraded';
let lastCheckedAt: number | null = null;
let loggedLocalHealthBypass = false;
const availabilityListeners = new Set<AvailabilityListener>();

/**
 * Skip the Edge Function health probe when running the dev server on loopback.
 *
 * The check is scoped to `import.meta.env.DEV` as well as a loopback origin: the
 * previous version keyed off the origin alone, so any build served from
 * `http://localhost` or `http://127.0.0.1` silently reported a healthy backend
 * without ever contacting it, and the `loggedLocalHealthBypass` guard nested a
 * second `import.meta.env.DEV` test inside a branch that already tested it.
 */
function shouldPreferDirectSupabaseHealth(): boolean {
  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return false;
  }

  try {
    const { hostname, protocol } = new URL(window.location.origin);
    const isLocalOrigin =
      protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');

    if (isLocalOrigin && !loggedLocalHealthBypass) {
      loggedLocalHealthBypass = true;
      console.info('[Wasel] Local dev origin detected, bypassing remote edge health probe.');
    }

    return isLocalOrigin;
  } catch {
    return false;
  }
}

async function markSupabaseHealth(): Promise<boolean> {
  if (!supabaseClient) {
    setEdgeFunctionAvailability(false);
    setBackendStatus(getNetworkOnline() ? 'degraded' : 'offline');
    return false;
  }

  const healthy = await checkSupabaseConnection(true).catch(() => false);
  setEdgeFunctionAvailability(healthy);
  setBackendStatus(healthy ? 'healthy' : getNetworkOnline() ? 'degraded' : 'offline');
  return healthy;
}

function getNetworkOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }
  return navigator.onLine;
}

export { getNetworkOnline };

function buildAvailabilitySnapshot(): AvailabilitySnapshot {
  const networkOnline = getNetworkOnline();

  if (!networkOnline) {
    return {
      networkOnline,
      edgeFunctionAvailable,
      backendStatus: 'offline',
      usingFallbackMode: !edgeFunctionAvailable,
      lastCheckedAt,
    };
  }

  return {
    networkOnline,
    edgeFunctionAvailable,
    backendStatus,
    usingFallbackMode: !edgeFunctionAvailable,
    lastCheckedAt,
  };
}

function notifyAvailabilityListeners(): void {
  const snapshot = buildAvailabilitySnapshot();
  availabilityListeners.forEach(listener => listener(snapshot));
}

export function setEdgeFunctionAvailability(nextValue: boolean): void {
  if (edgeFunctionAvailable === nextValue) {
    return;
  }

  edgeFunctionAvailable = nextValue;
  notifyAvailabilityListeners();
}

function setBackendStatus(nextStatus: BackendStatus): void {
  backendStatus = nextStatus;
  lastCheckedAt = Date.now();
  notifyAvailabilityListeners();
}

export { setBackendStatus };

export function getAvailabilitySnapshot(): AvailabilitySnapshot {
  return buildAvailabilitySnapshot();
}

export function subscribeAvailability(listener: AvailabilityListener): () => void {
  availabilityListeners.add(listener);
  listener(buildAvailabilitySnapshot());

  return () => {
    availabilityListeners.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyAvailabilityListeners();
    const breaker = circuitBreakers.get('api-calls');
    if (breaker.getState() === CircuitState.OPEN) {
      breaker.reset();
      if (import.meta.env.DEV) {
        console.info('[Wasel] API circuit breaker reset due to network recovery');
      }
    }
  });

  window.addEventListener('offline', () => {
    notifyAvailabilityListeners();
  });
}

export function isEdgeFunctionAvailable(): boolean {
  return edgeFunctionAvailable;
}

export function markEdgeFunctionUnavailable(): void {
  if (edgeFunctionAvailable) {
    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    if (isDev) {
      console.info('[Wasel] Edge Function unavailable, using direct Supabase queries.');
    }
  }

  setEdgeFunctionAvailability(false);
  setBackendStatus(getNetworkOnline() ? 'degraded' : 'offline');
}

export async function probeBackendHealth(timeout = 8_000): Promise<AvailabilitySnapshot> {
  if (!getNetworkOnline()) {
    setBackendStatus('offline');
    return buildAvailabilitySnapshot();
  }

  if (!API_URL || !publicAnonKey || shouldPreferDirectSupabaseHealth()) {
    await markSupabaseHealth();
    return buildAvailabilitySnapshot();
  }

  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(timeout),
      headers: createEdgeHeaders(),
    });

    if (response.ok) {
      setEdgeFunctionAvailability(true);
      setBackendStatus('healthy');
    } else if (!(await markSupabaseHealth())) {
      setEdgeFunctionAvailability(false);
      setBackendStatus('degraded');
    }
  } catch {
    await markSupabaseHealth();
  }

  return buildAvailabilitySnapshot();
}

let warmUpAttempts = 0;
let serverWarm = false;
const MAX_WARMUP_ATTEMPTS = 3;

export async function warmUpServer(): Promise<void> {
  if (serverWarm) {
    return;
  }

  if (!API_URL || !publicAnonKey || shouldPreferDirectSupabaseHealth()) {
    serverWarm = await markSupabaseHealth();
    return;
  }

  warmUpAttempts += 1;

  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(12_000),
      headers: createEdgeHeaders(),
    });

    if (response.ok) {
      serverWarm = true;
      setEdgeFunctionAvailability(true);
      setBackendStatus('healthy');
      return;
    }
  } catch {
    // The retry path below handles the final state.
  }

  if (await markSupabaseHealth()) {
    serverWarm = true;
    return;
  }

  if (warmUpAttempts < MAX_WARMUP_ATTEMPTS) {
    setTimeout(() => {
      void warmUpServer();
    }, 2_000 * warmUpAttempts);
    return;
  }

  markEdgeFunctionUnavailable();
}

let healthPollTimer: ReturnType<typeof setInterval> | null = null;

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void probeBackendHealth();
  }
}

export function startAvailabilityPolling(intervalMs = 60_000): () => void {
  if (healthPollTimer) {
    return () => stopAvailabilityPolling();
  }

  healthPollTimer = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      void probeBackendHealth();
    }
  }, intervalMs);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  return () => stopAvailabilityPolling();
}

export function stopAvailabilityPolling(): void {
  if (!healthPollTimer) {
    return;
  }

  clearInterval(healthPollTimer);
  healthPollTimer = null;

  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
}

warmUpServer().catch(() => {
  markEdgeFunctionUnavailable();
});
