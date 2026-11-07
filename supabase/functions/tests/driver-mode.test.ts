import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');

const { handleEnableDriverMode } = await import('../make-server-0b1f4071/_handlers/identity.ts');
const originalFetch = globalThis.fetch;
const userId = '11111111-1111-4111-8111-111111111111';

function user(role: string) {
  return {
    id: userId,
    auth_user_id: userId,
    email: 'rider@example.test',
    full_name: 'Test Rider',
    role,
    verification_level: 'level_0',
  };
}

Deno.test('driver mode invokes the caller-authenticated RPC and rejects staff accounts', async () => {
  let role = 'passenger';
  let rpcCount = 0;
  let forwardedAuthorization = '';
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') {
      return Response.json({ id: userId, email: 'rider@example.test' });
    }
    if (url.pathname === '/rest/v1/rpc/app_enable_driver_mode') {
      rpcCount += 1;
      forwardedAuthorization = new Headers(init?.headers).get('Authorization') ?? '';
      return Response.json({ enabled: true, role: 'driver' });
    }
    if (url.pathname === '/rest/v1/users') {
      return Response.json(user(role));
    }
    return new Response('unexpected request', { status: 500 });
  };

  const request = () => new Request('https://edge.test/trust/driver-mode/enable', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
  });

  try {
    const enabled = await handleEnableDriverMode(request());
    assertEquals(enabled.status, 200);
    assertEquals(await enabled.json(), { enabled: true, role: 'driver' });
    assertEquals(rpcCount, 1);
    assertEquals(forwardedAuthorization, 'Bearer test-token');

    role = 'admin';
    const staff = await handleEnableDriverMode(request());
    assertEquals(staff.status, 409);
    assertEquals(rpcCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
