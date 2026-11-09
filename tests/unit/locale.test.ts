import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatTime,
  formatDateTime,
  getLocale,
  getDirection,
} from '@/utils/locale';

describe('formatCurrency', () => {
  it('formats JOD with 3 decimal places', () => {
    const result = formatCurrency(5.5, 'JOD', 'en-US');
    expect(result).toContain('5.500');
  });

  it('formats USD with 2 decimal places', () => {
    const result = formatCurrency(10, 'USD', 'en-US');
    expect(result).toContain('10.00');
  });

  it('falls back gracefully on invalid locale', () => {
    const result = formatCurrency(5, 'JOD', 'invalid-locale-xyz');
    // Should not throw; returns fallback string
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles zero amount', () => {
    const result = formatCurrency(0, 'JOD', 'en-US');
    expect(result).toContain('0');
  });

  it('handles negative amount', () => {
    const result = formatCurrency(-3.5, 'USD', 'en-US');
    expect(result).toContain('3.50');
  });
});

describe('formatNumber', () => {
  it('formats integer', () => {
    const result = formatNumber(1000, 'en-US');
    expect(result).toContain('1');
  });

  it('formats decimal', () => {
    const result = formatNumber(3.14, 'en-US');
    expect(result).toContain('3');
  });

  it('falls back on invalid locale', () => {
    const result = formatNumber(42, 'invalid-xyz');
    expect(typeof result).toBe('string');
  });
});

describe('formatDate', () => {
  const testDate = new Date('2026-04-15T12:00:00Z');

  it('formats a Date object', () => {
    const result = formatDate(testDate, 'en-US');
    expect(result).toContain('2026');
  });

  it('formats a date string', () => {
    const result = formatDate('2026-04-15', 'en-US');
    expect(result).toContain('2026');
  });

  it('formats a timestamp number', () => {
    const result = formatDate(testDate.getTime(), 'en-US');
    expect(result).toContain('2026');
  });

  it('falls back on invalid locale', () => {
    const result = formatDate(testDate, 'invalid-xyz');
    expect(typeof result).toBe('string');
  });
});

describe('formatTime', () => {
  const testDate = new Date('2026-04-15T14:30:00Z');

  it('formats a Date object', () => {
    const result = formatTime(testDate, 'en-US');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats a date string', () => {
    const result = formatTime('2026-04-15T14:30:00Z', 'en-US');
    expect(typeof result).toBe('string');
  });

  it('formats a timestamp number', () => {
    const result = formatTime(testDate.getTime(), 'en-US');
    expect(typeof result).toBe('string');
  });

  it('falls back on invalid locale', () => {
    const result = formatTime(testDate, 'invalid-xyz');
    expect(typeof result).toBe('string');
  });
});

describe('formatDateTime', () => {
  it('combines date and time', () => {
    const result = formatDateTime(new Date('2026-04-15T14:30:00Z'), 'en-US');
    expect(result).toContain('2026');
    expect(result.length).toBeGreaterThan(5);
  });
});

describe('getLocale', () => {
  it('returns ar-JO for Arabic', () => {
    expect(getLocale('ar')).toBe('ar-JO');
  });

  it('returns en-US for English', () => {
    expect(getLocale('en')).toBe('en-US');
  });
});

describe('getDirection', () => {
  it('returns rtl for Arabic', () => {
    expect(getDirection('ar')).toBe('rtl');
  });

  it('returns ltr for English', () => {
    expect(getDirection('en')).toBe('ltr');
  });
});
