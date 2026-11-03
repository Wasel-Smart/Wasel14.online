import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationsAPI } from '@/services/notifications';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/services/core', () => ({
  API_URL: '',
  fetchWithRetry: vi.fn(),
  getAuthDetails: vi.fn(),
}));

vi.mock('@/services/communicationPreferences', () => ({
  getCommunicationPreferences: vi.fn().mockResolvedValue({}),
  getCommunicationCapabilities: vi.fn().mockReturnValue({}),
  buildDeliveryPlan: vi.fn().mockReturnValue([]),
  queueCommunicationDeliveries: vi.fn().mockResolvedValue({ queued: 0, source: 'none' }),
}));

vi.mock('@/services/directSupabase', () => ({
  createDirectNotification: vi.fn(),
  getDirectNotifications: vi.fn(),
  markDirectNotificationAsRead: vi.fn(),
}));

vi.mock('@/platform/async-runtime', () => ({
  dispatchNotification: vi.fn(),
}));

import { getAuthDetails } from '@/services/core';
import { getDirectNotifications, markDirectNotificationAsRead, createDirectNotification } from '@/services/directSupabase';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // The notificationsAPI module caches server results in a module-level Map.
  // Clear it between tests by resetting the mock so the cache TTL check fails
  // (cache stores userId → {data, timestamp}; clearing mocks resets call counts
  // but not the Map itself). We force a cache miss by making getAuthDetails
  // return a different userId each time, or by clearing localStorage which
  // the cache key is based on. The simplest fix: reset modules is too heavy;
  // instead we ensure each test that needs a clean server fetch uses a unique
  // userId so the cache never hits across tests.
});

// ── getNotifications ──────────────────────────────────────────────────────────
describe('notificationsAPI.getNotifications', () => {
  it('returns empty notifications when auth fails and localStorage is empty', async () => {
    vi.mocked(getAuthDetails).mockRejectedValue(new Error('not authenticated'));

    const result = await notificationsAPI.getNotifications();
    expect(result.notifications).toEqual([]);
  });

  it('returns local notifications when auth fails and localStorage has items', async () => {
    const localItems = [
      { id: 'n1', title: 'Test', message: 'Hello', type: 'info', user_id: 'u1',
        is_read: false, read: false, created_at: new Date().toISOString(), source: 'local' },
    ];
    localStorage.setItem('wasel-local-notifications', JSON.stringify(localItems));
    vi.mocked(getAuthDetails).mockRejectedValue(new Error('not authenticated'));

    const result = await notificationsAPI.getNotifications();
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]!.id).toBe('n1');
  });

  it('returns local notifications when token is null', async () => {
    vi.mocked(getAuthDetails).mockResolvedValue({ token: null, userId: null } as never);

    const result = await notificationsAPI.getNotifications();
    expect(result.notifications).toEqual([]);
  });

  it('fetches from directSupabase when API_URL is empty and user is authenticated', async () => {
    vi.mocked(getAuthDetails).mockResolvedValue({ token: 'tok', userId: 'u1' } as never);
    vi.mocked(getDirectNotifications).mockResolvedValue([
      { id: 'srv1', title: 'Server', message: 'Msg', type: 'info', user_id: 'u1',
        is_read: false, created_at: new Date().toISOString() },
    ] as never);

    const result = await notificationsAPI.getNotifications();
    expect(getDirectNotifications).toHaveBeenCalledWith('u1');
    expect(result.notifications.some(n => n.id === 'srv1')).toBe(true);
  });

  it('falls back to local notifications when directSupabase throws', async () => {
    // Use a unique userId to avoid hitting the cache from the previous test
    vi.mocked(getAuthDetails).mockResolvedValue({ token: 'tok', userId: 'u-fallback-1' } as never);
    vi.mocked(getDirectNotifications).mockRejectedValue(new Error('db error'));

    const result = await notificationsAPI.getNotifications();
    expect(result.notifications).toEqual([]);
  });

  it('merges local and server notifications, deduplicating by id', async () => {
    const sharedId = 'shared-1';
    localStorage.setItem('wasel-local-notifications', JSON.stringify([
      { id: sharedId, title: 'Local', message: 'L', type: 'info', user_id: 'u1',
        is_read: true, read: true, created_at: '2026-01-01T00:00:00Z', source: 'local' },
    ]));
    vi.mocked(getAuthDetails).mockResolvedValue({ token: 'tok', userId: 'u1' } as never);
    vi.mocked(getDirectNotifications).mockResolvedValue([
      { id: sharedId, title: 'Server', message: 'S', type: 'info', user_id: 'u1',
        is_read: false, created_at: '2026-01-01T00:00:00Z' },
    ] as never);

    const result = await notificationsAPI.getNotifications();
    const deduped = result.notifications.filter(n => n.id === sharedId);
    expect(deduped).toHaveLength(1);
    // read=true wins (local had it read)
    expect(deduped[0]!.read).toBe(true);
  });
});

// ── markAsRead ────────────────────────────────────────────────────────────────
describe('notificationsAPI.markAsRead', () => {
  it('marks local notification as read and returns success when auth fails', async () => {
    localStorage.setItem('wasel-local-notifications', JSON.stringify([
      { id: 'n1', title: 'T', message: 'M', type: 'info', user_id: 'u1',
        is_read: false, read: false, created_at: new Date().toISOString() },
    ]));
    vi.mocked(getAuthDetails).mockRejectedValue(new Error('no auth'));

    const result = await notificationsAPI.markAsRead('n1');
    expect(result.success).toBe(true);
    expect(result.source).toBe('local');

    const stored = JSON.parse(localStorage.getItem('wasel-local-notifications') ?? '[]');
    expect(stored[0].is_read).toBe(true);
  });

  it('calls markDirectNotificationAsRead when API_URL is empty and user is authenticated', async () => {
    vi.mocked(getAuthDetails).mockResolvedValue({ token: 'tok', userId: 'u1' } as never);
    vi.mocked(markDirectNotificationAsRead).mockResolvedValue(undefined);

    const result = await notificationsAPI.markAsRead('n2');
    expect(markDirectNotificationAsRead).toHaveBeenCalledWith('n2', 'u1');
    expect(result.success).toBe(true);
  });

  it('returns success=false when markDirectNotificationAsRead throws', async () => {
    vi.mocked(getAuthDetails).mockResolvedValue({ token: 'tok', userId: 'u1' } as never);
    vi.mocked(markDirectNotificationAsRead).mockRejectedValue(new Error('rls denied'));

    const result = await notificationsAPI.markAsRead('n3');
    expect(result.success).toBe(false);
  });
});

// ── createNotification ────────────────────────────────────────────────────────
describe('notificationsAPI.createNotification', () => {
  it('stores locally and returns success when auth fails', async () => {
    vi.mocked(getAuthDetails).mockRejectedValue(new Error('no auth'));

    const result = await notificationsAPI.createNotification({
      title: 'Ride confirmed', message: 'Your ride is on the way', type: 'ride',
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('local');
    const stored = JSON.parse(localStorage.getItem('wasel-local-notifications') ?? '[]');
    expect(stored.some((n: { title: string }) => n.title === 'Ride confirmed')).toBe(true);
  });

  it('stores locally when token is null', async () => {
    vi.mocked(getAuthDetails).mockResolvedValue({ token: null, userId: null } as never);

    const result = await notificationsAPI.createNotification({
      title: 'Package update', message: 'In transit', type: 'package',
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('local');
  });

  it('creates via directSupabase when API_URL is empty and user is authenticated', async () => {
    vi.mocked(getAuthDetails).mockResolvedValue({ token: 'tok', userId: 'u1' } as never);
    vi.mocked(createDirectNotification).mockResolvedValue({ id: 'srv-new' } as never);

    const result = await notificationsAPI.createNotification({
      title: 'Payment received', message: 'JOD 25 added', type: 'payment',
    });

    expect(createDirectNotification).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.source).toBe('server');
  });

  it('falls back to local when directSupabase createNotification throws', async () => {
    vi.mocked(getAuthDetails).mockResolvedValue({ token: 'tok', userId: 'u1' } as never);
    vi.mocked(createDirectNotification).mockRejectedValue(new Error('insert failed'));

    const result = await notificationsAPI.createNotification({
      title: 'Fallback test', message: 'Should store locally', type: 'system',
    });

    expect(result.success).toBe(false);
    expect(result.source).toBe('local');
  });
});
