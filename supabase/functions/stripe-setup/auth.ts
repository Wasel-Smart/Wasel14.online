export function isAuthorizedStripeSetupCaller (
  request: Request,
  serviceRoleKey: string,
): boolean {
  const expected = `Bearer ${ serviceRoleKey }`;
  const authorization = request.headers.get( 'Authorization' ) ?? '';
  if ( !serviceRoleKey || authorization.length !== expected.length ) {
    return false;
  }

  let difference = 0;
  for ( let index = 0; index < expected.length; index++ ) {
    difference |= expected.charCodeAt( index ) ^ authorization.charCodeAt( index );
  }

  return difference === 0;
}
