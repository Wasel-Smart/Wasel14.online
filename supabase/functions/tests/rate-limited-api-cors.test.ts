import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveCorsOrigin } from '../rate-limited-api/_shared/cors.ts';

Deno.test('rate limited API CORS echoes only an exact configured origin', () => {
  const configured = 'https://wasel14.online, https://www.wasel14.online';
  assertEquals(resolveCorsOrigin('https://wasel14.online', configured), 'https://wasel14.online');
  assertEquals(resolveCorsOrigin('https://evil.example', configured), null);
  assertEquals(resolveCorsOrigin('null', configured), null);
  assertEquals(resolveCorsOrigin('javascript:alert(1)', configured), null);
});
