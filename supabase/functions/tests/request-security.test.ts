import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildAllowedOrigins, resolveAllowedOrigin } from '../make-server-0b1f4071/_shared/request-security.ts';

Deno.test('local origins are excluded by default and available only when explicitly enabled', () => {
  const defaults = buildAllowedOrigins('https://wasel14.online');
  assert(!defaults.includes('http://localhost:5173'));
  assertEquals(resolveAllowedOrigin('http://localhost:5173', 'https://wasel14.online'), null);

  const localEnabled = buildAllowedOrigins('https://wasel14.online', null, true);
  assert(localEnabled.includes('http://localhost:5173'));
  assertEquals(
    resolveAllowedOrigin('http://localhost:5173', 'https://wasel14.online', null, true),
    'http://localhost:5173',
  );
});
