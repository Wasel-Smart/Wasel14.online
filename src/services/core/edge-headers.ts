import { addCSRFHeader } from '../../utils/csrf';
import { publicAnonKey } from './api-resolver';

export function createEdgeHeaders(
  headers?: HeadersInit,
  userToken?: string,
  includeCSRF = true,
): Headers {
  let headersInit = headers ?? {};

  if (includeCSRF) {
    headersInit = addCSRFHeader(headersInit);
  }

  const finalHeaders = new Headers(headersInit);

  // The publishable key identifies the project at the Edge gateway; it is not
  // a user credential and must never be sent as a bearer token. Protected
  // handlers validate the user's signed access token in Authorization.
  if (publicAnonKey) {
    finalHeaders.set('apikey', publicAnonKey);
  }

  if (userToken) {
    finalHeaders.set('Authorization', `Bearer ${userToken}`);
  }

  return finalHeaders;
}
