import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const from = vi.fn();
  const insert = vi.fn().mockResolvedValue({ error: null });
  const select = vi.fn();
  const update = vi.fn().mockResolvedValue({ error: null });
  const eq = vi.fn();
  const order = vi.fn();
  const limit = vi.fn();
  const single = vi.fn().mockResolvedValue({ data: { granted: true }, error: null });
  const lte = vi.fn();
  const maybeSingle = vi.fn().mockResolvedValue({ data: {}, error: null });
  const upload = vi.fn().mockResolvedValue({ error: null });
  const storage = { from: vi.fn().mockReturnValue({ upload }) };
  return { from, insert, select, update, eq, order, limit, single, lte, maybeSingle, upload, storage };
});
const { mockFrom, mockInsert, mockSelect, mockUpdate, mockEq, mockOrder, mockLimit,
  mockSingle, mockLte, mockMaybeSingle, mockUpload, mockStorage } = {
  mockFrom: mocks.from, mockInsert: mocks.insert, mockSelect: mocks.select,
  mockUpdate: mocks.update, mockEq: mocks.eq, mockOrder: mocks.order,
  mockLimit: mocks.limit, mockSingle: mocks.single, mockLte: mocks.lte,
  mockMaybeSingle: mocks.maybeSingle, mockUpload: mocks.upload, mockStorage: mocks.storage,
};

// Chain builder — each method returns the chain so calls can be chained
const chain: Record<string, unknown> = {};
chain.insert = mockInsert;
chain.select = mockSelect.mockReturnValue(chain);
chain.update = mockUpdate.mockReturnValue(chain);
chain.eq = mockEq.mockReturnValue(chain);
chain.order = mockOrder.mockReturnValue(chain);
chain.limit = mockLimit.mockReturnValue(chain);
chain.single = mockSingle;
chain.lte = mockLte.mockResolvedValue({ data: [], error: null });
chain.maybeSingle = mockMaybeSingle;

mockFrom.mockReturnValue(chain);

vi.mock('@/utils/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    storage: mocks.storage,
  },
}));

vi.mock('@/utils/monitoring', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/utils/sanitization', () => ({
  sanitizeLogMessage: (v: string) => v,
}));

import { gdpr } from '@/utils/gdpr';

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue(chain);
  mockSingle.mockResolvedValue({ data: { granted: true }, error: null });
  mockLte.mockResolvedValue({ data: [], error: null });
  mockFrom.mockReturnValue(chain);
  mockStorage.from.mockReturnValue({ upload: mockUpload });
  mockUpload.mockResolvedValue({ error: null });
});

describe('gdpr.recordConsent', () => {
  it('records consent without error', async () => {
    await expect(
      gdpr.recordConsent({
        userId: 'user-1',
        consentType: 'analytics',
        granted: true,
        timestamp: Date.now(),
      }),
    ).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('user_consents');
  });

  it('throws when insert fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: new Error('db error') });
    await expect(
      gdpr.recordConsent({
        userId: 'user-1',
        consentType: 'marketing',
        granted: false,
        timestamp: Date.now(),
      }),
    ).rejects.toThrow();
  });
});

describe('gdpr.getConsent', () => {
  it('returns true when consent granted', async () => {
    mockSingle.mockResolvedValueOnce({ data: { granted: true }, error: null });
    const result = await gdpr.getConsent('user-1', 'analytics');
    expect(result).toBe(true);
  });

  it('returns false when no record (PGRST116)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    const result = await gdpr.getConsent('user-1', 'analytics');
    expect(result).toBe(false);
  });

  it('returns false on unexpected error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: new Error('db error') });
    const result = await gdpr.getConsent('user-1', 'analytics');
    expect(result).toBe(false);
  });
});

describe('gdpr.requestDataExport', () => {
  it('returns a DataExportRequest object', async () => {
    // Mock all the chained calls for generateDataExport
    mockMaybeSingle.mockResolvedValue({ data: {}, error: null });
    mockLte.mockResolvedValue({ data: [], error: null });
    // Make the insert succeed
    mockInsert.mockResolvedValue({ error: null });

    const result = await gdpr.requestDataExport('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toHaveProperty('userId');
    expect(result).toHaveProperty('requestedAt');
  });

  it('throws when insert fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: new Error('db error') });
    await expect(gdpr.requestDataExport('user-1')).rejects.toThrow();
  });
});

describe('gdpr.requestDeletion', () => {
  it('returns a DataDeletionRequest object', async () => {
    const result = await gdpr.requestDeletion('user-1', 'personal reason');
    expect(result).toHaveProperty('userId', 'user-1');
    expect(result).toHaveProperty('scheduledFor');
    expect(result.scheduledFor).toBeGreaterThan(Date.now() - 1000);
  });

  it('throws when insert fails', async () => {
    mockInsert.mockResolvedValueOnce({ error: new Error('db error') });
    await expect(gdpr.requestDeletion('user-1')).rejects.toThrow();
  });
});

describe('gdpr.cancelDeletion', () => {
  it('resolves without error', async () => {
    await expect(gdpr.cancelDeletion('user-1')).resolves.toBeUndefined();
  });

  it('throws when update fails', async () => {
    mockUpdate.mockReturnValueOnce({
      ...chain,
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('db error') }),
      }),
    });
    await expect(gdpr.cancelDeletion('user-1')).rejects.toThrow();
  });
});

describe('gdpr.executeScheduledDeletions', () => {
  it('resolves when no pending deletions', async () => {
    mockLte.mockResolvedValueOnce({ data: [], error: null });
    await expect(gdpr.executeScheduledDeletions()).resolves.toBeUndefined();
  });

  it('handles db error gracefully', async () => {
    mockLte.mockResolvedValueOnce({ data: null, error: new Error('db error') });
    await expect(gdpr.executeScheduledDeletions()).resolves.toBeUndefined();
  });
});

describe('gdpr.getDataProcessingActivities', () => {
  it('always includes mandatory activities', async () => {
    mockSingle.mockResolvedValue({ data: { granted: false }, error: null });
    const activities = await gdpr.getDataProcessingActivities('user-1');
    expect(activities).toContain('Service delivery and transaction processing');
    expect(activities).toContain('Security and fraud prevention');
    expect(activities).toContain('Legal compliance');
  });

  it('includes analytics when consent granted', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { granted: true }, error: null })  // analytics
      .mockResolvedValueOnce({ data: { granted: false }, error: null }); // marketing
    const activities = await gdpr.getDataProcessingActivities('user-1');
    expect(activities).toContain('Analytics and performance monitoring');
  });

  it('includes marketing when consent granted', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { granted: false }, error: null }) // analytics
      .mockResolvedValueOnce({ data: { granted: true }, error: null });  // marketing
    const activities = await gdpr.getDataProcessingActivities('user-1');
    expect(activities).toContain('Marketing communications');
  });
});
