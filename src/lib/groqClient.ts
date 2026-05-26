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
import type { ChallengeType } from '../types/sanitizer';

export interface GroqRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  challengeType?: ChallengeType;
  logger?: Logger;
}

export interface GroqResponse {
  hint: string;
  model_used?: string;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Carries upstream HTTP status from non-2xx Groq responses. Body is the parsed
 * JSON payload (or raw text fallback) — never the request, so the bearer token
 * stays on the local stack frame and cannot leak through pino's err serializer.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

function selectModel(challengeType?: ChallengeType): string {
  if (!challengeType) {
    return GROQ_MODEL;
  }
  // Dynamically check for GROQ_MODEL_<CHALLENGE_TYPE> env var
  const envVarName = `GROQ_MODEL_${challengeType.toUpperCase()}`;
  const typeSpecificModel = process.env[envVarName];
  return typeSpecificModel || GROQ_MODEL;
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

interface GroqUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

interface GroqApiResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: GroqUsage;
}

async function postChatCompletion(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<GroqApiResponse> {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    let parsed: unknown;
    const text = await res.text().catch(() => '');
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = text;
    }
    throw new HttpError(res.status, `HTTP ${res.status} ${res.statusText}`, parsed);
  }

  return (await res.json()) as GroqApiResponse;
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
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await postChatCompletion(
        {
          model: selectModel(challengeType),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.5,
        },
        GROQ_TIMEOUT_MS(),
      );

      const hint = data.choices?.[0]?.message?.content || '';
      const model_used = data.model || GROQ_MODEL;
      const completionTokens = data.usage?.completion_tokens;

      // Log token usage and cache metrics for cost monitoring
      if (data.usage) {
        const cachedTokens = data.usage.prompt_tokens_details?.cached_tokens || 0;
        const cacheHitRate =
          data.usage.prompt_tokens && data.usage.prompt_tokens > 0
            ? ((cachedTokens / data.usage.prompt_tokens) * 100).toFixed(1)
            : '0.0';

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

      // Reset circuit breaker on success
      cb.failures = 0;

      return { hint: hint.trim(), model_used, completionTokens };
    } catch (err) {
      const raw = err instanceof Error ? err : new Error(String(err));
      const retryable = isRetryableError(raw);
      lastError = toSafeError(raw);

      if (!retryable) {
        handleNonRetryableError(lastError, logger);
        throw createGroqError(lastError);
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
  throw finalError;
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

  // All retries exhausted, return empty result (let the caller handle it)
  logger.error(
    {
      initialMaxTokens,
      retryMaxTokens,
      emptyResponseRetries,
      challengeType: challengeType || 'unknown',
    },
    'groq returned empty response after all retries',
  );

  return { hint: '', model_used: result.model_used };
}

function isTimeoutOrNetworkError(err: Error): boolean {
  // AbortSignal.timeout() produces DOMException name='TimeoutError'; manual aborts -> 'AbortError'.
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
  // Undici / Node fetch network failures surface as TypeError with cause carrying ECONN*/ENOTFOUND.
  const cause = (err as { cause?: { code?: string } }).cause;
  if (
    cause?.code &&
    /^E(CONN|TIMEDOUT|NETUNREACH|HOSTUNREACH|NOTFOUND|PIPE|RESET)/.test(cause.code)
  )
    return true;
  if (err.message.includes('timeout') || err.message.includes('ECONN')) return true;
  return false;
}

function isRetryableError(err: Error): boolean {
  if (err instanceof HttpError) {
    const status = err.status;
    // Retry on 5xx and 429; don't retry on other 4xx
    if (status >= 500 || status === 429) return true;
    if (status >= 400 && status < 500) return false;
    return true;
  }

  if (isTimeoutOrNetworkError(err)) return true;

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
): void {
  logger.error({ err }, 'all groq retry attempts failed');

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

function createGroqError(err: Error): Error {
  if (err instanceof HttpError) {
    const status = err.status;
    const isRetryable = isRetryableError(err);
    const message = `Groq API error (${status}): ${err.message}`;
    return new GroqApiError(message, status, isRetryable, err);
  }

  // For non-HTTP errors, check if they're retryable
  const isRetryable = isRetryableError(err);
  if (isRetryable) {
    return new GroqApiError(`Groq request error: ${err.message}`, 503, true, err);
  }

  return err;
}

export default generateFromGroq;
