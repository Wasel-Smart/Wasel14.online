import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../../src/services/core/fetch-client';

const fetchMock = vi.fn();

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('fetchWithRetry URL allowlist', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows the Overpass map endpoint', async () => {
    // Regression: the allowlist was Supabase-only, so fetchNearbyMosques could
    // only ever throw "Invalid or unauthorized URL".
    await expect(
      fetchWithRetry('https://overpass-api.de/api/interpreter?data=x'),
    ).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('allows the OSRM routing endpoint', async () => {
    await expect(
      fetchWithRetry('https://router.project-osrm.org/route/v1/driving/1,2;3,4'),
    ).resolves.toBeDefined();
  });

  it('still allows the Supabase backend', async () => {
    await expect(
      fetchWithRetry('https://project.supabase.co/functions/v1/make-server-0b1f4071/health'),
    ).resolves.toBeDefined();
  });

  it('still rejects an arbitrary external host', async () => {
    await expect(fetchWithRetry('https://evil.example.com/steal')).rejects.toThrow(
      /Invalid or unauthorized URL/i,
    );
  });

  it('still rejects a look-alike suffix host', async () => {
    await expect(fetchWithRetry('https://overpass-api.de.evil.com/x')).rejects.toThrow(
      /Invalid or unauthorized URL/i,
    );
  });

  it('still rejects the cloud metadata address', async () => {
    await expect(fetchWithRetry('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /Invalid or unauthorized URL/i,
    );
  });
});
