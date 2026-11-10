// Coverage is measured over ALL source files, not just the ones a test happens to import.
// Without collectCoverageFrom, Jest only reports files that were loaded by a test, which
// made the number look like ~88% while most screens and services were never counted.
//
// The 75/60/90/85 targets are enforced only when COVERAGE_ENFORCE=1. CI prints the true
// summary on every run (see .github/workflows/ci.yml) so the real number is visible
// while coverage is built up; set floors just below the measured value and ratchet up.
const enforce = process.env.COVERAGE_ENFORCE === '1';

module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.global.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?|expo-.*|@expo-.*|@react-navigation|@tanstack|zustand|socket.io-client|react-native-mmkv|@sentry|@react-native-firebase|@testing-library/react-native))',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/test/**',
  ],
  ...(enforce
    ? {
        coverageThreshold: {
          global: {
            statements: 75,
            branches: 60,
            functions: 90,
            lines: 85,
          },
        },
      }
    : {}),
};
