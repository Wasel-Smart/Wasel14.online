import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

const OPENAPI_SPEC = load(readSource('docs/openapi/wasel-v1.yaml')) as Record<string, unknown>;
const API_ENDPOINTS_SOURCE = readSource('src/utils/api.ts');
const EDGE_INDEX = readSource('supabase/functions/make-server-0b1f4071/index.ts');

describe('API endpoint contracts between frontend and backend', () => {
  const apiEndpoints = extractApiEndpoints(API_ENDPOINTS_SOURCE);

  it('every frontend route is covered by the edge route table', () => {
    const result = spawnSync('node', ['scripts/check-route-contract.mjs'], { cwd: ROOT, encoding: 'utf8' });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it('all endpoints use /v1 prefix consistently', () => {
    const nonV1: string[] = [];
    for (const [name, endpoint] of Object.entries(apiEndpoints)) {
      if (!endpoint.path.startsWith('/v1/') && endpoint.path !== '/health') {
        nonV1.push(`${name}: ${endpoint.path}`);
      }
    }
    expect(nonV1).toEqual([]);
  });

  it('documents the mobile identity submission endpoint', () => {
    expect(apiEndpoints.TRUST_IDENTITY?.path).toBe('/v1/trust/identity/submit');
    expect(EDGE_INDEX).toContain("path === '/trust/identity/submit'");
  });
});

describe('API endpoint security requirements', () => {
  it('mutating endpoints are marked for CSRF protection', () => {
    expect(API_ENDPOINTS_SOURCE).toContain("[ 'POST', 'PUT', 'PATCH', 'DELETE' ].includes( method )");
    expect(API_ENDPOINTS_SOURCE).toContain('return addCSRFHeader( headers )');
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(API_ENDPOINTS_SOURCE).toContain(`getApiHeaders( accessToken, undefined, '${method}' )`);
    }
  });

  it('endpoints requiring auth are not public', () => {
    const trustHandler = readSource('supabase/functions/make-server-0b1f4071/_handlers/trust.ts');
    expect(trustHandler).toContain('export async function handleSubmitIdentityVerification');
    expect(trustHandler).toContain("const auth = await authenticateRequest( request )");
  });
});

describe('API endpoint request/response contracts', () => {
  const schemas = (OPENAPI_SPEC.components as Record<string, unknown>)?.schemas as Record<string, unknown>;

  it('CreateTripRequest matches trip creation handler expectations', () => {
    const schema = schemas.CreateTripRequest as Record<string, unknown>;
    expect(schema.required).toContain('from');
    expect(schema.required).toContain('to');
    expect(schema.required).toContain('date');
    expect(schema.required).toContain('time');
    expect(schema.required).toContain('seats');
    expect(schema.required).toContain('carModel');
  });

  it('CreateBookingRequest matches booking creation handler expectations', () => {
    const schema = schemas.CreateBookingRequest as Record<string, unknown>;
    expect(schema.required).toContain('trip_id');
    expect(schema.required).toContain('seats_requested');
  });

  it('CreatePackageRequest matches package creation handler expectations', () => {
    const schema = schemas.CreatePackageRequest as Record<string, unknown>;
    expect(schema.required).toContain('tracking_number');
    expect(schema.required).toContain('sender_id');
  });

  it('ErrorEnvelope matches api-envelope contract', () => {
    const envelope = schemas.ErrorEnvelope as Record<string, unknown>;
    expect(envelope).toBeDefined();
    expect(envelope.properties).toBeDefined();
  });
});

describe('OpenAPI to edge function path coverage', () => {
  const paths = (OPENAPI_SPEC.paths as Record<string, unknown>) || {};

  it('covers all core domain paths', () => {
    const requiredDomains = [
      '/trips',
      '/bookings',
      '/packages',
      '/wallet',
      '/notifications',
      '/ratings',
      '/reviews',
      '/chat',
      '/trust',
      '/payments',
      '/admin',
      '/gdpr',
      '/communications',
      '/moderation',
      '/corporate',
      '/mobility-os',
      '/cancellations',
      '/profile',
      '/auth',
    ];

    for (const domain of requiredDomains) {
      const hasPath = Object.keys(paths).some(p => p.replace(/^\/v1(?=\/|$)/, '').startsWith(domain));
      expect(hasPath).toBe(true);
    }
  });
});

function extractApiEndpoints(source: string): Record<string, { path: string; method: string }> {
  const endpoints: Record<string, { path: string; method: string }> = {};

  // Match API_ENDPOINTS object entries
  const endpointSection = source.slice(source.indexOf('export const API_ENDPOINTS'));
  const lines = endpointSection.split('\n');

  for (const line of lines) {
    const [, key, endpointPath] = line.match(/^\s*([A-Z_]+):\s*['"`]([^'"`]+)['"`]/) ?? [];
    if (key && endpointPath) {
      endpoints[key] = { path: endpointPath, method: inferMethod(key) };
    }
    // Also match function endpoints
    const [, fnKey, fnPath] = line.match(/^\s*([A-Z_]+):\s*\([^)]*\)\s*=>\s*['"`]([^'"`]+)['"`]/) ?? [];
    if (fnKey && fnPath) {
      endpoints[fnKey] = { path: fnPath, method: inferMethod(fnKey) };
    }
  }

  return endpoints;
}

function inferMethod(key: string): string {
  if (key.includes('CREATE') || key.includes('POST') || key.includes('SUBMIT') ||
      key.includes('SETUP') || key.includes('ENABLE') || key.includes('START') ||
      key.includes('CLAIM') || key.includes('SUBSCRIBE') || key.includes('TOPUP') ||
      key.includes('PAY') || key.includes('SEND') || key.includes('DELIVER') ||
      key.includes('PROCESS') || key.includes('GENERATE') || key.includes('ADD') ||
      key.includes('APPLY') || key.includes('ASSIGN') || key.includes('CREATE')) {
    return 'POST';
  }
  if (key.includes('UPDATE') || key.includes('PATCH') || key.includes('PATCH') ||
      key.includes('MARK_READ') || key.includes('CONFIRM') || key.includes('VERIFY') ||
      key.includes('RESOLVE') || key.includes('APPROVE') || key.includes('SET')) {
    return 'PATCH';
  }
  if (key.includes('DELETE') || key.includes('CANCEL') || key.includes('DISABLE') ||
      key.includes('CLEAR') || key.includes('REMOVE')) {
    return 'DELETE';
  }
  return 'GET';
}

