import { supabase } from '../utils/supabase/client';
import { API_ENDPOINTS, apiGet } from '../utils/api';

type LatLng = {
  lat: number;
  lng: number;
};

type LiveTripStatus =
  'en_route_to_pickup' | 'driver_arrived' | 'en_route' | 'arriving' | 'completed';

export interface LiveTripSnapshot {
  bookingId: string;
  tripId: string;
  status: LiveTripStatus;
  from: string;
  fromAr?: string;
  fromCoord: LatLng;
  to: string;
  toAr?: string;
  toCoord: LatLng;
  driver: {
    id: string;
    name: string;
    nameAr?: string;
    rating: number;
    trips: number;
    img: string;
    phone: string;
    initials: string;
  };
  vehicle: {
    model: string;
    color: string;
    plate: string;
    year: number;
  };
  price: number;
  startedAt: string;
  estimatedArrival: string;
  totalDistanceKm: number;
  passengers: number;
  shareCode: string;
  progress: number;
  timeLeftMinutes: number;
  driverPosition: LatLng;
  waypoints: Array<{
    label: string;
    coord: LatLng;
  }>;
  heartbeatAt: string | null;
  telemetryFresh: boolean;
}

async function fetchLiveTripSnapshot(): Promise<LiveTripSnapshot | null> {
  const response = await apiGet<{ snapshot: LiveTripSnapshot | null }>(API_ENDPOINTS.LIVE_TRIP);
  return response.snapshot ?? null;
}

export function subscribeToLiveTripPresence(
  authUserId: string,
  onSnapshot: (snapshot: LiveTripSnapshot | null) => void,
): () => void {
  if (!supabase || !authUserId) {
    onSnapshot(null);
    return () => {};
  }

  let active = true;
  let refreshing: Promise<void> | null = null;
  let queued = false;

  const refresh = () => {
    if (!active) {return;}
    if (refreshing) {
      queued = true;
      return;
    }

    refreshing = fetchLiveTripSnapshot()
      .then(snapshot => {
        if (active) {
          onSnapshot(snapshot);
        }
      })
      .catch(() => {
        if (active) {
          onSnapshot(null);
        }
      })
      .finally(() => {
        refreshing = null;
        if (queued) {
          queued = false;
          refresh();
        }
      });
  };

  refresh();

  const channel = supabase
    .channel(`live-trip-presence-${authUserId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_presence' }, refresh)
    .subscribe();

  return () => {
    active = false;
    if (!supabase) {throw new Error('Supabase not configured');}
    void supabase.removeChannel(channel);
  };
}
