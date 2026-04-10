import { vi } from 'vitest';

// Belt-and-braces: ensure no accidental Sentry traffic from tests.
process.env.SENTRY_DSN = '';
process.env.NODE_ENV = 'test';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  setupFastifyErrorHandler: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
  withScope: vi.fn((cb: (scope: { setTag: () => void; setContext: () => void }) => void) =>
    cb({ setTag: () => {}, setContext: () => {} }),
  ),
}));
