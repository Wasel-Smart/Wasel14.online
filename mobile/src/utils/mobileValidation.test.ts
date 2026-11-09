import {
  validatePositiveNumber,
  validatePositiveInteger,
  validateRequiredText,
  validateRideRequest,
  validatePackageRequest,
  validateScheduledRide,
} from '../utils/mobileValidation';

describe('validatePositiveNumber', () => {
  it('accepts positive number string', () => {
    expect(validatePositiveNumber('5.5', 'Weight')).toEqual({ valid: true });
  });
  it('rejects zero', () => {
    const r = validatePositiveNumber('0', 'Weight');
    expect(r.valid).toBe(false);
    expect(r.message).toBeTruthy();
  });
  it('rejects negative', () => {
    expect(validatePositiveNumber('-1', 'Weight').valid).toBe(false);
  });
  it('rejects non-numeric string', () => {
    expect(validatePositiveNumber('abc', 'Weight').valid).toBe(false);
  });
  it('rejects Infinity', () => {
    expect(validatePositiveNumber('Infinity', 'Weight').valid).toBe(false);
  });
});

describe('validatePositiveInteger', () => {
  it('accepts positive integer', () => {
    expect(validatePositiveInteger('3', 'Seats')).toEqual({ valid: true });
  });
  it('rejects float', () => {
    const r = validatePositiveInteger('2.5', 'Seats');
    expect(r.valid).toBe(false);
    expect(r.message).toBeTruthy();
  });
  it('rejects zero', () => {
    expect(validatePositiveInteger('0', 'Seats').valid).toBe(false);
  });
  it('rejects non-numeric', () => {
    expect(validatePositiveInteger('abc', 'Seats').valid).toBe(false);
  });
});

describe('validateRequiredText', () => {
  it('accepts text with 2+ chars', () => {
    expect(validateRequiredText('Amman', 'City')).toEqual({ valid: true });
  });
  it('rejects single char', () => {
    expect(validateRequiredText('A', 'City').valid).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateRequiredText('', 'City').valid).toBe(false);
  });
  it('rejects whitespace only', () => {
    expect(validateRequiredText('  ', 'City').valid).toBe(false);
  });
});

describe('validateRideRequest', () => {
  it('accepts valid ride request', () => {
    expect(validateRideRequest('Amman', 'Aqaba', '2')).toEqual({ valid: true });
  });
  it('rejects empty pickup', () => {
    expect(validateRideRequest('', 'Aqaba', '2').valid).toBe(false);
  });
  it('rejects empty destination', () => {
    expect(validateRideRequest('Amman', '', '2').valid).toBe(false);
  });
  it('rejects invalid seats', () => {
    expect(validateRideRequest('Amman', 'Aqaba', '0').valid).toBe(false);
  });
  it('rejects float seats', () => {
    expect(validateRideRequest('Amman', 'Aqaba', '1.5').valid).toBe(false);
  });
});

describe('validatePackageRequest', () => {
  it('accepts valid package request', () => {
    expect(validatePackageRequest('Amman', 'Aqaba', '2.5')).toEqual({ valid: true });
  });
  it('rejects empty pickup', () => {
    expect(validatePackageRequest('', 'Aqaba', '2.5').valid).toBe(false);
  });
  it('rejects empty dropoff', () => {
    expect(validatePackageRequest('Amman', '', '2.5').valid).toBe(false);
  });
  it('rejects zero weight', () => {
    expect(validatePackageRequest('Amman', 'Aqaba', '0').valid).toBe(false);
  });
});

describe('validateScheduledRide', () => {
  const futureTime = new Date(Date.now() + 3600_000).toISOString();

  it('accepts valid scheduled ride', () => {
    expect(validateScheduledRide('31.9', '35.9', '29.5', '35.0', futureTime)).toEqual({ valid: true });
  });
  it('rejects invalid pickup latitude', () => {
    expect(validateScheduledRide('abc', '35.9', '29.5', '35.0', futureTime).valid).toBe(false);
  });
  it('rejects out-of-range latitude', () => {
    expect(validateScheduledRide('91', '35.9', '29.5', '35.0', futureTime).valid).toBe(false);
  });
  it('rejects invalid pickup longitude', () => {
    expect(validateScheduledRide('31.9', 'abc', '29.5', '35.0', futureTime).valid).toBe(false);
  });
  it('rejects out-of-range longitude', () => {
    expect(validateScheduledRide('31.9', '181', '29.5', '35.0', futureTime).valid).toBe(false);
  });
  it('rejects invalid dropoff latitude', () => {
    expect(validateScheduledRide('31.9', '35.9', 'abc', '35.0', futureTime).valid).toBe(false);
  });
  it('rejects invalid dropoff longitude', () => {
    expect(validateScheduledRide('31.9', '35.9', '29.5', 'abc', futureTime).valid).toBe(false);
  });
  it('rejects empty scheduled time', () => {
    expect(validateScheduledRide('31.9', '35.9', '29.5', '35.0', '').valid).toBe(false);
  });
  it('rejects invalid date string', () => {
    expect(validateScheduledRide('31.9', '35.9', '29.5', '35.0', 'not-a-date').valid).toBe(false);
  });
  it('rejects past time', () => {
    const pastTime = new Date(Date.now() - 120_000).toISOString();
    expect(validateScheduledRide('31.9', '35.9', '29.5', '35.0', pastTime).valid).toBe(false);
  });
});
