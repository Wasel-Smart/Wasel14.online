/**
 * Ride Tracking Feature Module
 * Provides hooks and state management for ride tracking
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

export interface LiveRide {
  id: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  vehicleModel: string;
  vehiclePlate: string;
  status: 'matching' | 'driver_en_route' | 'driver_arrived' | 'in_progress';
  eta: string;
  distance: string;
  fare: string;
  driverLocation?: DriverLocation;
}

interface LiveTripSnapshot {
  bookingId: string;
  tripId: string;
  status: string;
  from: string;
  to: string;
  fromCoord: { lat: number; lng: number };
  toCoord: { lat: number; lng: number };
  driver: {
    id: string;
    name: string;
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
  driverPosition?: { lat: number; lng: number };
  waypoints: Array<{ label: string; coord: { lat: number; lng: number } }>;
  heartbeatAt: string | null;
  telemetryFresh: boolean;
}

function mapSnapshotToLiveRide(snapshot: LiveTripSnapshot): LiveRide {
  const driverPos = snapshot.driverPosition;
  return {
    id: snapshot.tripId ?? snapshot.bookingId,
    driverId: snapshot.driver.id,
    driverName: snapshot.driver.name,
    driverRating: snapshot.driver.rating,
    vehicleModel: snapshot.vehicle.model,
    vehiclePlate: snapshot.vehicle.plate,
    status: snapshot.status === 'en_route' || snapshot.status === 'en_route_to_pickup'
      ? 'driver_en_route'
      : snapshot.status === 'driver_arrived'
        ? 'driver_arrived'
        : snapshot.status === 'in_progress' || snapshot.status === 'arriving'
          ? 'in_progress'
          : 'matching',
    eta: snapshot.estimatedArrival,
    distance: `${snapshot.totalDistanceKm} km`,
    fare: `${snapshot.price}`,
    driverLocation: driverPos
      ? {
          latitude: driverPos.lat,
          longitude: driverPos.lng,
          timestamp: snapshot.heartbeatAt ?? new Date().toISOString(),
        }
      : undefined,
  };
}

export function useLiveRide(rideId?: string, enabled = true, refetchInterval = 3000) {
  const queryClient = useQueryClient();

  const queryOptions: Parameters<typeof useQuery<LiveRide | null>>[0] = {
    queryKey: ['live-ride', rideId],
    queryFn: async () => {
      const response = await apiClient.get<LiveTripSnapshot>('live-trip');
      if (response.error) throw new Error(response.error);
      if (!response.data?.snapshot) return null;
      return mapSnapshotToLiveRide(response.data.snapshot);
    },
    enabled,
    staleTime: 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  };

  if (refetchInterval && refetchInterval > 0) {
    queryOptions.refetchInterval = refetchInterval;
  }
  queryOptions.refetchIntervalInBackground = true;

  const query = useQuery(queryOptions);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['live-ride', rideId] });

  return {
    ...query,
    ride: query.data,
    refresh,
  };
}