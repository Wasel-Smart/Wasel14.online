import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock('@/utils/api', () => ({
  API_ENDPOINTS: {
    CANCELLATIONS_BOOKING: '/v1/cancellations/bookings',
    CANCELLATIONS_TRIP: '/v1/cancellations/trips',
    CANCELLATIONS_ELIGIBILITY: (id: string) => `/v1/cancellations/bookings/${id}/eligibility`,
  },
  apiGet,
  apiPost,
}));

import { cancellationService } from '@/services/cancellation';

describe('cancellationService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates booking cancellation to the authenticated edge API and returns refund state', async () => {
    apiPost.mockResolvedValue({ ok: true, refundRequired: true });
    await expect(cancellationService.cancelBooking({
      bookingId: 'booking-1', reason: 'Schedule change', refundRequested: true,
    })).resolves.toEqual({ refundRequired: true });
    expect(apiPost).toHaveBeenCalledWith('/v1/cancellations/bookings', {
      bookingId: 'booking-1', reason: 'Schedule change', refundRequested: true,
    });
  });

  it('propagates cancellation failures instead of pretending the ride was cancelled', async () => {
    apiPost.mockRejectedValue(new Error('Cancellation requires one hour before departure'));
    await expect(cancellationService.cancelBooking({ bookingId: 'booking-1', reason: 'Changed plans' }))
      .rejects.toThrow('Cancellation requires one hour before departure');
  });

  it('delegates trip cancellation to the atomic edge workflow', async () => {
    apiPost.mockResolvedValue({ ok: true, refundRequired: false });
    await expect(cancellationService.cancelTrip({ tripId: 'trip-1', reason: 'Driver unavailable' }))
      .resolves.toEqual({ refundRequired: false });
    expect(apiPost).toHaveBeenCalledWith('/v1/cancellations/trips', {
      tripId: 'trip-1', reason: 'Driver unavailable',
    });
  });

  it('loads cancellation eligibility from the server policy', async () => {
    apiGet.mockResolvedValue({ canCancel: false, reason: 'Too close to departure' });
    await expect(cancellationService.canCancelBooking('booking-1'))
      .resolves.toEqual({ canCancel: false, reason: 'Too close to departure' });
    expect(apiGet).toHaveBeenCalledWith('/v1/cancellations/bookings/booking-1/eligibility');
  });
});
