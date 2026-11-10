jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        apiUrl: 'https://test.supabase.co/functions/v1/make-server-0b1f4071',
      },
    },
  },
}));

jest.mock('../services/auth', () => ({
  mobileAuth: {
    getAccessToken: jest.fn(() => 'test-access-token'),
  },
}));

jest.mock('./config', () => ({
  waselMobileConfig: {
    hasSupabase: true,
    apiUrl: 'https://test.supabase.co/functions/v1/make-server-0b1f4071',
    authRedirectUrl: 'wasel://auth/callback',
  },
}));

import { apiClient } from './api';

// The edge function answers 403 to any POST/PUT/PATCH/DELETE without x-csrf-token
// (enforceRequestSecurity). These tests pin that contract on the mobile side using the
// real request path, with only fetch mocked.
describe('ApiClient request headers', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['post', () => apiClient.post('/cancellations/bookings', { bookingId: 'b1' })],
    ['put', () => apiClient.put('/x', { a: 1 })],
    ['patch', () => apiClient.patch('/x', { a: 1 })],
    ['delete', () => apiClient.delete('/x')],
  ])('sends x-csrf-token and a bearer token on %s', async (_name, call) => {
    await call();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBeTruthy();
    expect(headers.Authorization).toBe('Bearer test-access-token');
  });

  it('targets the single function URL without doubling /v1', async () => {
    await apiClient.get('/v1/wallet/u1');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://test.supabase.co/functions/v1/make-server-0b1f4071/v1/wallet/u1',
    );
  });
});
