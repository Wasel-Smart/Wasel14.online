const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (key: string) => (mockStore.has(key) ? mockStore.get(key)! : null)),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

import * as SecureStore from 'expo-secure-store';
import { SECURE_CHUNK_SIZE, secureSessionStorage } from './secureStorage';

describe('secureSessionStorage', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it('round-trips a value larger than a single SecureStore entry', async () => {
    const value = 'x'.repeat(SECURE_CHUNK_SIZE * 3 + 17);

    await secureSessionStorage.setItem('sb-session', value);

    expect(await secureSessionStorage.getItem('sb-session')).toBe(value);
    expect(mockStore.get('sb-session')).toBe('chunks:4');
    for (const entry of mockStore.values()) {
      expect(entry.length).toBeLessThanOrEqual(SECURE_CHUNK_SIZE);
    }
  });

  it('stores values with the device-only keychain policy', async () => {
    await secureSessionStorage.setItem('k', 'small');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('k.0', 'small', {
      keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    });
  });

  it('still reads a legacy un-chunked session', async () => {
    mockStore.set('sb-session', '{"access_token":"legacy"}');

    expect(await secureSessionStorage.getItem('sb-session')).toBe('{"access_token":"legacy"}');
  });

  it('returns null when the key does not exist', async () => {
    expect(await secureSessionStorage.getItem('missing')).toBeNull();
  });

  it('returns null for a torn write with a missing chunk', async () => {
    mockStore.set('sb-session', 'chunks:3');
    mockStore.set('sb-session.0', 'aaa');
    mockStore.set('sb-session.2', 'ccc');

    expect(await secureSessionStorage.getItem('sb-session')).toBeNull();
  });

  it('removes stale chunks when a value shrinks', async () => {
    await secureSessionStorage.setItem('k', 'y'.repeat(SECURE_CHUNK_SIZE * 3));
    await secureSessionStorage.setItem('k', 'short');

    expect(mockStore.has('k.0')).toBe(true);
    expect(mockStore.has('k.1')).toBe(false);
    expect(mockStore.has('k.2')).toBe(false);
    expect(await secureSessionStorage.getItem('k')).toBe('short');
  });

  it('removeItem deletes the marker and every chunk', async () => {
    await secureSessionStorage.setItem('k', 'z'.repeat(SECURE_CHUNK_SIZE * 2));

    await secureSessionStorage.removeItem('k');

    expect(mockStore.size).toBe(0);
  });
});
