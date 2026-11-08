import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isAuthorizedStripeSetupCaller } from '../stripe-setup/auth.ts';

Deno.test('stripe-setup accepts only the exact configured service-role bearer key', () => {
  const key = 'server-only-key';
  const request = ( authorization?: string ) =>
    new Request( 'https://example.test/functions/v1/stripe-setup', {
      headers: authorization ? { Authorization: authorization } : {},
    } );

  assertEquals( isAuthorizedStripeSetupCaller( request( `Bearer ${ key }` ), key ), true );
  assertEquals( isAuthorizedStripeSetupCaller( request( 'Bearer user-jwt' ), key ), false );
  assertEquals( isAuthorizedStripeSetupCaller( request( `Bearer ${ key }x` ), key ), false );
  assertEquals( isAuthorizedStripeSetupCaller( request(), key ), false );
  assertEquals( isAuthorizedStripeSetupCaller( request( `Bearer ${ key }` ), '' ), false );
});
