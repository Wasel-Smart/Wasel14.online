import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSecret,
  getSecrets,
  clearSecretsCache,
  maskSecret,
  validateRequiredSecrets,
  rotateSecret,
} from '@/utils/secrets';

beforeEach(() => {
  clearSecretsCache();
  vi.unstubAllEnvs();
});

describe('maskSecret', () => {
  it('masks a normal secret showing first and last 4 chars', () => {
    const result = maskSecret('abcdefghijklmnop');
    expect(result).toMatch(/^abcd/);
    expect(result).toMatch(/mnop$/);
    expect(result).toContain('*');
  });

  it('returns **** for short secrets', () => {
    expect(maskSecret('abc')).toBe('****');
    expect(maskSecret('')).toBe('****');
  });

  it('handles exactly 8 chars (boundary)', () => {
    const result = maskSecret('12345678');
    expect(result).toBe('1234' + '5678');
  });
});

describe('getSecret — env variable fallback', () => {
  it('returns null for an unknown key when not required', async () => {
    const result = await getSecret('NONEXISTENT_KEY_XYZ');
    expect(result).toBeNull();
  });

  it('throws when a required secret is missing', async () => {
    await expect(getSecret('MISSING_REQUIRED_KEY', { required: true })).rejects.toThrow(
      'Required secret "MISSING_REQUIRED_KEY" not found',
    );
  });

  it('reads from import.meta.env for non-server-only keys', async () => {
    vi.stubEnv('VITE_TEST_SECRET_XYZ', 'test-value-123');
    const result = await getSecret('VITE_TEST_SECRET_XYZ');
    expect(result).toBe('test-value-123');
  });
});

describe('getSecret — server-only guard', () => {
  it('throws when client-side code tries to access a server-only secret', async () => {
    // window is defined (browser context) — guard should fire
    await expect(getSecret('SUPABASE_SERVICE_ROLE_KEY')).rejects.toThrow(
      'Security violation',
    );
  });

  it('throws for STRIPE_SECRET_KEY from client context', async () => {
    await expect(getSecret('STRIPE_SECRET_KEY')).rejects.toThrow('Security violation');
  });

  it('throws for TWILIO_AUTH_TOKEN from client context', async () => {
    await expect(getSecret('TWILIO_AUTH_TOKEN')).rejects.toThrow('Security violation');
  });
});

describe('getSecret — caching', () => {
  it('caches a resolved value and returns it on subsequent calls', async () => {
    vi.stubEnv('VITE_CACHED_SECRET', 'cached-value');
    const first = await getSecret('VITE_CACHED_SECRET');
    const second = await getSecret('VITE_CACHED_SECRET');
    expect(first).toBe('cached-value');
    expect(second).toBe('cached-value');
  });
});

describe('clearSecretsCache', () => {
  it('clears cached values so the next call re-reads from env', async () => {
    vi.stubEnv('VITE_CLEAR_TEST', 'v1');
    await getSecret('VITE_CLEAR_TEST');
    clearSecretsCache();
    vi.stubEnv('VITE_CLEAR_TEST', 'v2');
    const result = await getSecret('VITE_CLEAR_TEST');
    expect(result).toBe('v2');
  });
});

describe('rotateSecret', () => {
  it('removes a specific key from cache without clearing others', async () => {
    vi.stubEnv('VITE_ROT_A', 'a');
    vi.stubEnv('VITE_ROT_B', 'b');
    await getSecret('VITE_ROT_A');
    await getSecret('VITE_ROT_B');
    rotateSecret('VITE_ROT_A');
    vi.stubEnv('VITE_ROT_A', 'a-new');
    const a = await getSecret('VITE_ROT_A');
    const b = await getSecret('VITE_ROT_B');
    expect(a).toBe('a-new');
    expect(b).toBe('b');
  });
});

describe('getSecrets (batch)', () => {
  it('returns a map of key → value for multiple keys', async () => {
    vi.stubEnv('VITE_BATCH_X', 'x');
    vi.stubEnv('VITE_BATCH_Y', 'y');
    const result = await getSecrets(['VITE_BATCH_X', 'VITE_BATCH_Y', 'VITE_BATCH_MISSING']);
    expect(result['VITE_BATCH_X']).toBe('x');
    expect(result['VITE_BATCH_Y']).toBe('y');
    expect(result['VITE_BATCH_MISSING']).toBeNull();
  });
});

describe('validateRequiredSecrets', () => {
  it('returns valid=true when all secrets are present', async () => {
    vi.stubEnv('VITE_REQ_A', 'present');
    const result = await validateRequiredSecrets(['VITE_REQ_A']);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns valid=false and lists missing keys', async () => {
    const result = await validateRequiredSecrets(['VITE_DEFINITELY_MISSING_ZZZ']);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('VITE_DEFINITELY_MISSING_ZZZ');
  });

  it('returns valid=false with multiple missing keys', async () => {
    const result = await validateRequiredSecrets(['VITE_MISS_1', 'VITE_MISS_2']);
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(2);
  });
});
