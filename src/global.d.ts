declare const __GOOGLE_MAPS_API_KEY__: string | undefined;

declare module 'ioredis' {
  export default class Redis {
    constructor(url: string, options?: Record<string, unknown>);
    connect(): Promise<void>;
    geoadd(key: string, lng: number, lat: number, member: string): Promise<unknown>;
    zrem(key: string, member: string): Promise<unknown>;
    georadius(key: string, lng: number, lat: number, radius: number, unit: string, ...args: string[]): Promise<Array<[string, string]>>;
  }
}
