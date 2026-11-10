import { createDirectDemandAlert, getDirectDemandAlerts } from './directSupabase';
import { trackGrowthEvent } from './growthEngine';

export type DemandService = 'ride' | 'bus' | 'package';
export type DemandStatus = 'active' | 'matched' | 'expired';

export interface DemandAlert {
  id: string;
  from: string;
  to: string;
  date: string;
  service: DemandService;
  seatsOrSlots: number;
  status: DemandStatus;
  createdAt: string;
  syncedAt?: string;
  backendId?: string;
}

const LEGACY_DEMAND_KEY = 'wasel-demand-alerts';
const demandKey = (userId: string) => `wasel-demand-alerts:${encodeURIComponent(userId)}`;

function readAlerts(userId?: string): DemandAlert[] {
  if (typeof window === 'undefined' || !userId) {return [];}
  try {
    // Alerts contain routes and dates. Never reuse the old unscoped cache or
    // share one account's alerts with another signed-in account.
    window.localStorage.removeItem(LEGACY_DEMAND_KEY);
    const raw = window.localStorage.getItem(demandKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAlerts(userId: string | undefined, alerts: DemandAlert[]) {
  if (typeof window === 'undefined' || !userId) {return;}
  window.localStorage.setItem(demandKey(userId), JSON.stringify(alerts.slice(0, 100)));
}

function syncAlerts(userId: string | undefined, alerts: DemandAlert[]) {
  writeAlerts(userId, alerts);
  return alerts;
}

function updateLocalAlert(userId: string | undefined, id: string, updates: Partial<DemandAlert>) {
  const next = readAlerts(userId).map(alert => (alert.id === id ? { ...alert, ...updates } : alert));
  syncAlerts(userId, next);
}

export async function hydrateDemandAlerts(userId?: string): Promise<DemandAlert[]> {
  if (!userId) {return [];}
  try {
    const remote = await getDirectDemandAlerts(userId);
    const merged = [...readAlerts(userId)];

    for (const item of remote) {
      const normalized: DemandAlert = {
        id: String(item.id ?? `demand-${Date.now()}`),
        backendId: String(item.id ?? ''),
        from: String(item.origin_city ?? ''),
        to: String(item.destination_city ?? ''),
        date: String(item.requested_date ?? '').slice(0, 10),
        service:
          item.service_type === 'bus' || item.service_type === 'package'
            ? item.service_type
            : 'ride',
        seatsOrSlots: Number(item.seats_or_slots ?? 1) || 1,
        status: item.status === 'matched' || item.status === 'expired' ? item.status : 'active',
        createdAt: String(item.created_at ?? new Date().toISOString()),
        syncedAt: new Date().toISOString(),
      };

      const index = merged.findIndex(
        alert =>
          alert.backendId === normalized.backendId ||
          (alert.from === normalized.from &&
            alert.to === normalized.to &&
            alert.date === normalized.date &&
            alert.service === normalized.service),
      );

      if (index >= 0) {merged[index] = { ...merged[index], ...normalized };}
      else {merged.unshift(normalized);}
    }

    return syncAlerts(userId, merged.slice(0, 100)).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return getDemandAlerts(userId);
  }
}

export function getDemandAlerts(userId?: string): DemandAlert[] {
  return [...readAlerts(userId)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function createDemandAlert(input: {
  from: string;
  to: string;
  date: string;
  service: DemandService;
  seatsOrSlots?: number;
  userId?: string;
}): DemandAlert {
  const alerts = readAlerts(input.userId);
  if (!input.userId) {
    throw new Error('Sign in is required to save a private demand alert.');
  }
  const existing = alerts.find(
    item =>
      item.from === input.from &&
      item.to === input.to &&
      item.date === input.date &&
      item.service === input.service &&
      item.status === 'active',
  );
  if (existing) {return existing;}

  const alert: DemandAlert = {
    id: crypto.randomUUID(),
    from: input.from,
    to: input.to,
    date: input.date,
    service: input.service,
    seatsOrSlots: Math.max(1, input.seatsOrSlots ?? 1),
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  syncAlerts(input.userId, [alert, ...alerts]);
  void createDirectDemandAlert({
    from: alert.from,
    to: alert.to,
    date: alert.date,
    service: alert.service,
    seatsOrSlots: alert.seatsOrSlots,
    userId: input.userId,
  })
    .then(remote => {
      updateLocalAlert(input.userId, alert.id, {
        backendId: String(remote.id ?? ''),
        syncedAt: new Date().toISOString(),
      });
    })
    .catch(() => {});
  void trackGrowthEvent({
    userId: input.userId,
    eventName: 'demand_alert_created',
    funnelStage: 'searched',
    serviceType: input.service,
    from: alert.from,
    to: alert.to,
    metadata: {
      date: alert.date,
      seatsOrSlots: alert.seatsOrSlots,
    },
  });
  return alert;
}

export function getDemandStats(userId?: string) {
  const alerts = getDemandAlerts(userId);
  return {
    active: alerts.filter(item => item.status === 'active').length,
    rides: alerts.filter(item => item.service === 'ride' && item.status === 'active').length,
    buses: alerts.filter(item => item.service === 'bus' && item.status === 'active').length,
    packages: alerts.filter(item => item.service === 'package' && item.status === 'active').length,
  };
}
