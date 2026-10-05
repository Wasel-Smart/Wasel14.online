jest.mock('../lib/config', () => ({
  waselMobileConfig: {
    hasSupabase: true,
    apiUrl: 'https://api.test.wasel',
    authRedirectUrl: 'wasel://auth/callback',
  },
}));

jest.mock('../services/auth', () => ({
  mobileAuth: {
    getUser: jest.fn().mockReturnValue({ id: 'user-1' }),
    getAccessToken: jest.fn().mockReturnValue('test-token'),
  },
}));

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
}));

import { apiClient } from '../lib/api';
import { paymentService } from '../services/payments';
import { Linking } from 'react-native';

describe('PaymentService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(apiClient, 'get').mockResolvedValue({ data: null, error: null, status: 200 });
    jest.spyOn(apiClient, 'post').mockResolvedValue({ data: null, error: null, status: 200 });
    jest.spyOn(apiClient, 'patch').mockResolvedValue({ data: null, error: null, status: 200 });
    jest.spyOn(apiClient, 'delete').mockResolvedValue({ data: null, error: null, status: 200 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getWalletBalance', () => {
    it('returns balance data on success', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValue({
        data: { balance: 50, pending_balance: 10, currency: 'JOD' },
        error: null,
        status: 200,
      });

      const result = await paymentService.getWalletBalance('user-1');
      expect(result.available).toBe(50);
      expect(result.pending).toBe(10);
      expect(result.total).toBe(60);
      expect(result.currency).toBe('JOD');
    });

    it('returns zero balance on error', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValue({
        data: null,
        error: 'DB error',
        status: 500,
      });

      const result = await paymentService.getWalletBalance('user-1');
      expect(result.available).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.total).toBe(0);
      expect(result.currency).toBe('JOD');
    });
  });

  describe('getPaymentMethods', () => {
    it('maps backend rows to PaymentMethod objects', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValue({
        data: {
          methods: [
            {
              id: 'pm-1',
              payment_method_id: 'pm-1',
              method_type: 'card',
              token_reference: '**** 1234',
              is_default: true,
              provider: 'stripe',
              status: 'active',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
        error: null,
        status: 200,
      });

      const result = await paymentService.getPaymentMethods('user-1');
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('pm-1');
      expect(result[0]!.type).toBe('card');
      expect(result[0]!.token_reference).toBe('**** 1234');
      expect(result[0]!.isDefault).toBe(true);
    });

    it('returns empty array on error', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValue({
        data: { methods: [] },
        error: 'DB error',
        status: 500,
      });

      const result = await paymentService.getPaymentMethods('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('addFunds', () => {
    it('returns error for invalid amount', async () => {
      const result = await paymentService.addFunds('user-1', 5, 'JOD');
      expect(result.success).toBe(false);
      expect(result.error).toContain('between 10 and');
    });

    it('creates top-up session on success', async () => {
      jest.spyOn(apiClient, 'post').mockResolvedValue({
        data: {
          payment: {
            transactionId: 'pi-123',
            checkoutUrl: 'https://checkout.test',
            status: 'requires_action',
            provider: 'stripe',
          },
        },
        error: null,
        status: 200,
      });

      const result = await paymentService.addFunds('user-1', 100, 'JOD');
      expect(result.success).toBe(true);
      expect(result.checkoutUrl).toBe('https://checkout.test');
      expect(result.paymentId).toBe('pi-123');
      expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.test');
    });
  });

  describe('removePaymentMethod', () => {
    it('returns true on successful removal', async () => {
      jest.spyOn(apiClient, 'delete').mockResolvedValue({
        data: { success: true },
        error: null,
        status: 200,
      });

      const result = await paymentService.removePaymentMethod('user-1', 'pm-1');
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      jest.spyOn(apiClient, 'delete').mockResolvedValue({
        data: null,
        error: 'DB error',
        status: 500,
      });

      const result = await paymentService.removePaymentMethod('user-1', 'pm-1');
      expect(result).toBe(false);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('sets default and returns true on success', async () => {
      jest.spyOn(apiClient, 'patch').mockResolvedValue({
        data: { success: true },
        error: null,
        status: 200,
      });

      const result = await paymentService.setDefaultPaymentMethod('user-1', 'pm-1');
      expect(result).toBe(true);
    });
  });
});
