import { describe, it, expect } from 'vitest';
import {
  WaselError,
  ErrorCategory,
  ErrorSeverity,
  ErrorCodes,
  createAuthError,
  createWalletError,
  createPaymentError,
  createRideError,
  createPackageError,
  createNetworkError,
  createValidationError,
  createPermissionError,
  createSystemError,
  handleError,
  isRetryableError,
  getUserMessage,
} from '../../src/utils/errors';

describe('WaselError', () => {
  it('constructs with all required fields', () => {
    const err = new WaselError({
      code: 'AUTH_001',
      message: 'Invalid credentials',
      category: ErrorCategory.AUTH,
      severity: ErrorSeverity.HIGH,
    });
    expect(err.name).toBe('WaselError');
    expect(err.code).toBe('AUTH_001');
    expect(err.category).toBe(ErrorCategory.AUTH);
    expect(err.severity).toBe(ErrorSeverity.HIGH);
    expect(err.retryable).toBe(false);
    expect(err.timestamp).toBeGreaterThan(0);
  });

  it('sets default user message per category', () => {
    const categories: [ErrorCategory, string][] = [
      [ErrorCategory.AUTH, 'Authentication failed'],
      [ErrorCategory.WALLET, 'Wallet operation failed'],
      [ErrorCategory.PAYMENT, 'Payment failed'],
      [ErrorCategory.RIDE, 'Ride operation failed'],
      [ErrorCategory.PACKAGE, 'Package operation failed'],
      [ErrorCategory.NETWORK, 'Network error'],
      [ErrorCategory.VALIDATION, 'Invalid input'],
      [ErrorCategory.PERMISSION, 'You do not have permission'],
      [ErrorCategory.SYSTEM, 'System error'],
    ];
    for (const [category, expected] of categories) {
      const err = new WaselError({ code: 'AUTH_001', message: 'x', category, severity: ErrorSeverity.LOW });
      expect(err.userMessage).toContain(expected.split(' ')[0]);
    }
  });

  it('serializes to JSON without stack trace', () => {
    const err = new WaselError({
      code: 'SYSTEM_001',
      message: 'boom',
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
    });
    const json = err.toJSON();
    expect(json).not.toHaveProperty('stack');
    expect(json.code).toBe('SYSTEM_001');
    expect(json.category).toBe(ErrorCategory.SYSTEM);
  });

  it('stores context with timestamp', () => {
    const err = new WaselError({
      code: 'AUTH_001',
      message: 'x',
      category: ErrorCategory.AUTH,
      severity: ErrorSeverity.HIGH,
      context: { userId: 'u1' },
    });
    expect(err.context.userId).toBe('u1');
    expect(err.context.timestamp).toBeGreaterThan(0);
  });
});

describe('Error factory functions', () => {
  it('createAuthError returns non-retryable AUTH error', () => {
    const err = createAuthError('AUTH_001');
    expect(err.category).toBe(ErrorCategory.AUTH);
    expect(err.retryable).toBe(false);
  });

  it('createWalletError marks WALLET_002 as retryable', () => {
    const err = createWalletError('WALLET_002');
    expect(err.retryable).toBe(true);
  });

  it('createWalletError marks WALLET_001 as non-retryable', () => {
    const err = createWalletError('WALLET_001');
    expect(err.retryable).toBe(false);
  });

  it('createPaymentError marks PAYMENT_003 as retryable', () => {
    const err = createPaymentError('PAYMENT_003');
    expect(err.retryable).toBe(true);
    expect(err.severity).toBe(ErrorSeverity.CRITICAL);
  });

  it('createRideError marks RIDE_001 as retryable', () => {
    const err = createRideError('RIDE_001');
    expect(err.retryable).toBe(true);
  });

  it('createPackageError marks PACKAGE_004 as retryable', () => {
    const err = createPackageError('PACKAGE_004');
    expect(err.retryable).toBe(true);
  });

  it('createNetworkError is always retryable', () => {
    const err = createNetworkError('NETWORK_001');
    expect(err.retryable).toBe(true);
    expect(err.category).toBe(ErrorCategory.NETWORK);
  });

  it('createValidationError is non-retryable LOW severity', () => {
    const err = createValidationError('VALIDATION_001');
    expect(err.retryable).toBe(false);
    expect(err.severity).toBe(ErrorSeverity.LOW);
  });

  it('createPermissionError is non-retryable', () => {
    const err = createPermissionError('PERMISSION_001');
    expect(err.retryable).toBe(false);
  });

  it('createSystemError marks SYSTEM_008 as retryable', () => {
    const err = createSystemError('SYSTEM_008');
    expect(err.retryable).toBe(true);
  });
});

describe('handleError', () => {
  it('passes through WaselError unchanged', () => {
    const original = createAuthError('AUTH_001');
    const result = handleError(original);
    expect(result).toBe(original);
  });

  it('wraps network Error as NETWORK category', () => {
    const err = handleError(new Error('Failed to fetch'));
    expect(err.category).toBe(ErrorCategory.NETWORK);
    expect(err.retryable).toBe(true);
  });

  it('wraps TypeError as NETWORK category', () => {
    const te = new TypeError('network issue');
    const err = handleError(te);
    expect(err.category).toBe(ErrorCategory.NETWORK);
  });

  it('wraps generic Error as SYSTEM category', () => {
    const err = handleError(new Error('something broke'));
    expect(err.category).toBe(ErrorCategory.SYSTEM);
  });

  it('wraps non-Error as SYSTEM category', () => {
    const err = handleError('string error');
    expect(err.category).toBe(ErrorCategory.SYSTEM);
    expect(err.message).toBe('string error');
  });
});

describe('isRetryableError', () => {
  it('returns true for retryable WaselError', () => {
    expect(isRetryableError(createNetworkError('NETWORK_001'))).toBe(true);
  });

  it('returns false for non-retryable WaselError', () => {
    expect(isRetryableError(createAuthError('AUTH_001'))).toBe(false);
  });

  it('returns false for non-WaselError', () => {
    expect(isRetryableError(new Error('x'))).toBe(false);
  });
});

describe('getUserMessage', () => {
  it('returns userMessage from WaselError', () => {
    const err = createAuthError('AUTH_001');
    expect(getUserMessage(err)).toBe(err.userMessage);
  });

  it('returns message from plain Error', () => {
    expect(getUserMessage(new Error('plain'))).toBe('plain');
  });

  it('returns fallback for unknown', () => {
    expect(getUserMessage(null)).toContain('unexpected error');
  });
});

describe('ErrorCodes registry', () => {
  it('has all expected auth codes', () => {
    expect(ErrorCodes.AUTH_001).toBeDefined();
    expect(ErrorCodes.AUTH_010).toBeDefined();
  });

  it('has all expected payment codes', () => {
    expect(ErrorCodes.PAYMENT_001).toBeDefined();
    expect(ErrorCodes.PAYMENT_010).toBeDefined();
  });
});
