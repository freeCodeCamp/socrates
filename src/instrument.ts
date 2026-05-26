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
    // Skip trace sampling on /health and /health/version. Docker
    // HEALTHCHECK + upstream LB probes hit these continuously; sampling
    // them adds Sentry tx volume with zero signal. Everything else
    // sampled at the configured rate.
    tracesSampler: ({ name }) => {
      if (typeof name === 'string' && /\s\/health(\/version)?(\?|$)/.test(name)) return 0;
      return SENTRY_TRACES_SAMPLE_RATE as number;
    },
    sendDefaultPii: false,
    maxValueLength: 2048,
    // Capture local variable values in stack frames. The `/hint` request
    // body is already forwarded to Sentry (see beforeSend comment below),
    // so local-var capture does not expand the data surface meaningfully
    // and significantly improves stack-frame debug velocity.
    includeLocalVariables: true,
    // Ship pino error/fatal lines to Sentry Logs.  Warn-level events
    // (redis reconnections, retryable Groq failures, auth rejections)
    // stay in the pino stdout stream — they're operational signals
    // that belong in the log aggregator, not Sentry.
    enableLogs: true,
    integrations: [
      Sentry.pinoIntegration({
        log: { levels: ['error', 'fatal'] },
      }),
      // Push memory / CPU / event-loop telemetry to Sentry Metrics at
      // the SDK default 30s interval. Free ops visibility on a service
      // that talks to Groq + Redis.
      Sentry.nodeRuntimeMetricsIntegration(),
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
