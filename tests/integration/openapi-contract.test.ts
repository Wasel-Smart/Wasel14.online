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
interface OpenApiPath {
  get?: Record<string, unknown>;
  post?: Record<string, unknown>;
  put?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  delete?: Record<string, unknown>;
}
const paths = (OPENAPI_SPEC.paths as Record<string, OpenApiPath>) || {};
describe('OpenAPI contract matches edge function routes', () => {
  it('every frontend route is covered by the edge route table', () => {
    const result = spawnSync('node', ['scripts/check-route-contract.mjs'], { cwd: ROOT, encoding: 'utf8' });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
  it('defines only versioned public API paths', () => {
    const unversioned = Object.keys(paths).filter(p => !p.startsWith('/v1/'));
    expect(unversioned).toEqual([]);
  });
});
describe('OpenAPI schemas reference valid types', () => {
  const schemas = (OPENAPI_SPEC.components as Record<string, unknown>)?.schemas as Record<string, unknown>;
  it('all referenced schemas exist', () => {
    const specStr = JSON.stringify(OPENAPI_SPEC);
    const refMatches = specStr.matchAll(/\$ref:\s*#\/components\/schemas\/([^"'\s}]+)/g);
    const missing: string[] = [];
    for (const match of refMatches) {
      const schemaName = match[1];
      if (!schemaName) { continue; }
      if (!schemas[schemaName]) {
        missing.push(schemaName);
      }
    }
    expect(missing).toEqual([]);
  });
  it('required schemas have required fields', () => {
    const requiredSchemas = ['Trip', 'Booking', 'Package', 'ErrorEnvelope', 'HealthResponse', 'Metadata'];
    for (const name of requiredSchemas) {
      expect(schemas[name]).toBeDefined();
      expect((schemas[name] as Record<string, unknown>).required).toBeDefined();
    }
  });
});
describe('OpenAPI operationIds are unique', () => {
  const operationIds = new Set<string>();
  const duplicates: string[] = [];
  for (const [, methods] of Object.entries(paths)) {
    for (const [, config] of Object.entries(methods)) {
      if (typeof config === 'object' && config !== null) {
        const opId = (config as Record<string, unknown>).operationId as string;
        if (opId) {
          if (operationIds.has(opId)) {
            duplicates.push(opId);
          } else {
            operationIds.add(opId);
          }
        }
      }
    }
  }
  it('has no duplicate operationIds', () => {
    expect(duplicates).toEqual([]);
  });
});
