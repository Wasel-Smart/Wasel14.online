import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
const ROOT = resolve(__dirname, '../..');
function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}
const OPENAPI_SPEC = load(readSource('docs/openapi/wasel-v1.yaml')) as Record<string, unknown>;
const EDGE_INDEX = readSource('supabase/functions/make-server-0b1f4071/index.ts');
interface OpenApiPath {
  get?: Record<string, unknown>;
  post?: Record<string, unknown>;
  put?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  delete?: Record<string, unknown>;
}
const paths = (OPENAPI_SPEC.paths as Record<string, OpenApiPath>) || {};
describe('OpenAPI contract matches edge function routes', () => {
  const openApiPaths = Object.keys(paths).map(p => p.replace(/^\/v1/, ''));
  const edgeRoutes = extractEdgeRoutes(EDGE_INDEX);
  it('every OpenAPI path has a corresponding edge route', () => {
    const missing: string[] = [];
    for (const apiPath of openApiPaths) {
      if (!edgeRoutes.has(apiPath)) {
        missing.push(apiPath);
      }
    }
    expect(missing).toEqual([]);
  });
  it('every edge route is documented in OpenAPI', () => {
    const undocumented: string[] = [];
    for (const [edgePath] of edgeRoutes) {
      if (!openApiPaths.some(p => pathsMatch(p, edgePath))) {
        undocumented.push(edgePath);
      }
    }
    expect(undocumented).toEqual([]);
  });
  it('HTTP methods match between OpenAPI and edge routes', () => {
    const mismatches: string[] = [];
    for (const [apiPath, apiMethods] of Object.entries(paths)) {
      const normalizedApiPath = apiPath.replace(/^\/v1/, '');
      const edgeMethods = edgeRoutes.get(normalizedApiPath);
      if (!edgeMethods) { continue; }
      const documentedMethods = Object.keys(apiMethods).filter(m => m !== 'parameters').map(m => m.toUpperCase());
      const declaredMethods = Array.from(edgeMethods);
      for (const method of documentedMethods) {
        if (!declaredMethods.includes(method)) {
          mismatches.push(`${method} ${apiPath} documented but not declared in edge`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
function extractEdgeRoutes(edgeSource: string): Map<string, Set<string>> {
  const routes = new Map<string, Set<string>>();
  // Parse RouteDescriptor array
  const routeRegex = /id:\s*'([^']+)'[\s\S]*?test:\s*\([^)]*\)\s*=>\s*([\s\S]{0,200}?)(?=\n\s*(?:id|handle|methods)\s*:)/g;
  for (const match of edgeSource.matchAll(routeRegex)) {
    const testFn = match[2];
    if (!testFn) { continue; }
    // Extract methods
    const methodsMatch = testFn.match(/methods:\s*\[([^\]]+)\]/);
    const methodsList = methodsMatch?.[1];
    const methods = methodsList
      ? methodsList.split(',').map(m => m.trim().replace(/'/g, ''))
      : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    // Extract path patterns
    const pathPatterns = extractPathPatterns(testFn);
    for (const pattern of pathPatterns) {
      const normalized = pattern.replace(/^\/v1/, '');
      if (!routes.has(normalized)) {
        routes.set(normalized, new Set());
      }
      for (const method of methods) {
        routes.get(normalized)!.add(method);
      }
    }
  }
  return routes;
}
function extractPathPatterns(testFn: string): string[] {
  const patterns: string[] = [];
  // Direct path matches: path === '/something'
  for (const m of testFn.matchAll(/path\s*===\s*'([^']+)'/g)) {
    const [, exact] = m;
    if (exact) { patterns.push(exact); }
  }
  // Prefix matches: path.startsWith('/something/')
  for (const m of testFn.matchAll(/path\.startsWith\(\s*'([^']+)'\s*\)/g)) {
    const [, prefix] = m;
    if (prefix) { patterns.push(prefix); }
  }
  // Regex patterns: /^\/something\/[^/]+$/
  for (const m of testFn.matchAll(/\/\\^\\\/([A-Za-z0-9_-]+)/g)) {
    patterns.push(`/${m[1]}/:id`);
  }
  // Template literal paths: `/wallet/${userId}`
  for (const m of testFn.matchAll(/`(\/[A-Za-z0-9_/-]*)\${/g)) {
    patterns.push(m[1] + '/:param');
  }
  // parseWalletRoute and parseEntityRoute
  for (const _m of testFn.matchAll(/parseWalletRoute\(\s*path\s*\)/g)) {
    patterns.push('/wallet/:userId/:action?/:resourceId?');
  }
  for (const m of testFn.matchAll(/parseEntityRoute\(\s*path\s*,\s*'([^']+)'/g)) {
    patterns.push(`/${m[1]}/:id/:action?`);
  }
  return [...new Set(patterns)];
}
function pathsMatch(openApiPath: string, edgePath: string): boolean {
  // Convert OpenAPI path params to regex
  const regex = new RegExp('^' + openApiPath.replace(/\{([^}]+)\}/g, '[^/]+') + '$');
  return regex.test(edgePath);
}
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