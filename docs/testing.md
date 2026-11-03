# Testing

Wasel uses a three-layer testing strategy:

| Layer | Tool | Purpose | Command |
|-------|------|---------|---------|
| Unit | Vitest | Pure functions, utilities, domain logic | `npm run test:unit` |
| Integration | Vitest | Service contracts, data flow | `npm run test:unit -- tests/integration` |
| E2E | Playwright | User journeys, browser verification | `npm run test:e2e` |
| Load | k6 | Performance under load | `npm run test:load:smoke` |

## Coverage Floors and Targets

CI currently enforces ratchet floors of 14% branches, 17% functions, 21% lines,
and 20% statements. Those floors prevent coverage from regressing but are not a
claim that the test suite is comprehensive. The long-term targets are higher:

```
Branches:   75%
Functions:  80%
Lines:      85%
Statements: 85%
```

Run with coverage: `npm run test:unit -- --coverage`

Coverage output is evidence about executed code paths, not proof that behavior is
correct. Prioritize additional tests for authentication, authorization, payment
settlement, wallet ledger invariants, and driver approval before raising the CI
floors. Never lower the floors to make a failing change pass.

## Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('feature: featureName', () => {
  it('handles normal case', () => {
    expect(fn('input')).toBe('output');
  });

  it('handles edge case', () => {
    expect(fn('')).toBe('');
  });

  it('throws on invalid input', () => {
    expect(() => fn(null)).toThrow();
  });
});
```

## Test File Organization

```
tests/
  unit/          # Unit tests for pure logic
  integration/   # Service integration tests
  e2e/           # Playwright browser tests
  load/          # k6 performance tests
  utils/         # Test utilities and helpers
```

## Mocking

Global mocks are in `tests/setup.ts`:
- Web Crypto API
- localStorage/sessionStorage
- requestIdleCallback

Mock services using `vi.mock()`:

```typescript
vi.mock('@/services/supabase', () => ({
  supabase: { from: vi.fn() },
}));
```
