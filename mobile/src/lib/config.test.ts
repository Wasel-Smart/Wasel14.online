const mockCreateClient = jest.fn(() => ({ auth: {} }));
const mockGetItemAsync = jest.fn();
const mockSetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://fallback.supabase.co',
        supabaseAnonKey: 'fallback-anon-key',
        authRedirectUrl: 'wasel://fallback-callback',
      },
    },
  },
}));

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: mockGetItemAsync,
  setItemAsync: mockSetItemAsync,
  deleteItemAsync: mockDeleteItemAsync,
}));

jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));

describe('mobile Supabase configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockDeleteItemAsync.mockReset();
    mockGetItemAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('chunks:1');
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('uses protected device storage for the persisted auth session', async () => {
    const { supabase, waselMobileConfig } = require('./config') as typeof import('./config');
    expect(supabase).toEqual({ auth: {} });
    expect(waselMobileConfig.supabaseUrl).toBe('https://fallback.supabase.co');
    expect(waselMobileConfig.authRedirectUrl).toBe('wasel://fallback-callback');

    const [, , options] = mockCreateClient.mock.calls[0] as unknown as [string, string, {
      auth: {
        storage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
        persistSession: boolean;
        detectSessionInUrl: boolean;
      };
    }];
    await options.auth.storage.getItem('session');
    await options.auth.storage.setItem('session', 'value');
    await options.auth.storage.removeItem('session');

    expect(mockGetItemAsync).toHaveBeenCalledWith('session');
    expect(mockSetItemAsync).toHaveBeenNthCalledWith(
      1,
      'session.0',
      'value',
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
    expect(mockSetItemAsync).toHaveBeenNthCalledWith(
      2,
      'session',
      'chunks:1',
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('session.0');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('session');
    expect(options.auth.persistSession).toBe(true);
    expect(options.auth.detectSessionInUrl).toBe(false);
  });

  it('prefers explicitly provided Expo public configuration', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://configured.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'configured-anon-key';
    const { waselMobileConfig } = require('./config') as typeof import('./config');

    expect(waselMobileConfig.supabaseUrl).toBe('https://configured.supabase.co');
    expect(waselMobileConfig.supabaseAnonKey).toBe('configured-anon-key');
    expect(waselMobileConfig.hasSupabase).toBe(true);
  });
});
