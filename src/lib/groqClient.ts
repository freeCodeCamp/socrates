import axios from 'axios';
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
import { SYSTEM_PROMPT } from '../config/prompts';
import { ModelUnavailableError } from '../errors/modelUnavailableError';

export interface GroqResponse {
  hint: string;
  model_used?: string;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function generateFromGroq(userPrompt: string): Promise<GroqResponse> {
  let attempt = 0;
  let lastErr: any;
  const now = Date.now();

  // Circuit breaker state (module-scoped)
  if (!(global as any)._groqCircuit) {
    (global as any)._groqCircuit = { failures: 0, openedUntil: 0 };
  }
  const cb = (global as any)._groqCircuit as { failures: number; openedUntil: number };

  if (cb.openedUntil && cb.openedUntil > now) {
    throw new ModelUnavailableError('Model circuit breaker is open');
  }

  while (attempt <= GROQ_MAX_RETRIES) {
    try {
      const res = await axios.post(
        GROQ_API_URL,
        {
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: GROQ_TIMEOUT_MS,
        },
      );

      const data = res.data;
      const hint = data.choices?.[0]?.message?.content || '';
      const model_used = data.model || GROQ_MODEL;

      // Reset circuit breaker on success
      cb.failures = 0;

      return { hint: hint.trim(), model_used };
    } catch (err: any) {
      lastErr = err;
      attempt++;
      logger.warn(`Groq request failed (attempt ${attempt}): ${err?.message || err}`);

      // Exponential backoff with jitter
      const backoff = Math.min(GROQ_BACKOFF_BASE_MS * 2 ** attempt, 5000);
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
    }
  }

  logger.error(`Groq generate attempts failed: ${lastErr?.message || lastErr}`);

  // Increment failure count and possibly open circuit
  cb.failures = (cb.failures || 0) + 1;
  if (cb.failures >= MODEL_CB_FAILURES) {
    cb.openedUntil = Date.now() + MODEL_CB_COOLDOWN_MS;
    cb.failures = 0;
    logger.warn(`Groq circuit breaker opened until ${new Date(cb.openedUntil).toISOString()}`);
  }

  throw lastErr || new ModelUnavailableError('Groq generate failed');
}

export default generateFromGroq;
