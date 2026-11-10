import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../core', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('./walletLocalStorage', () => ({
  toNumber: vi.fn((v: unknown, fb = 0) => (v === null || v === undefined ? fb : Number(v))),
  toWalletTransaction: vi.fn((row: unknown) => row),
}));

const walletDirectMocks = vi.hoisted(() => ({
  fetchWalletDirect: vi.fn(),
  getWalletTransactionRows: vi.fn(),
  getPaymentMethodsDirect: vi.fn(),
  addPaymentMethodDirect: vi.fn(),
  deletePaymentMethodDirect: vi.fn(),
  getTrustScoreDirect: vi.fn(),
  resolveCanonicalUserId: vi.fn(),
  findWalletByUserId: vi.fn(),
}));

vi.mock('./walletDirect', () => walletDirectMocks);

import {
  resolveCanonicalUserId,
  findWalletByUserId,
  fetchWalletDirect,
  getWalletTransactionRows,
  getPaymentMethodsDirect,
  addPaymentMethodDirect,
  deletePaymentMethodDirect,
  getTrustScoreDirect,
} from './walletDirect';

describe('walletDirect — direct Supabase tier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveCanonicalUserId', () => {
    it('returns auth_user_id match when found', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'canonical-123' }, error: null }),
      }));

      const result = await resolveCanonicalUserId('auth-user-123');
      expect(result).toBe('canonical-123');
    });

    it('falls back to id match when auth_user_id not found', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'canonical-456' }, error: null }),
        }));

      const result = await resolveCanonicalUserId('user-456');
      expect(result).toBe('canonical-456');
    });

    it('returns original key when no match found', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }));

      const result = await resolveCanonicalUserId('unknown-user');
      expect(result).toBe('unknown-user');
    });

    it('throws on database error during id lookup', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('db error') }),
        }));

      await expect(resolveCanonicalUserId('user-789')).rejects.toThrow('db error');
    });
  });

  describe('findWalletByUserId', () => {
    it('returns wallet row when found', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { wallet_id: 'w1', user_id: 'user-1', balance: 100, currency_code: 'JOD' },
          error: null,
        }),
      }));

      const result = await findWalletByUserId('user-1');
      expect(result).toEqual({ wallet_id: 'w1', user_id: 'user-1', balance: 100, currency_code: 'JOD' });
    });

    it('returns null when wallet not found', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      const result = await findWalletByUserId('user-2');
      expect(result).toBeNull();
    });

    it('throws on database error', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('db error') }),
      }));

      await expect(findWalletByUserId('user-3')).rejects.toThrow('db error');
    });
  });

  describe('fetchWalletDirect', () => {
    it('builds complete wallet payload with transactions and payment methods', async () => {
      const { supabase } = await import('../core');

      supabase.from
        .mockImplementationOnce(() => ({ // findWalletByUserId
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { wallet_id: 'w1', user_id: 'user-1', balance: 150, currency_code: 'JOD', wallet_status: 'active', created_at: '2026-01-01', auto_top_up_enabled: true, auto_top_up_amount: 25, auto_top_up_threshold: 10, pin_set: true },
            error: null,
          }),
        }))
        .mockImplementationOnce(() => ({ // transactions
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { transaction_id: 'tx1', amount: 50, direction: 'credit', transaction_type: 'add_funds', transaction_status: 'posted', created_at: '2026-01-02', metadata: { description: 'Top-up' } },
              { transaction_id: 'tx2', amount: 20, direction: 'debit', transaction_type: 'ride_payment', transaction_status: 'posted', created_at: '2026-01-03', metadata: { description: 'Ride to Amman' } },
            ],
            error: null,
          }),
        }))
        .mockImplementationOnce(() => ({ // payment methods
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'pm1', payment_method_id: 'pm_1', method_type: 'card', provider: 'stripe', last_four: '4242', is_default: true, status: 'active', created_at: '2026-01-01' }],
            error: null,
          }),
        }));

      const result = await fetchWalletDirect('user-1');

      expect(result.wallet.id).toBe('w1');
      expect(result.balance).toBe(150);
      expect(result.currency).toBe('JOD');
      expect(result.wallet.autoTopUp).toBe(true);
      expect(result.wallet.autoTopUpAmount).toBe(25);
      expect(result.wallet.pinSet).toBe(true);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].amount).toBe(-20); // debit is negative
      expect(result.transactions[1].amount).toBe(50); // credit is positive
      expect(result.wallet.paymentMethods).toHaveLength(1);
    });

    it('resolves canonical user id when wallet not found by original id', async () => {
      const { supabase } = await import('../core');

      supabase.from
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // not found by original id
        }))
        .mockImplementationOnce(() => ({ // resolveCanonicalUserId - auth_user_id
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'canonical-user' }, error: null }),
        }))
        .mockImplementationOnce(() => ({ // findWalletByUserId with canonical id
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { wallet_id: 'w2', user_id: 'canonical-user', balance: 200, currency_code: 'JOD' },
            error: null,
          }),
        }))
        .mockImplementationOnce(() => ({ // transactions
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }))
        .mockImplementationOnce(() => ({ // payment methods
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }));

      const result = await fetchWalletDirect('original-user');
      expect(result.wallet.id).toBe('w2');
      expect(result.balance).toBe(200);
    });

    it('throws when wallet not found after canonical resolution', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // canonical also not found
        }));

      await expect(fetchWalletDirect('user-404')).rejects.toThrow('Wallet not found');
    });

    it('limits transactions to 50 most recent', async () => {
      const { supabase } = await import('../core');
      const manyTx = Array.from({ length: 60 }, (_, i) => ({
        transaction_id: `tx${i}`,
        amount: 10,
        direction: 'credit',
        transaction_type: 'add_funds',
        transaction_status: 'posted',
        created_at: `2026-01-${String(i + 1).padStart(2, '0')}`,
        metadata: { description: `Top-up ${i}` },
      }));

      supabase.from
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { wallet_id: 'w1', user_id: 'user-1', balance: 600, currency_code: 'JOD' },
            error: null,
          }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: manyTx, error: null }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }));

      const result = await fetchWalletDirect('user-1');
      expect(result.transactions).toHaveLength(50);
    });

    it('uses default currency JOD when wallet has no currency_code', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { wallet_id: 'w1', user_id: 'user-1', balance: 100, currency_code: null },
            error: null,
          }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }));

      const result = await fetchWalletDirect('user-1');
      expect(result.currency).toBe('JOD');
    });
  });

  describe('getWalletTransactionRows', () => {
    it('converts wallet transactions to TransactionRow format', async () => {
      walletDirectMocks.fetchWalletDirect.mockResolvedValue({
        transactions: [
          { id: 'tx1', amount: -20, type: 'ride_payment', description: 'Ride', createdAt: '2026-01-01', status: 'posted' },
          { id: 'tx2', amount: 50, type: 'add_funds', description: 'Top-up', createdAt: '2026-01-02', status: 'posted' },
        ],
      } as unknown as ReturnType<typeof fetchWalletDirect>);

      const result = await getWalletTransactionRows('user-1');
      expect(result).toHaveLength(2);
      expect(result[0].transaction_id).toBe('tx1');
      expect(result[0].amount).toBe(20); // absolute value
      expect(result[0].direction).toBe('debit');
      expect(result[1].direction).toBe('credit');
    });
  });

  describe('getPaymentMethodsDirect', () => {
    it('returns payment methods from wallet', async () => {
      walletDirectMocks.fetchWalletDirect.mockResolvedValue({
        wallet: {
          paymentMethods: [
            { id: 'pm1', method_type: 'card', provider: 'stripe', last_four: '4242', is_default: true },
            { id: 'pm2', method_type: 'bank_transfer', provider: 'cliq', last_four: null, is_default: false },
          ],
        },
      } as unknown as ReturnType<typeof fetchWalletDirect>);

      const result = await getPaymentMethodsDirect('user-1');
      expect(result.methods).toHaveLength(2);
      expect(result.methods[0].is_default).toBe(true);
    });

    it('returns empty array when no payment methods', async () => {
      walletDirectMocks.fetchWalletDirect.mockResolvedValue({
        wallet: { paymentMethods: [] },
      } as unknown as ReturnType<typeof fetchWalletDirect>);

      const result = await getPaymentMethodsDirect('user-1');
      expect(result.methods).toEqual([]);
    });
  });

  describe('addPaymentMethodDirect', () => {
    it('inserts payment method with normalized type', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-pm', payment_method_id: 'pm_new', method_type: 'card', provider: 'stripe', last_four: '1234', is_default: false, status: 'active' },
          error: null,
        }),
      }));

      const result = await addPaymentMethodDirect('user-1', { type: 'card', provider: 'stripe', last4: '1234', is_default: false });
      expect(result.method_type).toBe('card');
      expect(result.provider).toBe('stripe');
    });

    it('normalizes apple_pay and google_pay to card', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-pm', method_type: 'card', provider: 'apple_pay' },
          error: null,
        }),
      }));

      const result = await addPaymentMethodDirect('user-1', { type: 'apple_pay', provider: 'apple_pay' });
      expect(result.method_type).toBe('card');
    });

    it('normalizes bank_transfer and instant to bank_transfer', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-pm', method_type: 'bank_transfer' },
          error: null,
        }),
      }));

      const result = await addPaymentMethodDirect('user-1', { type: 'instant', provider: 'bank' });
      expect(result.method_type).toBe('bank_transfer');
    });

    it('normalizes cliq to wallet', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-pm', method_type: 'wallet' },
          error: null,
        }),
      }));

      const result = await addPaymentMethodDirect('user-1', { type: 'cliq', provider: 'jopacc' });
      expect(result.method_type).toBe('wallet');
    });

    it('defaults unknown types to card', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'new-pm', method_type: 'card' },
          error: null,
        }),
      }));

      const result = await addPaymentMethodDirect('user-1', { type: 'unknown', provider: 'test' });
      expect(result.method_type).toBe('card');
    });

    it('throws on database error', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('insert failed') }),
      }));

      await expect(addPaymentMethodDirect('user-1', { type: 'card', provider: 'stripe' })).rejects.toThrow('insert failed');
    });
  });

  describe('deletePaymentMethodDirect', () => {
    it('deletes payment method by payment_method_id and user_id', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        mockResolvedValue: { error: null },
      }));

      const result = await deletePaymentMethodDirect('user-1', 'pm-123');
      expect(result).toEqual({ success: true });
    });

    it('retries with canonical user id when first delete fails', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          mockResolvedValue: { error: { message: 'not found' } },
        }))
        .mockImplementationOnce(() => ({ // resolveCanonicalUserId
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'canonical-user' }, error: null }),
        }))
        .mockImplementationOnce(() => ({
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          mockResolvedValue: { error: null },
        }));

      const result = await deletePaymentMethodDirect('user-1', 'pm-123');
      expect(result).toEqual({ success: true });
    });

    it('throws on persistent error', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          mockResolvedValue: { error: { message: 'not found' } },
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'canonical-user' }, error: null }),
        }))
        .mockImplementationOnce(() => ({
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          mockResolvedValue: { error: { message: 'still failed' } },
        }));

      await expect(deletePaymentMethodDirect('user-1', 'pm-123')).rejects.toThrow('still failed');
    });
  });

  describe('getTrustScoreDirect', () => {
    it('returns trip count from driver record', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({ // users
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-1', verification_level: 'level_1' }, error: null }),
        }))
        .mockImplementationOnce(() => ({ // wallets
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { balance: 250 }, error: null }),
        }))
        .mockImplementationOnce(() => ({ // drivers
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { driver_id: 'drv-1' }, error: null }),
        }))
        .mockImplementationOnce(() => ({ // trips count
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          mockResolvedValue: { count: 42, error: null },
        }));

      const result = await getTrustScoreDirect('user-1');
      expect(result.totalTrips).toBe(42);
      expect(result.deposit).toBe(250);
      expect(result.cashRating).toBeNull();
      expect(result.onTimePayments).toBeNull();
    });

    it('returns zero trips when no driver record', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { balance: 100 }, error: null }),
        }))
        .mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }));

      const result = await getTrustScoreDirect('user-1');
      expect(result.totalTrips).toBe(0);
      expect(result.deposit).toBe(100);
    });

    it('throws on user lookup error', async () => {
      const { supabase } = await import('../core');
      supabase.from.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('user lookup failed') }),
      }));

      await expect(getTrustScoreDirect('user-1')).rejects.toThrow('user lookup failed');
    });

    it('resolves canonical user id for lookups', async () => {
      const { supabase } = await import('../core');
      supabase.from
        .mockImplementationOnce(() => ({ // users - by auth_user_id
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'canonical-user' }, error: null }),
        }))
        .mockImplementationOnce(() => ({ // wallets
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { balance: 500 }, error: null }),
        }))
        .mockImplementationOnce(() => ({ // drivers
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }));

      const result = await getTrustScoreDirect('auth-user-123');
      expect(result.deposit).toBe(500);
    });
  });
});