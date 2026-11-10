jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  withProfiler: (component: unknown) => component,
}));

jest.mock('./logging', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const originalNodeEnv = process.env.NODE_ENV;

describe('initPerformanceMonitoring', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example.ingest.sentry.io/1';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    } else {
      process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    }
    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('samples production traces and excludes screenshots and view hierarchies', () => {
    const sentry = jest.requireMock<typeof import('@sentry/react-native')>('@sentry/react-native');
    const { initPerformanceMonitoring } = jest.requireActual<typeof import('./performance')>('./performance');

    initPerformanceMonitoring();

    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      tracesSampleRate: 0.1,
      attachScreenshot: false,
      attachViewHierarchy: false,
    }));
  });
});
