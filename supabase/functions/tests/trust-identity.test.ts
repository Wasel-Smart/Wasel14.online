import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.env.set('SUPABASE_URL', 'https://example.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

const { handleSubmitIdentityVerification } = await import('../make-server-0b1f4071/_handlers/trust.ts');
const originalFetch = globalThis.fetch;
const userId = '11111111-1111-4111-8111-111111111111';
const verificationId = '22222222-2222-4222-8222-222222222222';

Deno.test('Sanad submission validates input, prevents duplicate pending reviews, and submits via the RPC', async () => {
  let hasPending = false;
  let rpcCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') {
      return Response.json({ id: userId, email: 'rider@example.test' });
    }
    if (url.pathname === '/rest/v1/users') {
      return Response.json({
        id: userId,
        auth_user_id: userId,
        email: 'rider@example.test',
        full_name: 'Test Rider',
        phone_number: '+962790000001',
        role: 'passenger',
        verification_level: 'level_0',
        phone_verified_at: null,
        profile_status: 'active',
        updated_at: new Date().toISOString(),
      });
    }
    if (url.pathname === '/rest/v1/verification_records') {
      if (hasPending) {
        return Response.json({ verification_id: verificationId });
      }
      return Response.json(
        { code: 'PGRST116', details: 'The result contains 0 rows' },
        { status: 406 },
      );
    }
    if (url.pathname === '/rest/v1/rpc/app_submit_sanad_verification') {
      rpcCalls += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      assertEquals(body.p_user_id, userId);
      assertEquals(body.p_provider_reference, 'SANAD-123456');
      return Response.json(verificationId);
    }
    return new Response('unexpected request', { status: 500 });
  };

  try {
    const malformed = await handleSubmitIdentityVerification(new Request('https://edge.test/trust/identity/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerReference: 'bad' }),
    }));
    assertEquals(malformed.status, 400);
    assertEquals(rpcCalls, 0);

    hasPending = true;
    const duplicate = await handleSubmitIdentityVerification(new Request('https://edge.test/trust/identity/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerReference: 'SANAD-123456' }),
    }));
    assertEquals(duplicate.status, 409);
    assertEquals(rpcCalls, 0);

    hasPending = false;
    const submitted = await handleSubmitIdentityVerification(new Request('https://edge.test/trust/identity/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerReference: 'SANAD-123456', documentReference: 'DOC-42' }),
    }));
    assertEquals(submitted.status, 202);
    assertEquals(await submitted.json(), {
      submitted: true,
      status: 'pending_review',
      verificationId,
    });
    assertEquals(rpcCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
