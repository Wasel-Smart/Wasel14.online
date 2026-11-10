/**
 * Wasel Platform - Double-Entry COD & Settlement Ledger Engine
 * Enforces zero-sum accounting invariants for Cash on Delivery and Ride fares.
 */

export type AccountType =
  | 'COURIER_CASH_HOLDING'
  | 'MERCHANT_PAYABLE'
  | 'RIDER_PAYABLE'
  | 'PLATFORM_COMMISSION'
  | 'PLATFORM_ESCROW';

export interface LedgerPosting {
  id: string;
  orderOrTripId: string;
  entityType: 'package' | 'ride';
  debitAccount: AccountType;
  creditAccount: AccountType;
  amountJod: number;
  description: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface SettlementBatch {
  batchId: string;
  merchantOrDriverId: string;
  periodStart: string;
  periodEnd: string;
  totalCollectedJod: number;
  platformFeesJod: number;
  netPayoutJod: number;
  status: 'draft' | 'approved' | 'paid' | 'disputed';
  postings: LedgerPosting[];
}

function assertValidAmount ( name: string, value: number ): void {
  if ( !Number.isFinite( value ) || value < 0 ) {
    throw new RangeError( `${ name } must be a non-negative finite number (received ${ value })` );
  }
}

export class SettlementLedger {
  /**
   * Records completed package delivery with Cash-on-Delivery (COD).
   * 
   * Invariant:
   * 1. Courier holds full cash collected at doorstep.
   * 2. Platform collects delivery commission.
   * 3. Merchant receives net payout (COD - Delivery Fee).
   */
  public static recordPackageDeliveryCod ( params: {
    packageId: string;
    courierId: string;
    merchantId: string;
    totalCodCollectedJod: number;
    deliveryFeeJod: number;
    now?: string;
  } ): LedgerPosting[] {
    const timestamp = params.now || new Date().toISOString();
    assertValidAmount( 'totalCodCollectedJod', params.totalCodCollectedJod );
    assertValidAmount( 'deliveryFeeJod', params.deliveryFeeJod );
    if ( params.deliveryFeeJod > params.totalCodCollectedJod ) {
      // Posting this would leave PLATFORM_ESCROW overdrawn by the difference. The shortfall must be
      // settled separately (for example, billed to the merchant) rather than silently clamped.
      throw new RangeError(
        `deliveryFeeJod (${ params.deliveryFeeJod }) cannot exceed totalCodCollectedJod (${ params.totalCodCollectedJod })`,
      );
    }
    const netMerchantShare = Math.max( 0, params.totalCodCollectedJod - params.deliveryFeeJod );

    const postings: LedgerPosting[] = [
      // 1. Courier receives cash from recipient
      {
        id: `TX-PKG-CASH-${ params.packageId }`,
        orderOrTripId: params.packageId,
        entityType: 'package',
        debitAccount: 'COURIER_CASH_HOLDING',
        creditAccount: 'PLATFORM_ESCROW',
        amountJod: params.totalCodCollectedJod,
        description: `Cash on Delivery collected by courier ${ params.courierId }`,
        timestamp,
        metadata: { courierId: params.courierId, merchantId: params.merchantId },
      },
      // 2. Wasel deducts service fee
      {
        id: `TX-PKG-FEE-${ params.packageId }`,
        orderOrTripId: params.packageId,
        entityType: 'package',
        debitAccount: 'PLATFORM_ESCROW',
        creditAccount: 'PLATFORM_COMMISSION',
        amountJod: params.deliveryFeeJod,
        description: `Wasel delivery fee for package #${ params.packageId }`,
        timestamp,
      },
      // 3. Remainder credited to Merchant Payable
      {
        id: `TX-PKG-MERCHANT-${ params.packageId }`,
        orderOrTripId: params.packageId,
        entityType: 'package',
        debitAccount: 'PLATFORM_ESCROW',
        creditAccount: 'MERCHANT_PAYABLE',
        amountJod: netMerchantShare,
        description: `Net payout for merchant ${ params.merchantId }`,
        timestamp,
        metadata: { merchantId: params.merchantId },
      },
    ];

    return postings;
  }

  /**
   * Records cash ride completion.
   * Courier/Driver receives cash from rider; owes platform commission.
   */
  public static recordCashRideCompletion ( params: {
    tripId: string;
    driverId: string;
    riderId: string;
    totalFareJod: number;
    platformCommissionJod: number;
    now?: string;
  } ): LedgerPosting[] {
    assertValidAmount( 'totalFareJod', params.totalFareJod );
    assertValidAmount( 'platformCommissionJod', params.platformCommissionJod );
    if ( params.platformCommissionJod > params.totalFareJod ) {
      throw new RangeError(
        `platformCommissionJod (${ params.platformCommissionJod }) cannot exceed totalFareJod (${ params.totalFareJod })`,
      );
    }
    const timestamp = params.now || new Date().toISOString();

    return [
      {
        id: `TX-RIDE-CASH-${ params.tripId }`,
        orderOrTripId: params.tripId,
        entityType: 'ride',
        debitAccount: 'COURIER_CASH_HOLDING',
        creditAccount: 'PLATFORM_COMMISSION',
        amountJod: params.platformCommissionJod,
        description: `Wasel ride commission owed by driver ${ params.driverId }`,
        timestamp,
        metadata: { driverId: params.driverId, riderId: params.riderId },
      },
    ];
  }

  /**
   * Verifies that total debits equal total credits across a transaction slice (Accounting Integrity Check).
   */
  public static verifyZeroSum ( postings: LedgerPosting[] ): boolean {
    const balances: Record<string, number> = {};

    for ( const p of postings ) {
      balances[ p.debitAccount ] = ( balances[ p.debitAccount ] || 0 ) + p.amountJod;
      balances[ p.creditAccount ] = ( balances[ p.creditAccount ] || 0 ) - p.amountJod;
    }

    const netDiscrepancy = Object.values( balances ).reduce( ( acc, val ) => acc + val, 0 );
    return Math.abs( netDiscrepancy ) < 0.0001;
  }

  /**
   * Verifies that PLATFORM_ESCROW nets to zero across a slice, i.e. everything held in escrow was
   * released. verifyZeroSum cannot catch this because every posting is individually balanced.
   */
  public static verifyEscrowSettled ( postings: LedgerPosting[] ): boolean {
    let escrow = 0;
    for ( const p of postings ) {
      if ( p.debitAccount === 'PLATFORM_ESCROW' ) { escrow += p.amountJod; }
      if ( p.creditAccount === 'PLATFORM_ESCROW' ) { escrow -= p.amountJod; }
    }
    return Math.abs( escrow ) < 0.0001;
  }
}

