/**
 * Stand-in for the ioredis package.
 *
 * src/platform/geo-adapter.ts dynamically imports 'ioredis' only when
 * REDIS_URL is set, which never happens in the test environment — the
 * suites only exercise the no-op fallback. But Vite still needs the bare
 * specifier to resolve at transform time, and the real ioredis is a
 * Node-only client (net/tls/crypto) that must stay out of the browser
 * bundle, so it is deliberately not a dependency. This stub satisfies
 * test-time resolution without pulling the real package in.
 */
export default class RedisStub {
  private _connected = false;

  constructor(
    _url: string,
    _opts?: { lazyConnect?: boolean; maxRetriesPerRequest?: number },
  ) {}

  async connect(): Promise<void> {
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  get status(): string {
    return this._connected ? 'ready' : 'wait';
  }

  async geoadd( ..._args: unknown[] ): Promise<number> {
    return 0;
  }

  async zrem( ..._args: unknown[] ): Promise<number> {
    return 0;
  }

  async georadius( ..._args: unknown[] ): Promise<Array<[string, string]>> {
    return [];
  }
}
