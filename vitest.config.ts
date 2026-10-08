/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vitest only defaults NODE_ENV to "test" when it is unset. A leaked
// NODE_ENV=production (easy to inherit in a shell that has run `npm run build`)
// makes React resolve to its production build, where `React.act` does not
// exist, so every DOM test dies with "React.act is not a function". Pin it.
process.env.NODE_ENV = 'test';

// Dedicated Vitest config — intentionally excludes @tailwindcss/vite.
// That plugin accesses Vite internals (plugin.config) that are unavailable
// inside the Vitest worker context, crashing every test suite with:
//   TypeError: Cannot read properties of undefined (reading 'config')
// CSS is irrelevant for unit/integration tests so the plugin is simply omitted.
export default defineConfig( {
  plugins: [ react() ],

  optimizeDeps: {
    noDiscovery: true,
  },

  resolve: {
    alias: [
      { find: '@', replacement: path.resolve( __dirname, './src' ) },
      { find: '$deno', replacement: path.resolve( __dirname, './supabase/functions' ) },
      { find: '@wasel/rbac', replacement: path.resolve( __dirname, './packages/rbac/src' ) },
    ],
  },

  test: {
    globals: true,
    environment: 'jsdom',
    // 'threads' and 'forks' pools both fail on Windows paths with spaces
    // (e.g. OneDrive\Desktop) because the worker spawn times out waiting for
    // the IPC channel. 'vmForks' runs each test file in a VM context inside
    // the same process, avoiding the worker spawn entirely.
    pool: 'vmForks',
    environmentOptions: { url: 'http://localhost/' },
    // A filter that matches nothing exits 0, which let an entire suite silently
    // disappear from CI without anyone noticing. Tests that are deliberately
    // not run belong in the exclude list below, not behind a pass-by-default.
    passWithNoTests: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: './tests/setup.ts',
    include: [
      'tests/**/*.test.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
      // The RBAC package holds the permission map every authz decision reads.
      // Its test was previously unreachable from every runner, so a regression in
      // role permissions would have gone unseen.
      'packages/**/*.test.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/e2e/**',
      '**/tests/e2e/**',
      '**/mobile/**',
      '**/*.spec.ts',
      // Shared test helpers that live in __tests__ directories. These contain no
      // tests, so Vitest reports them as failing suites ("no tests found").
      '**/__tests__/**/setup*.ts',
      '**/__tests__/**/*[!.t]est.{ts,tsx}',
    ],
    env: {
      VITE_EVENT_BROKER: 'memory',
      VITE_ALLOW_DIRECT_SUPABASE_FALLBACK: 'true',
      // Pin feature flags that tests assert defaults for, so a developer's
      // local .env/.env.local (which Vite loads into every mode, including
      // 'test') can't silently change what the test suite sees.
      VITE_ENABLE_TWO_FACTOR_AUTH: 'false',
    },
    coverage: {
      provider: 'v8',
      // `json-summary` writes coverage/coverage-summary.json, which the CI
      // coverage gate reads. Without it that step crashed on a missing file.
      reporter: [ 'text', 'json', 'json-summary', 'html', 'lcov' ],
      include: [ 'src/**/*.{ts,tsx}' ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/vite-env.d.ts',
        'src/mobilityGraph.ts',
      ],
      thresholds: {
        branches: 30,
        functions: 30,
        lines: 35,
        statements: 35,
      },
    },
  },
} );
