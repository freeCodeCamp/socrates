import * as Sentry from '@sentry/node';
import axios, { AxiosError } from 'axios';
import {
  GROQ_API_KEY,
  GROQ_BACKOFF_BASE_MS,
  GROQ_EMPTY_RESPONSE_RETRIES,
  GROQ_MAX_RETRIES,
  GROQ_MAX_TOKENS,
  GROQ_MAX_TOKENS_RETRY,
  GROQ_MODEL,
  GROQ_TIMEOUT_MS,
  MODEL_CB_COOLDOWN_MS,
  MODEL_CB_FAILURES,
} from '../config/env';
import { type Logger, rootLogger } from '../config/logger';
import { GroqApiError, toSafeError } from '../errors/groqApiError';
import { ModelUnavailableError } from '../errors/modelUnavailableError';
import { CHALLENGE_TYPES, type ChallengeType } from '../types/hint';

export interface GroqRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  challengeType?: ChallengeType;
  logger?: Logger;
}

export interface GroqResponse {
  hint: string;
  model_used: string;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export function selectModel(challengeType?: ChallengeType): string {
  if (!challengeType) {
    return GROQ_MODEL;
  }
  // Dynamically check for GROQ_MODEL_<CHALLENGE_TYPE> env var
  const envVarName = `GROQ_MODEL_${challengeType.toUpperCase()}`;
  const typeSpecificModel = process.env[envVarName];
  return typeSpecificModel || GROQ_MODEL;
}

export interface ModelConfig {
  defaultModel: string;
  models: Record<ChallengeType, string>;
}

export function resolvedModelConfig(): ModelConfig {
  return {
    defaultModel: selectModel(),
    models: Object.fromEntries(CHALLENGE_TYPES.map((type) => [type, selectModel(type)])) as Record<
      ChallengeType,
      string
    >,
  };
}

// Circuit breaker state interface
interface CircuitBreaker {
  failures: number;
  openedUntil: number;
}

const circuitBreaker: CircuitBreaker = { failures: 0, openedUntil: 0 };

interface GroqApiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  challengeType?: ChallengeType;
  maxTokens: number;
}

interface GroqApiResult {
  hint: string;
  model_used: string;
  completionTokens?: number;
}

/**
 * Makes a single API call to Groq with retry logic for transient errors.
 * Returns the result or throws an error.
 */
async function makeGroqApiCall(
  options: GroqApiCallOptions,
  cb: CircuitBreaker,
  logger: Logger,
): Promise<GroqApiResult> {
  const { systemPrompt, userPrompt, challengeType, maxTokens } = options;
  let lastError: Error | null = null;

  const maxRetries = GROQ_MAX_RETRIES();
  const requestModel = selectModel(challengeType);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await Sentry.startSpan(
        {
          name: `chat ${requestModel}`,
          op: 'gen_ai.chat',
          attributes: {
            'gen_ai.operation.name': 'chat',
            'gen_ai.provider.name': 'groq',
            'gen_ai.request.model': requestModel,
            'gen_ai.request.max_tokens': maxTokens,
            'gen_ai.request.attempt': attempt,
            challenge_type: challengeType ?? 'unknown',
          },
        },
        async (span) => {
          const res = await axios.post(
            GROQ_API_URL,
            {
              model: requestModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              max_tokens: maxTokens,
              temperature: 0.5,
            },
            {
              headers: {
                Authorization: `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
              },
              timeout: GROQ_TIMEOUT_MS(),
            },
          );

          const data = res.data;
          const hint = data.choices?.[0]?.message?.content || '';
          const model_used = data.model || GROQ_MODEL;
          const completionTokens = data.usage?.completion_tokens;

          // Log token usage and cache metrics for cost monitoring
          if (data.usage) {
            const cachedTokens = data.usage.prompt_tokens_details?.cached_tokens || 0;
            const cacheHitRate =
              data.usage.prompt_tokens > 0
                ? ((cachedTokens / data.usage.prompt_tokens) * 100).toFixed(1)
                : '0.0';

            span.setAttributes({
              'gen_ai.response.model': model_used,
              'gen_ai.usage.input_tokens': data.usage.prompt_tokens,
              'gen_ai.usage.output_tokens': data.usage.completion_tokens,
              'gen_ai.usage.total_tokens': data.usage.total_tokens,
              'gen_ai.usage.input_tokens.cached': cachedTokens,
              'gen_ai.usage.cache_hit_rate': Number(cacheHitRate),
            });

            logger.info(
              {
                model: model_used,
                challengeType: challengeType || 'unknown',
                promptTokens: data.usage.prompt_tokens,
                cachedTokens,
                cacheHitRate: `${cacheHitRate}%`,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
                maxTokensUsed: maxTokens,
              },
              'groq token usage',
            );
          }

          span.setAttribute('gen_ai.response.outcome', hint ? 'success' : 'empty');

          // An empty HTTP response is not a usable model success. Preserve
          // the failure count until generateFromGroq either gets a real hint
          // or records one exhausted empty-response failure.
          if (hint) cb.failures = 0;

          return { hint: hint.trim(), model_used, completionTokens };
        },
      );
    } catch (err) {
      // Compute retryability while the raw error (incl. AxiosError shape) is
      // available, then immediately strip axios internals. From this point
      // forward `lastError` carries no `config`/`request`/`response`, so it is
      // safe to feed to pino's err serializer without leaking the bearer.
      const raw = err instanceof Error ? err : new Error(String(err));
      const retryable = isRetryableError(raw);
      const status = raw instanceof AxiosError ? raw.response?.status : undefined;
      lastError = toSafeError(raw);

      if (!retryable) {
        handleNonRetryableError(lastError, logger);
        throw createGroqError(lastError, status, retryable);
      }

      logger.warn({ attempt, maxRetries, err: lastError }, 'groq request failed');

      // Exponential backoff with jitter
      if (attempt < maxRetries) {
        const backoff = Math.min(GROQ_BACKOFF_BASE_MS() * 2 ** attempt, 5000);
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
      }
    }
  }

  // All retries failed - handle circuit breaker
  const finalError = lastError || new Error('Groq generate failed');
  handleAllRetriesFailed(finalError, cb, logger);
  throw new ModelUnavailableError('Groq unavailable after exhausting retries');
}

export async function generateFromGroq(options: GroqRequestOptions): Promise<GroqResponse> {
  const { systemPrompt, userPrompt, challengeType } = options;
  const logger = options.logger ?? rootLogger;
  const now = Date.now();

  const cb = circuitBreaker;

  if (cb.openedUntil && cb.openedUntil > now) {
    throw new ModelUnavailableError('Model circuit breaker is open');
  }

  const initialMaxTokens = GROQ_MAX_TOKENS();
  const retryMaxTokens = GROQ_MAX_TOKENS_RETRY();
  const emptyResponseRetries = GROQ_EMPTY_RESPONSE_RETRIES();

  // First attempt with standard max_tokens
  const result = await makeGroqApiCall(
    { systemPrompt, userPrompt, challengeType, maxTokens: initialMaxTokens },
    cb,
    logger,
  );

  // If we got a non-empty response, return it
  if (result.hint.length > 0) {
    return { hint: result.hint, model_used: result.model_used };
  }

  // Empty response detected - retry with higher max_tokens
  logger.warn(
    {
      initialMaxTokens,
      retryMaxTokens,
      completionTokens: result.completionTokens,
      challengeType: challengeType || 'unknown',
    },
    'groq returned empty response, retrying with higher max_tokens',
  );

  for (let emptyRetry = 1; emptyRetry <= emptyResponseRetries; emptyRetry++) {
    const retryResult = await makeGroqApiCall(
      { systemPrompt, userPrompt, challengeType, maxTokens: retryMaxTokens },
      cb,
      logger,
    );

    if (retryResult.hint.length > 0) {
      logger.info(
        {
          emptyRetryAttempt: emptyRetry,
          retryMaxTokens,
          challengeType: challengeType || 'unknown',
        },
        'groq retry with higher max_tokens succeeded',
      );
      return { hint: retryResult.hint, model_used: retryResult.model_used };
    }

    logger.warn(
      {
        emptyRetry,
        emptyResponseRetries,
        retryMaxTokens,
        completionTokens: retryResult.completionTokens,
        challengeType: challengeType || 'unknown',
      },
      'groq empty response retry still returned empty',
    );
  }

  handleAllRetriesFailed(
    new Error('Groq returned an empty response after all retries'),
    cb,
    logger,
    'groq returned empty response after all retries',
  );
  throw new ModelUnavailableError('Groq returned an empty response after all retries');
}

function isRetryableError(err: Error): boolean {
  if (err instanceof AxiosError) {
    const status = err.response?.status;

    // Retry on network errors, timeouts, and 5xx errors
    if (!status || status >= 500 || status === 429) return true;

    // Don't retry on client errors (4xx) except rate limit (429)
    if (status >= 400 && status < 500 && status !== 429) return false;
  }

  // Retry on timeout and network errors
  if (err.message.includes('timeout') || err.message.includes('ECONN')) return true;

  // Default to retry for unknown errors
  return true;
}

function handleNonRetryableError(err: Error, logger: Logger): void {
  logger.error({ err }, 'non-retryable groq error');

  // Don't increment circuit breaker for non-retryable errors (authentication, bad request, etc.)
  // These are application/configuration issues, not service availability issues
}

function handleAllRetriesFailed(
  err: Error,
  cb: { failures: number; openedUntil: number },
  logger: Logger,
  message = 'all groq retry attempts failed',
): void {
  logger.warn({ err }, message);

  // Increment failure count and possibly open circuit breaker
  cb.failures = (cb.failures || 0) + 1;
  if (cb.failures >= MODEL_CB_FAILURES) {
    cb.openedUntil = Date.now() + MODEL_CB_COOLDOWN_MS;
    cb.failures = 0;
    logger.warn(
      { openedUntil: new Date(cb.openedUntil).toISOString() },
      'groq circuit breaker opened',
    );
  }
}

function createGroqError(err: Error, axiosStatus: number | undefined, isRetryable: boolean): Error {
  if (axiosStatus !== undefined) {
    return new GroqApiError('Model provider request failed', 502, isRetryable, err, axiosStatus);
  }

  if (isRetryable) {
    return new GroqApiError(`Groq request error: ${err.message}`, 503, true, err);
  }

  return err;
}

export default generateFromGroq;
