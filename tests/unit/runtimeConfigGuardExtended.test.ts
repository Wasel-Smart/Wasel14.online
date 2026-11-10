import { describe, expect, it } from 'vitest';
import {
  getObservabilityWarnings,
  getStartupConfigurationError,
  type StartupEnvironment,
} from '@/utils/runtimeConfigGuard';

const VALID: StartupEnvironment = {
  DEV: false,
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
};

const PROD_HOST = 'www.wasel14.online';

describe('runtimeConfigGuard: getStartupConfigurationError', () => {
  it('never blocks a dev server', () => {
    expect(getStartupConfigurationError({ DEV: true }, PROD_HOST)).toBeNull();
  });

  it('never blocks the test mode', () => {
    expect(getStartupConfigurationError({ DEV: false, MODE: 'test' }, PROD_HOST)).toBeNull();
  });

  it('rejects local-auth test mode on a deployed host', () => {
    const error = getStartupConfigurationError(
      { DEV: false, VITE_E2E_LOCAL_AUTH: 'true' },
      PROD_HOST,
    );
    expect(error).toContain('VITE_E2E_LOCAL_AUTH');
  });

  it.each(['localhost', '127.0.0.1', '::1', '[::1]', undefined])(
    'allows local-auth test mode on %s',
    hostname => {
      expect(
        getStartupConfigurationError({ DEV: false, VITE_E2E_LOCAL_AUTH: 'true' }, hostname),
      ).toBeNull();
    },
  );

  it('accepts a valid publishable-key configuration', () => {
    expect(getStartupConfigurationError(VALID, PROD_HOST)).toBeNull();
  });

  it('reports a missing URL or key with the same actionable message', () => {
    const message =
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.';
    expect(
      getStartupConfigurationError(
        { DEV: false, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' },
        PROD_HOST,
      ),
    ).toBe(message);
    expect(
      getStartupConfigurationError(
        { DEV: false, VITE_SUPABASE_URL: 'https://project.supabase.co' },
        PROD_HOST,
      ),
    ).toBe(message);
  });

  it('requires HTTPS for the Supabase URL', () => {
    expect(
      getStartupConfigurationError({ ...VALID, VITE_SUPABASE_URL: 'http://project.supabase.co' }, PROD_HOST),
    ).toBe('Supabase URL must use HTTPS.');
  });

  it('rejects the disabled legacy JWT anon key', () => {
    const error = getStartupConfigurationError(
      { ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOi.legacy.key' },
      PROD_HOST,
    );
    expect(error).toContain('legacy JWT');
  });

  it('rejects a key that is not a publishable key', () => {
    expect(
      getStartupConfigurationError({ ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: 'not-a-key' }, PROD_HOST),
    ).toBe('Supabase publishable key appears to be invalid.');
  });

  it('falls back to VITE_SUPABASE_ANON_KEY when the publishable key is unset', () => {
    expect(
      getStartupConfigurationError(
        {
          DEV: false,
          VITE_SUPABASE_URL: 'https://project.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'sb_publishable_from_anon_var',
        },
        PROD_HOST,
      ),
    ).toBeNull();
  });

  it('prefers the publishable key over the anon key when both are set', () => {
    expect(
      getStartupConfigurationError(
        { ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: 'bad', VITE_SUPABASE_ANON_KEY: 'sb_publishable_ok' },
        PROD_HOST,
      ),
    ).toBe('Supabase publishable key appears to be invalid.');
  });

  it('treats an empty publishable key as not configured rather than falling back', () => {
    expect(
      getStartupConfigurationError(
        { ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: 'sb_publishable_ok' },
        PROD_HOST,
      ),
    ).toContain('Supabase is not configured');
  });

  it('requires HTTPS for an explicit API URL but allows it to be unset', () => {
    expect(
      getStartupConfigurationError({ ...VALID, VITE_API_URL: 'http://api.example.com' }, PROD_HOST),
    ).toBe('VITE_API_URL must use HTTPS.');
    expect(
      getStartupConfigurationError({ ...VALID, VITE_API_URL: 'https://api.example.com' }, PROD_HOST),
    ).toBeNull();
  });
});

describe('runtimeConfigGuard: getObservabilityWarnings', () => {
  const OBSERVED: StartupEnvironment = {
    DEV: false,
    VITE_SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1',
    VITE_APP_INSIGHTS_CONNECTION_STRING: 'InstrumentationKey=00000000-0000-0000-0000-000000000000',
  };

  it('stays silent in dev, test and local-auth modes', () => {
    expect(getObservabilityWarnings({ DEV: true })).toEqual([]);
    expect(getObservabilityWarnings({ DEV: false, MODE: 'test' })).toEqual([]);
    expect(getObservabilityWarnings({ DEV: false, VITE_E2E_LOCAL_AUTH: 'true' })).toEqual([]);
  });

  it('returns nothing for a fully configured production build', () => {
    expect(getObservabilityWarnings(OBSERVED)).toEqual([]);
  });

  it('warns about missing Sentry and App Insights in production', () => {
    const warnings = getObservabilityWarnings({ DEV: false });
    expect(warnings).toHaveLength(2);
    expect(warnings.join(' ')).toContain('VITE_SENTRY_DSN');
    expect(warnings.join(' ')).toContain('VITE_APP_INSIGHTS_CONNECTION_STRING');
  });

  it('treats template placeholders as unset', () => {
    const warnings = getObservabilityWarnings({
      ...OBSERVED,
      VITE_SENTRY_DSN: 'paste_your_dsn_here',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('VITE_SENTRY_DSN');
  });

  it('accepts App Insights configured by instrumentation key alone', () => {
    const warnings = getObservabilityWarnings({
      DEV: false,
      VITE_SENTRY_DSN: OBSERVED.VITE_SENTRY_DSN,
      VITE_APP_INSIGHTS_KEY: '00000000-0000-0000-0000-000000000000',
    });
    expect(warnings).toEqual([]);
  });

  it('warns when demo rides are enabled in a production build', () => {
    const warnings = getObservabilityWarnings({ ...OBSERVED, VITE_ENABLE_DEMO_RIDES: 'true' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('VITE_ENABLE_DEMO_RIDES');
  });

  it('warns when the direct Supabase fallback is enabled in a production build', () => {
    const warnings = getObservabilityWarnings({
      ...OBSERVED,
      VITE_ALLOW_DIRECT_SUPABASE_FALLBACK: 'true',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('RLS is the only guard');
  });
});
