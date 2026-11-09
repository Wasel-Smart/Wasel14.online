import { describe, it, expect } from 'vitest';
import {
  createCorrelationId,
  createStructuredLogEntry,
  type StructuredLogLevel,
} from '../../src/platform/observability';

describe('platform/observability', () => {
  describe('createCorrelationId', () => {
    it('returns a string with the given prefix', () => {
      const id = createCorrelationId('req');
      expect(id).toMatch(/^req-\d+-[0-9a-f]+$/);
    });

    it('uses "req" as default prefix', () => {
      const id = createCorrelationId();
      expect(id).toMatch(/^req-/);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 20 }, () => createCorrelationId('x')));
      expect(ids.size).toBe(20);
    });
  });

  describe('createStructuredLogEntry', () => {
    const levels: StructuredLogLevel[] = ['debug', 'info', 'warning', 'error'];

    it('returns all required fields', () => {
      const entry = createStructuredLogEntry('info', 'test message', 'wasel-web');
      expect(entry).toHaveProperty('level', 'info');
      expect(entry).toHaveProperty('message', 'test message');
      expect(entry).toHaveProperty('service', 'wasel-web');
      expect(entry).toHaveProperty('requestId');
      expect(entry).toHaveProperty('timestamp');
    });

    it('timestamp is a valid ISO string', () => {
      const entry = createStructuredLogEntry('info', 'x', 'svc');
      expect(() => new Date(entry.timestamp)).not.toThrow();
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    });

    it('accepts all log levels', () => {
      for (const level of levels) {
        const entry = createStructuredLogEntry(level, 'msg', 'svc');
        expect(entry.level).toBe(level);
      }
    });

    it('includes context when provided', () => {
      const entry = createStructuredLogEntry('info', 'msg', 'svc', { userId: 'u1' });
      expect(entry.context).toHaveProperty('userId', 'u1');
    });

    it('uses provided requestId', () => {
      const entry = createStructuredLogEntry('info', 'msg', 'svc', undefined, 'custom-id');
      expect(entry.requestId).toBe('custom-id');
    });

    it('sanitizes message to prevent log injection', () => {
      const entry = createStructuredLogEntry('info', 'line1\nline2', 'svc');
      // sanitizeLogMessage should strip newlines
      expect(entry.message).not.toContain('\n');
    });
  });
});
