import { describe, expect, it } from 'vitest';
import { SettlementLedger, type AccountType, type LedgerPosting } from '@/domain/payments/settlement';

function netBalance(postings: LedgerPosting[], account: AccountType): number {
  return postings.reduce((sum, p) => {
    if (p.debitAccount === account) {return sum + p.amountJod;}
    if (p.creditAccount === account) {return sum - p.amountJod;}
    return sum;
  }, 0);
}

const NOW = '2026-11-10T00:00:00.000Z';

describe('SettlementLedger: escrow integrity', () => {
  it('leaves escrow empty after a normal COD delivery', () => {
    const postings = SettlementLedger.recordPackageDeliveryCod({
      packageId: 'PKG-1',
      courierId: 'C-1',
      merchantId: 'M-1',
      totalCodCollectedJod: 35,
      deliveryFeeJod: 3.5,
      now: NOW,
    });
    expect(netBalance(postings, 'PLATFORM_ESCROW')).toBeCloseTo(0, 6);
    expect(netBalance(postings, 'MERCHANT_PAYABLE')).toBeCloseTo(-31.5, 6);
    expect(netBalance(postings, 'PLATFORM_COMMISSION')).toBeCloseTo(-3.5, 6);
  });

  it('leaves escrow empty when the fee equals the collected cash', () => {
    const postings = SettlementLedger.recordPackageDeliveryCod({
      packageId: 'PKG-2',
      courierId: 'C-1',
      merchantId: 'M-1',
      totalCodCollectedJod: 5,
      deliveryFeeJod: 5,
      now: NOW,
    });
    expect(netBalance(postings, 'PLATFORM_ESCROW')).toBeCloseTo(0, 6);
    expect(netBalance(postings, 'MERCHANT_PAYABLE')).toBeCloseTo(0, 6);
  });

  it('uses deterministic ids and the supplied timestamp', () => {
    const postings = SettlementLedger.recordPackageDeliveryCod({
      packageId: 'PKG-3',
      courierId: 'C-1',
      merchantId: 'M-1',
      totalCodCollectedJod: 10,
      deliveryFeeJod: 1,
      now: NOW,
    });
    expect(postings.map(p => p.id)).toEqual([
      'TX-PKG-CASH-PKG-3',
      'TX-PKG-FEE-PKG-3',
      'TX-PKG-MERCHANT-PKG-3',
    ]);
    expect(postings.every(p => p.timestamp === NOW)).toBe(true);
    expect(postings.every(p => p.entityType === 'package')).toBe(true);
  });

  it('reports an empty slice as balanced', () => {
    expect(SettlementLedger.verifyZeroSum([])).toBe(true);
  });

  it('confirms escrow is settled for a normal delivery', () => {
    const postings = SettlementLedger.recordPackageDeliveryCod({
      packageId: 'PKG-4',
      courierId: 'C-1',
      merchantId: 'M-1',
      totalCodCollectedJod: 20,
      deliveryFeeJod: 2,
      now: NOW,
    });
    expect(SettlementLedger.verifyEscrowSettled(postings)).toBe(true);
  });

  it('detects an escrow account that was not fully released', () => {
    const postings = SettlementLedger.recordPackageDeliveryCod({
      packageId: 'PKG-5',
      courierId: 'C-1',
      merchantId: 'M-1',
      totalCodCollectedJod: 20,
      deliveryFeeJod: 2,
      now: NOW,
    });
    // Drop the merchant payout: every remaining posting is balanced, but escrow still holds 18 JOD.
    const withoutPayout = postings.filter(p => p.creditAccount !== 'MERCHANT_PAYABLE');
    expect(SettlementLedger.verifyZeroSum(withoutPayout)).toBe(true);
    expect(SettlementLedger.verifyEscrowSettled(withoutPayout)).toBe(false);
  });

  it('rejects a COD delivery whose fee exceeds the cash collected', () => {
    expect(() =>
      SettlementLedger.recordPackageDeliveryCod({
        packageId: 'PKG-6',
        courierId: 'C-1',
        merchantId: 'M-1',
        totalCodCollectedJod: 2,
        deliveryFeeJod: 5,
        now: NOW,
      }),
    ).toThrow(RangeError);
  });

  it.each([
    ['negative cash', -1, 1],
    ['negative fee', 10, -1],
    ['NaN cash', Number.NaN, 1],
    ['infinite fee', 10, Number.POSITIVE_INFINITY],
  ])('rejects invalid COD amounts: %s', (_label, cash, fee) => {
    expect(() =>
      SettlementLedger.recordPackageDeliveryCod({
        packageId: 'PKG-7',
        courierId: 'C-1',
        merchantId: 'M-1',
        totalCodCollectedJod: cash,
        deliveryFeeJod: fee,
        now: NOW,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a cash-ride commission above the fare or with invalid amounts', () => {
    const base = { tripId: 'T-1', driverId: 'D-1', riderId: 'R-1', now: NOW };
    expect(() =>
      SettlementLedger.recordCashRideCompletion({ ...base, totalFareJod: 5, platformCommissionJod: 6 }),
    ).toThrow(RangeError);
    expect(() =>
      SettlementLedger.recordCashRideCompletion({ ...base, totalFareJod: -5, platformCommissionJod: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      SettlementLedger.recordCashRideCompletion({ ...base, totalFareJod: 5, platformCommissionJod: Number.NaN }),
    ).toThrow(RangeError);
  });

  it('allows a cash-ride commission equal to the fare', () => {
    const postings = SettlementLedger.recordCashRideCompletion({
      tripId: 'T-2',
      driverId: 'D-1',
      riderId: 'R-1',
      totalFareJod: 5,
      platformCommissionJod: 5,
      now: NOW,
    });
    expect(postings).toHaveLength(1);
    expect(SettlementLedger.verifyZeroSum(postings)).toBe(true);
  });
});
