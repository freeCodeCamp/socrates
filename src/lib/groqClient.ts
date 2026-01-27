import axios, { AxiosError } from 'axios';
import {
  GROQ_API_KEY,
  GROQ_BACKOFF_BASE_MS,
  GROQ_MAX_RETRIES,
  GROQ_MODEL,
  GROQ_TIMEOUT_MS,
  MODEL_CB_COOLDOWN_MS,
  MODEL_CB_FAILURES,
} from '../config/env';
import { logger } from '../config/logger';
import { GroqApiError } from '../errors/groqApiError';
import { ModelUnavailableError } from '../errors/modelUnavailableError';
import type { ChallengeType } from '../types/sanitizer';

export interface GroqRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  challengeType?: ChallengeType;
}

export interface GroqResponse {
  hint: string;
  model_used?: string;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function selectModel(challengeType?: ChallengeType): string {
  if (!challengeType) {
    return GROQ_MODEL;
  }
  // Dynamically check for GROQ_MODEL_<CHALLENGE_TYPE> env var
  const envVarName = `GROQ_MODEL_${challengeType.toUpperCase()}`;
  const typeSpecificModel = process.env[envVarName];
  return typeSpecificModel || GROQ_MODEL;
}

export async function generateFromGroq(options: GroqRequestOptions): Promise<GroqResponse> {
  const { systemPrompt, userPrompt, challengeType } = options;
  const now = Date.now();
  let lastError: Error | null = null;

  // Circuit breaker state (module-scoped)
  interface CircuitBreaker {
    failures: number;
    openedUntil: number;
  }

  if (!(global as Record<string, unknown>)._groqCircuit) {
    (global as Record<string, unknown>)._groqCircuit = { failures: 0, openedUntil: 0 };
  }
  const cb = (global as Record<string, unknown>)._groqCircuit as CircuitBreaker;

  if (cb.openedUntil && cb.openedUntil > now) {
    throw new ModelUnavailableError('Model circuit breaker is open');
  }

  // Try with exponential backoff
  const maxRetries = GROQ_MAX_RETRIES();
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post(
        GROQ_API_URL,
        {
          model: selectModel(challengeType),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1024,
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

      // Log token usage and cache metrics for cost monitoring
      if (data.usage) {
        const cachedTokens = data.usage.prompt_tokens_details?.cached_tokens || 0;
        const cacheHitRate =
          data.usage.prompt_tokens > 0
            ? ((cachedTokens / data.usage.prompt_tokens) * 100).toFixed(1)
            : '0.0';

        logger.info('Groq token usage', {
          model: model_used,
          challengeType: challengeType || 'unknown',
          promptTokens: data.usage.prompt_tokens,
          cachedTokens,
          cacheHitRate: `${cacheHitRate}%`,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        });
      }

      // Reset circuit breaker on success
      cb.failures = 0;

      return { hint: hint.trim(), model_used };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Determine if error is retryable - only for non-retryable errors, we throw immediately
      if (!isRetryableError(lastError)) {
        handleNonRetryableError(lastError);
        throw createGroqError(lastError);
      }

      logger.warn(`Groq request failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`);

      // Exponential backoff with jitter (only for last retry)
      if (attempt < GROQ_MAX_RETRIES()) {
        const backoff = Math.min(GROQ_BACKOFF_BASE_MS() * 2 ** attempt, 5000);
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
      }
    }
  }

  // All retries failed - handle circuit breaker
  const finalError = lastError || new Error('Groq generate failed');
  handleAllRetriesFailed(finalError, cb);
  throw finalError;
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

function handleNonRetryableError(err: Error): void {
  logger.error(`Non-retryable Groq error: ${err.message}`);

  // Don't increment circuit breaker for non-retryable errors (authentication, bad request, etc.)
  // These are application/configuration issues, not service availability issues
}

function handleAllRetriesFailed(err: Error, cb: { failures: number; openedUntil: number }): void {
  logger.error(`All Groq retry attempts failed: ${err.message}`);

  // Increment failure count and possibly open circuit breaker
  cb.failures = (cb.failures || 0) + 1;
  if (cb.failures >= MODEL_CB_FAILURES) {
    cb.openedUntil = Date.now() + MODEL_CB_COOLDOWN_MS;
    cb.failures = 0;
    logger.warn(`Groq circuit breaker opened until ${new Date(cb.openedUntil).toISOString()}`);
  }
}

function createGroqError(err: Error): Error {
  if (err instanceof AxiosError) {
    const status = err.response?.status || 0;
    const isRetryable = isRetryableError(err);
    const message = `Groq API error (${status}): ${err.message}`;

    return new GroqApiError(message, status, isRetryable, err);
  }

  // For non-axios errors, check if they're retryable
  const isRetryable = isRetryableError(err);
  if (isRetryable) {
    return new GroqApiError(`Groq request error: ${err.message}`, 503, true, err);
  }

  return err;
}

export default generateFromGroq;
