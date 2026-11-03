import { API_ENDPOINTS, apiGet, apiPost } from '@/utils/api';

export interface CancelBookingRequest {
  bookingId: string;
  reason: string;
  refundRequested?: boolean;
}

export interface CancelTripRequest {
  tripId: string;
  reason: string;
}

class CancellationService {
  async cancelBooking({ bookingId, reason, refundRequested = true }: CancelBookingRequest): Promise<{ refundRequired: boolean }> {
    const response = await apiPost<{ ok: boolean; refundRequired?: boolean }>(
      API_ENDPOINTS.CANCELLATIONS_BOOKING,
      { bookingId, reason, refundRequested },
    );
    return { refundRequired: Boolean(response.refundRequired) };
  }

  async cancelTrip({ tripId, reason }: CancelTripRequest): Promise<{ refundRequired: boolean }> {
    const response = await apiPost<{ ok: boolean; refundRequired?: boolean }>(
      API_ENDPOINTS.CANCELLATIONS_TRIP,
      { tripId, reason },
    );
    return { refundRequired: Boolean(response.refundRequired) };
  }

  async canCancelBooking(bookingId: string): Promise<{ canCancel: boolean; reason?: string }> {
    return apiGet<{ canCancel: boolean; reason?: string }>(
      API_ENDPOINTS.CANCELLATIONS_ELIGIBILITY(encodeURIComponent(bookingId)),
    );
  }
}

export const cancellationService = new CancellationService();
