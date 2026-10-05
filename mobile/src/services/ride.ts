/**
 * Mobile Ride Lifecycle Service
 * Manages ride requests, matching, and completion flow
 */

import { mobileAuth } from './auth';
import { offlineService } from './offline';
import { apiClient } from '../lib/api';

export type RideStatus =
  | 'requested'
  | 'matched'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface RideRequest {
  origin: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  seats: number;
  scheduledFor?: string;
  preferredVehicleType?: string;
  notes?: string;
}

export interface AvailableTrip {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  price: number;
  driver: {
    id: string;
    name: string;
    rating: number;
    verified: boolean;
  };
}

export interface Ride {
  id: string;
  riderId: string;
  tripId?: string;
  driverId?: string;
  driverName?: string;
  vehicleId?: string;
  origin: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: RideStatus;
  fare?: number;
  distance?: number;
  seats?: number;
  duration?: number;
  rating?: number;
  requestedAt: string;
  matchedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  rating: number;
  totalRides: number;
  vehicleModel: string;
  vehiclePlate: string;
  photo?: string;
}

export interface DriverRatingResponse {
  averageRating: number;
  totalRatings: number;
  recentReviews: Array<{
    rating: number;
    review: string;
    tags: string[];
    createdAt: string;
  }>;
}

export interface RawRideRecord {
  id?: string;
  trip_id?: string;
  rider_id?: string;
  driver_id?: string;
  driver_name?: string;
  vehicle_id?: string;
  rating?: number;
  origin_address?: string;
  origin_city?: string;
  origin_lat?: number;
  origin_lng?: number;
  dest_address?: string;
  destination_city?: string;
  dest_lat?: number;
  dest_lng?: number;
  from?: string;
  to?: string;
  status?: string;
  trip_status?: string;
  fare?: number;
  price_per_seat?: number;
  distance?: number;
  duration?: number;
  created_at?: string;
  departure_time?: string;
  matched_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}

export class RideLifecycleService {
  private activeRide: Ride | null = null;
  private listeners = new Set<(ride: Ride | null) => void>();

  constructor() {}

  async searchTrips(from: string, to: string, seats = 1, date?: string): Promise<AvailableTrip[]> {
    const params = new URLSearchParams({ from, to, seats: String(seats) });
    if (date) params.set('date', date);

    const { data, error } = await apiClient.get<AvailableTrip[]>(`/v1/trips/search?${params.toString()}`);
    if (error || !data) return [];
    return data;
  }

  async requestRide(request: RideRequest): Promise<{ ride?: Ride; error?: Error; bookingId?: string }> {
    const user = mobileAuth.getUser();
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    if (!offlineService.isDeviceOnline()) {
      await offlineService.queueOfflineAction({
        type: 'RIDE_REQUEST',
        payload: {
          rider_id: user.id,
          origin_address: request.origin.address,
          dest_address: request.destination.address,
          seats: request.seats,
          scheduled_for: request.scheduledFor,
          preferred_vehicle_type: request.preferredVehicleType,
          notes: request.notes,
        },
      });
      return { error: new Error('Ride request queued for sync when online') };
    }

    try {
      const today = request.scheduledFor
        ? new Date(request.scheduledFor).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const trips = await this.searchTrips(request.origin.address, request.destination.address, request.seats, today);
      if (trips.length === 0) {
        return { error: new Error('No available rides on this route') };
      }

      const selectedTrip = trips[0];
      const { data, error } = await apiClient.post<{ booking?: unknown } & Record<string, unknown>>(
        '/v1/bookings',
        {
          trip_id: selectedTrip.id,
          seats_requested: request.seats,
          pickup_stop: request.origin.address,
          dropoff_stop: request.destination.address,
        },
      );

      if (error || !data) throw new Error(error ?? 'Empty response');

      const booking = (data.booking ?? data) as Record<string, unknown>;
      const ride = this.mapBookingToRide(booking, selectedTrip);
      this.setActiveRide(ride);
      await offlineService.cacheActiveRide(ride);
      return { ride, bookingId: String(booking.booking_id ?? booking.id ?? '') };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async cancelRide(rideId: string, reason?: string): Promise<{ error?: Error }> {
    // If offline, queue the action
    if (!offlineService.isDeviceOnline()) {
      await offlineService.queueOfflineAction({
        type: 'RIDE_CANCEL',
        payload: { rideId, reason },
      });
      this.setActiveRide(null);
      return {};
    }

    try {
      const { error } = await apiClient.post('/cancellations/bookings', {
        bookingId: rideId,
        reason: reason ?? 'Cancelled from mobile',
      });
      if (error) throw new Error(error);
      this.setActiveRide(null);
      return {};
    } catch (error) {
      return { error: error as Error };
    }
  }

  async rateRide(
    rideId: string,
    rating: number,
    feedback?: string,
    tags?: string[],
    driverId?: string,
    tripId?: string,
  ): Promise<{ error?: Error }> {
    const payload = {
      bookingId: rideId,
      rating,
      review: feedback,
      tags,
      driverId,
      tripId,
    };

    // If offline, queue the action
    if (!offlineService.isDeviceOnline()) {
      await offlineService.queueOfflineAction({
        type: 'RIDE_RATING',
        payload,
      });
      return {};
    }

    try {
      const { error } = await apiClient.post<void>('/ratings', payload);
      if (error) throw new Error(error);
      return {};
    } catch (error) {
      return { error: error as Error };
    }
  }

  async getActiveRide(): Promise<Ride | null> {
    if (this.activeRide) return this.activeRide;

    const user = mobileAuth.getUser();
    if (!user) return null;

    if (!offlineService.isDeviceOnline()) {
      const cached = await offlineService.getCachedActiveRide<Ride>();
      if (cached) {
        this.setActiveRide(cached);
        return cached;
      }
      return null;
    }

    try {
      const { data, error } = await apiClient.get<{ activeTrip?: Record<string, unknown> | null; ride?: Record<string, unknown> | null }>('/active-trip');
      const tripData = data?.activeTrip ?? data?.ride;
      if (error || !tripData || !data) return null;
      const ride = data.activeTrip
        ? this.mapActiveTripToRide(data.activeTrip)
        : this.mapBookingToRide((data.ride ?? {}) as Record<string, unknown>);
      this.setActiveRide(ride);
      await offlineService.cacheActiveRide(ride);
      return ride;
    } catch (error) {
      console.error('[RideLifecycle] Error fetching active ride:', error);
      const cached = await offlineService.getCachedActiveRide<Ride>();
      if (cached) { this.setActiveRide(cached); return cached; }
      return null;
    }
  }

  async getDriverInfo(driverId: string): Promise<Driver | null> {
    if (!offlineService.isDeviceOnline()) {
      return await offlineService.getCachedDriverInfo<Driver>(driverId);
    }

    try {
      const { data, error } = await apiClient.get<DriverRatingResponse>(
        `/ratings/drivers/${encodeURIComponent(driverId)}`,
      );
      if (!error && data) {
        const driver = this.mapDriverRatingToDriver(data, driverId);
        await offlineService.cacheDriverInfo(driverId, driver);
        return driver;
      }
      return null;
    } catch (error) {
      console.error('[RideLifecycle] Error fetching driver info:', error);
      return await offlineService.getCachedDriverInfo<Driver>(driverId);
    }
  }

  async getRideHistory(limit = 20): Promise<Ride[]> {
    const user = mobileAuth.getUser();
    if (!user) return [];

    if (!offlineService.isDeviceOnline()) {
      const cached = await offlineService.getCachedRideHistory<Ride>();
      return cached || [];
    }

    try {
      const { data, error } = await apiClient.get<unknown>(`/bookings/user/${encodeURIComponent(user.id)}?limit=${encodeURIComponent(String(limit))}`);
      if (error || !data) throw new Error(error ?? 'Empty response');
      const rawObj = data as Record<string, unknown>;
      const bookings = Array.isArray(data)
        ? data
        : Array.isArray(rawObj.rides)
        ? (rawObj.rides as unknown[])
        : Array.isArray(rawObj.bookings)
        ? (rawObj.bookings as unknown[])
        : Array.isArray(rawObj.data)
        ? (rawObj.data as unknown[])
        : [];
      const rides = bookings.map((booking: unknown) =>
        this.mapBookingToRide(booking as Record<string, unknown>),
      );
      await offlineService.cacheRideHistory(rides);
      return rides;
    } catch (error) {
      console.error('[RideLifecycle] Error fetching ride history:', error);
      const cached = await offlineService.getCachedRideHistory<Ride>();
      return cached || [];
    }
  }

  async canRateRide(rideId: string): Promise<boolean> {
    if (!rideId) return false;
    try {
      const { data, error } = await apiClient.get<{ canRate?: boolean }>(
        `/ratings/bookings/${encodeURIComponent(rideId)}/eligibility`,
      );
      if (error) return false;
      return Boolean(data?.canRate);
    } catch {
      return true;
    }
  }

  subscribe(listener: (ride: Ride | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.activeRide); // Immediate call with current state

    return () => {
      this.listeners.delete(listener);
    };
  }

  private setActiveRide(ride: Ride | null): void {
    this.activeRide = ride;
    this.listeners.forEach(listener => listener(ride));
  }

  private mapDatabaseRide(data: RawRideRecord): Ride {
    const originAddress = data.origin_address ?? data.origin_city ?? data.from ?? '';
    const destinationAddress = data.dest_address ?? data.destination_city ?? data.to ?? '';
    const status = (data.status ?? data.trip_status ?? 'requested') as RideStatus;
    return {
      id: data.id ?? data.trip_id ?? '',
      riderId: data.rider_id ?? mobileAuth.getUser()?.id ?? '',
      tripId: data.trip_id,
      driverId: data.driver_id,
      driverName: data.driver_name,
      vehicleId: data.vehicle_id,
      rating: data.rating,
      origin: {
        latitude: data.origin_lat ?? 0,
        longitude: data.origin_lng ?? 0,
        address: originAddress,
      },
      destination: {
        latitude: data.dest_lat ?? 0,
        longitude: data.dest_lng ?? 0,
        address: destinationAddress,
      },
      status,
      fare: data.fare ?? data.price_per_seat,
      distance: data.distance,
      duration: data.duration,
      requestedAt: data.created_at ?? data.departure_time ?? new Date().toISOString(),
      matchedAt: data.matched_at,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      cancelledAt: data.cancelled_at,
    };
  }

  private mapBookingToRide(booking: Record<string, unknown>, trip?: AvailableTrip): Ride {
    const raw = booking as Record<string, unknown>;
    const originAddress = String(raw.origin_address ?? raw.pickup ?? raw.pickup_stop ?? raw.pickup_location ?? trip?.from ?? '');
    const destAddress = String(raw.dest_address ?? raw.dropoff ?? raw.dropoff_stop ?? raw.dropoff_location ?? trip?.to ?? '');
    const rawStatus = String(raw.status ?? raw.booking_status ?? raw.trip_status ?? 'requested');
    const status: RideStatus =
      rawStatus === 'confirmed' || rawStatus === 'matched'
        ? 'matched'
        : rawStatus === 'cancelled'
        ? 'cancelled'
        : rawStatus === 'completed'
        ? 'completed'
        : rawStatus === 'in_progress'
        ? 'in_progress'
        : rawStatus === 'accepted'
        ? 'accepted'
        : 'requested';

    return {
      id: String(raw.id ?? raw.booking_id ?? raw.trip_id ?? ''),
      riderId: String(raw.rider_id ?? raw.passenger_id ?? raw.user_id ?? mobileAuth.getUser()?.id ?? ''),
      tripId: raw.trip_id ? String(raw.trip_id) : undefined,
      driverId: raw.driver_id ? String(raw.driver_id) : undefined,
      driverName: (raw.driver_name as string) ?? trip?.driver?.name,
      vehicleId: raw.vehicle_id ? String(raw.vehicle_id) : undefined,
      rating: typeof raw.rating === 'number' ? raw.rating : trip?.driver?.rating,
      origin: { latitude: Number(raw.origin_lat ?? 0), longitude: Number(raw.origin_lng ?? 0), address: originAddress },
      destination: { latitude: Number(raw.dest_lat ?? 0), longitude: Number(raw.dest_lng ?? 0), address: destAddress },
      status,
      fare: Number(raw.fare ?? raw.price_per_seat ?? raw.total_price ?? 0),
      distance: typeof raw.distance === 'number' ? raw.distance : undefined,
      duration: typeof raw.duration === 'number' ? raw.duration : undefined,
      seats: Number(raw.seats_requested ?? raw.seats ?? trip?.seats ?? 1),
      requestedAt: String(raw.created_at ?? raw.departure_time ?? new Date().toISOString()),
      matchedAt: raw.matched_at ? String(raw.matched_at) : undefined,
      startedAt: raw.started_at ? String(raw.started_at) : undefined,
      completedAt: raw.completed_at ? String(raw.completed_at) : undefined,
      cancelledAt: raw.cancelled_at ? String(raw.cancelled_at) : undefined,
    };
  }

  private mapActiveTripToRide(activeTrip: Record<string, unknown>): Ride {
    const payload = activeTrip as Record<string, unknown>;
    const driver = (payload.driver as Record<string, unknown>) ?? {};
    const vehicle = (payload.vehicle as Record<string, unknown>) ?? {};
    return {
      id: String(payload.id ?? payload.trip_id ?? ''),
      riderId: String(payload.userId ?? mobileAuth.getUser()?.id ?? ''),
      tripId: payload.trip_id ? String(payload.trip_id) : undefined,
      driverId: driver.id ? String(driver.id) : undefined,
      driverName: driver.name ? String(driver.name) : undefined,
      vehicleId: vehicle.id ? String(vehicle.id) : undefined,
      rating: undefined,
      origin: { latitude: 0, longitude: 0, address: String(payload.from ?? '') },
      destination: { latitude: 0, longitude: 0, address: String(payload.to ?? '') },
      status: this.mapActiveTripStatus(String(payload.status ?? '')),
      fare: Number(payload.price ?? 0),
      distance: undefined,
      duration: typeof payload.duration === 'number' ? payload.duration : undefined,
      seats: Number(payload.passengers ?? 1),
      requestedAt: String(payload.startedAt ?? payload.created_at ?? new Date().toISOString()),
      matchedAt: payload.matchedAt ? String(payload.matchedAt) : undefined,
      startedAt: payload.startedAt ? String(payload.startedAt) : undefined,
    };
  }

  private mapActiveTripStatus(status: string): RideStatus {
    if (status === 'en_route' || status === 'en_route_to_pickup') return 'in_progress';
    if (status === 'driver_arrived') return 'in_progress';
    if (status === 'arriving') return 'in_progress';
    if (status === 'completed') return 'completed';
    return 'matched';
  }

  private mapDriverRatingToDriver(rating: DriverRatingResponse, driverId: string): Driver {
    return {
      id: driverId,
      name: '',
      phone: '',
      rating: rating.averageRating,
      totalRides: rating.totalRatings,
      vehicleModel: '',
      vehiclePlate: '',
      photo: undefined,
    };
  }
}

export const rideLifecycle = new RideLifecycleService();
