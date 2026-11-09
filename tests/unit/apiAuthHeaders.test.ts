import { describe, expect, it, vi, beforeEach } from 'vitest';

const SESSION_TOKEN = 'user-jwt-from-supabase';
const ANON_KEY = 'sb_publishable_anon_key';
const API_URL = 'https://project.supabase.co/functions/v1/make-server-0b1f4071';

vi.mock('../../src/services/core', () => ({
  API_URL: 'https://project.supabase.co/functions/v1/make-server-0b1f4071',
  publicAnonKey: 'sb_publishable_anon_key',
}));

vi.mock('../../src/utils/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'user-jwt-from-supabase' } } }),
    },
  },
}));

vi.mock('../../src/utils/monitoring', () => ({
  logger: { warning: vi.fn(), error: vi.fn(), info: vi.fn() },
  trackAPICall: vi.fn(),
}));

import {
  API_ENDPOINTS,
  APIError,
  NetworkError,
  TimeoutError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  apiRequest,
  getApiHeaders,
} from '../../src/utils/api';

const fetchMock = vi.fn();

function lastCall(): unknown[] | undefined {
  const calls = fetchMock.mock.calls;
  return calls.length > 0 ? calls[calls.length - 1] : undefined;
}

function lastInit(): RequestInit {
  const call = lastCall();
  if (!call || call.length < 2) {
    throw new Error('fetch was not called with an options argument');
  }
  return call[1] as RequestInit;
}

function headerOf(init: RequestInit, name: string): string | null {
  const headers = init.headers as Record<string, string>;
  return headers[name] ?? null;
}

describe('api auth header propagation', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: true, data: { ok: true } }),
      text: () => Promise.resolve(''),
    });
  });

  it('sends the session token, not the anon key, on GET', async () => {
    await apiGet('/v1/admin/users');
    expect(headerOf(lastInit(), 'Authorization')).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(headerOf(lastInit(), 'Authorization')).not.toContain(ANON_KEY);
  });

  it('sends the session token on POST', async () => {
    await apiPost('/v1/admin/users/abc/status', { status: 'suspended' });
    expect(headerOf(lastInit(), 'Authorization')).toBe(`Bearer ${SESSION_TOKEN}`);
  });

  it('sends the session token on PUT', async () => {
    await apiPut('/v1/admin/disputes/1/resolve', { resolution: 'refund' });
    expect(headerOf(lastInit(), 'Authorization')).toBe(`Bearer ${SESSION_TOKEN}`);
  });

  it('still lets an explicitly passed access token win', async () => {
    await apiGet('/v1/admin/users', undefined, 'caller-supplied-token');
    expect(headerOf(lastInit(), 'Authorization')).toBe('Bearer caller-supplied-token');
  });

  it('targets the configured function base URL', async () => {
    await apiGet('/v1/admin/users');
    const firstCall = fetchMock.mock.calls[0];
    if (!firstCall || typeof firstCall[0] !== 'string') {
      throw new Error('fetch was not called with a URL string');
    }
    expect(String(firstCall[0])).toBe(`${API_URL}/v1/admin/users`);
  });
});

describe('API request behavior', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: true, data: { ok: true } }),
      text: () => Promise.resolve('ok'),
    });
  });

  it('serializes filtered query values and exposes endpoint helpers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      text: () => Promise.resolve('ok'),
    });
    await apiGet('/v1/items', { page: 2, active: true, unused: null });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('page=2&active=true');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('unused');
    expect(API_ENDPOINTS.BOOKINGS_ID('b-1')).toBe('/v1/bookings/b-1');

    await apiPatch('/v1/items/1', { active: false });
    await apiDelete('/v1/items/1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('normalizes JSON API errors and rejects unauthorized destinations', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ error: 'Invalid payload', code: 'invalid_payload', details: { field: 'name' } }),
    });
    await expect(apiRequest('/v1/items', {}, 0)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 400,
      code: 'invalid_payload',
      message: 'Invalid payload',
    });

    await expect(apiRequest('https://attacker.invalid/collect', {}, 0)).rejects.toMatchObject({
      name: 'APIError',
      statusCode: 403,
      code: 'invalid_url',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries transient status codes and converts rejected fetches into network errors', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('try again'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, data: { ready: true } }),
      });

    await expect(apiRequest('/v1/items', {}, 1)).resolves.toEqual({ ready: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockRejectedValueOnce(new TypeError('connection refused'));
    await expect(apiRequest('/v1/items', {}, 0)).rejects.toBeInstanceOf(NetworkError);
  });

  it('serializes API errors and keeps timeout errors distinct', () => {
    const error = new APIError('Failure', 418, 'teapot', { retry: false });
    expect(error.toJSON()).toEqual({
      error: 'Failure', code: 'teapot', details: { retry: false }, statusCode: 418,
    });
    expect(new NetworkError().name).toBe('NetworkError');
    expect(new TimeoutError().name).toBe('TimeoutError');
    expect(getApiHeaders('user-token', 'request-1')).toMatchObject({
      Authorization: 'Bearer user-token',
      'X-Request-Id': 'request-1',
    });
  });
});
