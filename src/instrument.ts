// This file MUST be imported as the literal first line of src/index.ts.
// Sentry's Node SDK patches http/https (and therefore axios) at require time,
// so any module imported before this file will not be instrumented. Do not
// move this import. Do not import this file from tests.
import * as Sentry from '@sentry/node';
import {
  BUILD_VERSION,
  NODE_ENV,
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  SENTRY_TRACES_SAMPLE_RATE,
} from './config/env';

// Skip init entirely when no DSN is configured (local dev default) or when
// running tests. Matches the same non-required-env pattern used elsewhere.
if (SENTRY_DSN && NODE_ENV !== 'test') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: BUILD_VERSION,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    maxValueLength: 2048,
    // Ship pino error/fatal lines to Sentry Logs.  Warn-level events
    // (redis reconnections, retryable Groq failures, auth rejections)
    // stay in the pino stdout stream — they're operational signals
    // that belong in the log aggregator, not Sentry.
    enableLogs: true,
    integrations: [
      Sentry.pinoIntegration({
        log: { levels: ['error', 'fatal'] },
      }),
    ],
    // Filter ioredis connection errors that the app's retryStrategy +
    // error listener already handle.  ioredis emits (doesn't throw)
    // these, but @opentelemetry/instrumentation-ioredis (bundled in
    // @sentry/node) would otherwise report every failed command as
    // an error span.  Strings match substrings, not exact.
    ignoreErrors: [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'Connection is closed',
      'MaxRetriesPerRequestError',
    ],
    beforeSend: (event, hint) => {
      // Drop handled HTTP errors (status < 500, including 4xx).
      // Sentry.setupFastifyErrorHandler captures these, but they're
      // expected/handled — only unhandled 5xx should reach Sentry.
      const ex = hint.originalException;
      if (ex && typeof ex === 'object') {
        const e = ex as Record<string, unknown>;
        const status = e.statusCode ?? e.status;
        if (typeof status === 'number' && status < 500) return null;
      }

      // Scrub credential headers. Sentry's default scrubbers handle
      // Authorization and Cookie, but x-api-key is custom and must be
      // filtered here. We also re-scrub the standard ones as belt-and-braces.
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        if (headers['x-api-key']) headers['x-api-key'] = '[Filtered]';
        if (headers.authorization) headers.authorization = '[Filtered]';
        if (headers.cookie) headers.cookie = '[Filtered]';
      }

      // Intentionally NOT scrubbing the /hint request body. The learner's
      // `userInput` is the same content we forward to Groq, so Sentry
      // visibility is not a meaningful expansion of the data surface, and
      // keeping it lets us debug real failures AND detect malicious or
      // prompt-injection content sent to the LLM. If that calculus ever
      // changes, filter `event.request.data.userInput` here.

      return event;
    },
  });
}
