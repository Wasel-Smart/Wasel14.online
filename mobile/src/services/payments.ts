/**
 * Mobile Payment Service - Unified with backend wallet wallet APIs
 * Uses the canonical backend wallet endpoints (/v1/wallet/{userId}/...)
 */
import { Linking } from 'react-native';
import { apiClient } from '../lib/api';
import { mobileAuth } from './auth';

export interface WalletBalance {
  available: number;
  pending: number;
  total: number;
  currency: string;
}

export interface PaymentMethod {
  id: string;
  payment_method_id: string;
  type: string | null;
  provider: string | null;
  token_reference: string | null;
  isDefault: boolean;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  clientSecret?: string;
  checkoutUrl?: string;
  status?: string;
  error?: string;
}

export interface TopUpSession {
  transactionId: string;
  provider: string;
  status: string;
  checkoutUrl: string | null;
  sessionId: string | null;
}

export interface SendMoneyResult {
  success: boolean;
  note?: string;
  error?: string;
}

export interface WithdrawResult {
  success: boolean;
  error?: string;
}

const MIN_TOPUP_AMOUNT = 10;
const MAX_TOPUP_AMOUNT = 2000;
const MIN_WITHDRAW_AMOUNT = 1;
const MAX_WITHDRAW_AMOUNT = 2000;
const MIN_TRANSFER_AMOUNT = 1;
const MAX_TRANSFER_AMOUNT = 1000;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function getWalletPath(userId: string, suffix = ''): string {
  return `/v1/wallet/${encodeURIComponent(userId)}${suffix}`;
}

class PaymentService {
  async getWalletBalance(userId: string): Promise<WalletBalance> {
    try {
      const response = await apiClient.get<Record<string, unknown>>(getWalletPath(userId));
      if (response.error || !response.data) {
        return { available: 0, pending: 0, total: 0, currency: 'JOD' };
      }
      const data = response.data;
      const available = Number(data.balance ?? 0);
      const pending = Number(data.pendingBalance ?? 0);
      return {
        available,
        pending,
        total: available + pending,
        currency: String(data.currency ?? 'JOD'),
      };
    } catch (error) {
      console.error('[PaymentService] Get balance error:', error);
      return { available: 0, pending: 0, total: 0, currency: 'JOD' };
    }
  }

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const response = await apiClient.get<{ methods: unknown[] }>(getWalletPath(userId, '/payment-methods'));
      if (response.error || !response.data) return [];

      return (response.data.methods ?? []).map((row): PaymentMethod => {
        const method = row as Record<string, unknown>;
        return {
          id: String(method.id ?? method.payment_method_id ?? ''),
          payment_method_id: String(method.payment_method_id ?? method.id ?? ''),
          type: method.method_type as string | null,
          provider: String(method.provider ?? null),
          token_reference: String(method.token_reference ?? null),
          isDefault: Boolean(method.is_default),
          status: String(method.status ?? 'active'),
          createdAt: String(method.created_at ?? null),
          updatedAt: String(method.updated_at ?? null),
        };
      });
    } catch (error) {
      console.error('[PaymentService] Get payment methods error:', error);
      return [];
    }
  }

  async addFunds(userId: string, amount: number, _currency: string): Promise<PaymentResult> {
    try {
      if (amount < MIN_TOPUP_AMOUNT || amount > MAX_TOPUP_AMOUNT) {
        return { success: false, error: `Amount must be between ${MIN_TOPUP_AMOUNT} and ${MAX_TOPUP_AMOUNT} JOD` };
      }

      const response = await apiClient.post<{ payment?: TopUpSession } & Record<string, unknown>>(
        getWalletPath(userId, '/top-up'),
        { amount, paymentMethod: 'card' },
      );

      if (response.error || !response.data) {
        return { success: false, error: response.error ?? 'Payment failed' };
      }

      const payment = response.data.payment;
      if (!payment?.checkoutUrl) {
        return { success: false, error: 'No checkout URL returned' };
      }

      const opened = await Linking.openURL(payment.checkoutUrl);
      if (!opened) {
        return { success: false, error: 'Unable to open payment checkout' };
      }

      return {
        success: true,
        paymentId: payment.transactionId,
        status: payment.status,
        checkoutUrl: payment.checkoutUrl,
      };
    } catch (error) {
      console.error('[PaymentService] Add funds error:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async withdrawFunds(userId: string, amount: number, bankAccount: string, method = 'bank_transfer', pin?: string): Promise<WithdrawResult> {
    try {
      if (amount <= 0) {
        return { success: false, error: 'Amount must be greater than zero' };
      }
      if (amount > MAX_WITHDRAW_AMOUNT) {
        return { success: false, error: `Withdrawals are limited to JOD ${MAX_WITHDRAW_AMOUNT} per request` };
      }
      if (!bankAccount) {
        return { success: false, error: 'Bank account is required' };
      }

      const response = await apiClient.post(
        getWalletPath(userId, '/withdraw'),
        { amount, bankAccount, method, ...(pin ? { pin } : {}) },
      );

      if (response.error) {
        return { success: false, error: response.error };
      }
      return { success: true };
    } catch (error) {
      console.error('[PaymentService] Withdraw error:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async sendMoney(userId: string, recipientId: string, amount: number, note?: string, pin?: string): Promise<SendMoneyResult> {
    try {
      if (!recipientId) {
        return { success: false, error: 'Recipient ID is required' };
      }
      if (amount <= 0) {
        return { success: false, error: 'Amount must be greater than zero' };
      }
      if (amount > MAX_TRANSFER_AMOUNT) {
        return { success: false, error: `Transfers are limited to JOD ${MAX_TRANSFER_AMOUNT} per request` };
      }
      if (recipientId === userId) {
        return { success: false, error: 'Cannot send money to the same account' };
      }

      const response = await apiClient.post<{ success?: boolean; note?: string } & Record<string, unknown>>(
        getWalletPath(userId, '/send'),
        { recipientId, amount, note, ...(pin ? { pin } : {}) },
      );

      if (response.error) {
        return { success: false, error: response.error };
      }
      return { success: true, note: response.data?.note };
    } catch (error) {
      console.error('[PaymentService] Send money error:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async addPaymentMethod(userId: string, method: { type: string; provider: string; token_reference: string; is_default?: boolean }): Promise<PaymentResult> {
    try {
      const response = await apiClient.post(
        getWalletPath(userId, '/payment-methods'),
        {
          type: method.type,
          provider: method.provider,
          token_reference: method.token_reference,
          is_default: Boolean(method.is_default),
        },
      );

      if (response.error || !response.data) {
        return { success: false, error: response.error ?? 'Failed to add payment method' };
      }
      return { success: true };
    } catch (error) {
      console.error('[PaymentService] Add payment method error:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async removePaymentMethod(userId: string, paymentMethodId: string): Promise<boolean> {
    try {
      const response = await apiClient.delete<{ success?: boolean }>(
        getWalletPath(userId, `/payment-methods/${encodeURIComponent(paymentMethodId)}`),
      );

      if (response.error) {
        console.error('[PaymentService] Remove payment method error:', response.error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[PaymentService] Remove payment method error:', error);
      return false;
    }
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<boolean> {
    try {
      const response = await apiClient.patch<{ success?: boolean }>(
        getWalletPath(userId, `/payment-methods/${encodeURIComponent(paymentMethodId)}`),
        {},
      );

      if (response.error) {
        console.error('[PaymentService] Set default payment method error:', response.error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[PaymentService] Set default payment method error:', error);
      return false;
    }
  }
}

export const paymentService = new PaymentService();

export async function createTopUpSession({
  userId,
  amount,
}: {
  userId: string;
  amount: number;
}): Promise<TopUpSession> {
  const result = await paymentService.addFunds(userId, amount, 'jod');
  if (!result.success || !result.checkoutUrl) {
    throw new Error(result.error ?? 'Failed to create top-up session');
  }
  return {
    transactionId: result.paymentId ?? '',
    provider: 'stripe',
    status: result.status ?? 'requires_action',
    checkoutUrl: result.checkoutUrl,
    sessionId: result.paymentId ?? null,
  };
}

export async function createMobilePaymentSheet(params: {
  userId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}): Promise<{ clientSecret: string; paymentId?: string }> {
  const session = await createTopUpSession({ userId, amount });
  if (!session.checkoutUrl) {
    throw new Error('No checkout URL returned');
  }
  const opened = await Linking.openURL(session.checkoutUrl);
  if (!opened) {
    throw new Error('Unable to open payment checkout');
  }
  return { clientSecret: '', paymentId: session.transactionId };
}