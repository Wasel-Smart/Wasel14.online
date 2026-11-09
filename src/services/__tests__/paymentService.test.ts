import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as BackendWorkflowModule from '../backendWorkflow';

// ── Hoisted mocks (vi.mock factories are hoisted before const declarations) ──

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockSupabase = { auth: { getUser: mockGetUser } };
  return { mockGetUser, mockSupabase };
});

vi.mock('@/utils/supabase/client', () => ({
  supabase: mocks.mockSupabase,
}));

vi.mock('../backendWorkflow', async (importOriginal) => {
  const actual = await importOriginal<typeof BackendWorkflowModule>();
  return { ...actual, requestEdgeJson: vi.fn() };
});

vi.mock('../core', () => ({
  getAuthDetails: vi.fn(),
}));

vi.mock('../../shared/currency/currency', () => ({
  toMinorUnits: vi.fn((amount: number) => Math.round(amount * 100)),
}));

vi.mock('../../domain/payments/cliq', () => ({
  generateJordanCliqDeeplink: vi.fn(() => 'cliq://deeplink'),
  generateJordanCliqQrPayload: vi.fn(() => 'QR_PAYLOAD'),
}));

import { paymentService } from '../payment';
import { requestEdgeJson } from '../backendWorkflow';
import { getAuthDetails } from '../core';

const mockRequestEdge = vi.mocked(requestEdgeJson);
const mockGetAuth = vi.mocked(getAuthDetails);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('paymentService', () => {
  beforeEach(() => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockGetAuth.mockResolvedValue({ token: 'tok', userId: 'user-1' });
  });

  afterEach(() => vi.clearAllMocks());

  // ── createPaymentIntent ──────────────────────────────────────────────────

  describe('createPaymentIntent', () => {
    it('returns clientSecret and paymentIntentId on success', async () => {
      mockRequestEdge.mockResolvedValueOnce({
        clientSecret: 'pi_secret_123',
        paymentIntentId: 'pi_123',
      });

      const result = await paymentService.createPaymentIntent({
        amount: 10,
        currency: 'jod',
        bookingId: 'booking-1',
      });

      expect(result.clientSecret).toBe('pi_secret_123');
      expect(result.paymentIntentId).toBe('pi_123');
    });

    it('accepts client_secret as fallback field name', async () => {
      mockRequestEdge.mockResolvedValueOnce({
        client_secret: 'pi_secret_alt',
        paymentIntentId: 'pi_alt',
      });

      const result = await paymentService.createPaymentIntent({ amount: 5, bookingId: 'booking-2' });
      expect(result.clientSecret).toBe('pi_secret_alt');
    });

    it('throws when amount is below minimum (< 0.50 JOD = 50 fils)', async () => {
      await expect(
        paymentService.createPaymentIntent({ amount: 0.49, bookingId: 'b-1' }),
      ).rejects.toThrow('Payment amount must be at least 0.50');
    });

    it('throws BackendRequestError when response is missing clientSecret', async () => {
      mockRequestEdge.mockResolvedValueOnce({ paymentIntentId: 'pi_1' });

      await expect(
        paymentService.createPaymentIntent({ amount: 5, bookingId: 'b-1' }),
      ).rejects.toMatchObject({ name: 'BackendRequestError', status: 502 });
    });

    it('throws BackendRequestError when user is not authenticated', async () => {
      mocks.mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Not authed' } });

      await expect(
        paymentService.createPaymentIntent({ amount: 5, bookingId: 'b-1' }),
      ).rejects.toMatchObject({ name: 'BackendRequestError', status: 401 });
    });
  });

  // ── processRefund ────────────────────────────────────────────────────────

  describe('processRefund', () => {
    it('returns refund details on success', async () => {
      mockRequestEdge.mockResolvedValueOnce({ refundId: 'ref_1', amount: 1000, status: 'succeeded' });

      const result = await paymentService.processRefund({ bookingId: 'b-1', amount: 10, reason: 'cancelled' });

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('ref_1');
      expect(result.status).toBe('succeeded');
    });

    it('uses amountMinor directly when provided', async () => {
      mockRequestEdge.mockResolvedValueOnce({ refundId: 'ref_2', amount: 500 });

      const result = await paymentService.processRefund({ bookingId: 'b-2', amountMinor: 500, reason: 'driver_no_show' });
      expect(result.amountMinor).toBe(500);
    });

    it('throws BackendRequestError when refundId is missing', async () => {
      mockRequestEdge.mockResolvedValueOnce({ status: 'failed' });

      await expect(
        paymentService.processRefund({ bookingId: 'b-3', reason: 'test' }),
      ).rejects.toMatchObject({ name: 'BackendRequestError', status: 502 });
    });
  });

  // ── getPaymentStatus ─────────────────────────────────────────────────────

  describe('getPaymentStatus', () => {
    it('returns status string from edge', async () => {
      mockRequestEdge.mockResolvedValueOnce('succeeded');
      const status = await paymentService.getPaymentStatus('booking-1');
      expect(status).toBe('succeeded');
    });

    it('URL-encodes the bookingId in the path', async () => {
      mockRequestEdge.mockResolvedValueOnce('pending');
      await paymentService.getPaymentStatus('booking/with/slashes');
      expect(mockRequestEdge).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('booking%2Fwith%2Fslashes') }),
      );
    });
  });

  // ── generateCliqPaymentDetails ───────────────────────────────────────────

  describe('generateCliqPaymentDetails', () => {
    it('returns deeplink and qrPayload', () => {
      const result = paymentService.generateCliqPaymentDetails('booking-1', 15.5);
      expect(result.deeplink).toBe('cliq://deeplink');
      expect(result.qrPayload).toBe('QR_PAYLOAD');
    });

    it('uses default alias WASELSMART when none provided', async () => {
      const { generateJordanCliqDeeplink } = await import('../../domain/payments/cliq');
      paymentService.generateCliqPaymentDetails('b-1', 10);
      expect(vi.mocked(generateJordanCliqDeeplink)).toHaveBeenCalledWith(
        expect.objectContaining({ identifierValue: 'WASELSMART' }),
      );
    });
  });

  // ── security ─────────────────────────────────────────────────────────────

  it('does not expose verifyWebhookSignature in the browser', () => {
    expect('verifyWebhookSignature' in paymentService).toBe(false);
  });
});
