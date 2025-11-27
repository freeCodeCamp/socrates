import axios from 'axios';
import {
  OLLAMA_HOST,
  OLLAMA_MODEL,
  OLLAMA_TIMEOUT_MS,
  OLLAMA_MAX_RETRIES,
  OLLAMA_BACKOFF_BASE_MS,
  MODEL_CB_FAILURES,
  MODEL_CB_COOLDOWN_MS
} from '../config/env';
import { logger } from '../config/logger';
import { ModelUnavailableError } from '../errors/modelUnavailableError';

export interface OllamaResponse {
  hint: string;
  model_used?: string;
  [key: string]: any;
}

export async function generateFromOllama(prompt: string): Promise<OllamaResponse> {
  const url = `${OLLAMA_HOST}/api/generate`;
  let attempt = 0;
  let lastErr: any;
  const now = Date.now();
  // Circuit breaker state (module-scoped)
  if (!(global as any)._ollamaCircuit) (global as any)._ollamaCircuit = { failures: 0, openedUntil: 0 };
  const cb = (global as any)._ollamaCircuit as { failures: number; openedUntil: number };
  if (cb.openedUntil && cb.openedUntil > now) {
    // circuit is open
    throw new ModelUnavailableError('Model circuit breaker is open');
  }

  while (attempt <= OLLAMA_MAX_RETRIES) {
    try {
      const res = await axios.post(
        url,
        {
          model: OLLAMA_MODEL,
          prompt
        },
        {
          timeout: OLLAMA_TIMEOUT_MS
        }
      );

      // Ollama's response shape may include `choices` or plain text; try common fields
      const data = res.data || {};
      let hint = '';
      if (typeof data === 'string') hint = data;
      else if (data.output?.[0]?.content) hint = data.output[0].content;
      else if (data.choices && data.choices[0] && data.choices[0].message) hint = data.choices[0].message.content;
      else if (data.text) hint = data.text;
      else hint = JSON.stringify(data).slice(0, 1000);

      const model_used = data.model || OLLAMA_MODEL;

      return { hint: hint.trim(), model_used };
    } catch (err: any) {
      lastErr = err;
      attempt++;
      logger.warn(`Ollama request failed (attempt ${attempt}): ${err?.message || err}`);
      // Exponential backoff with jitter
      const backoff = Math.min(OLLAMA_BACKOFF_BASE_MS * 2 ** attempt, 5000);
      const jitter = Math.floor(Math.random() * 200);
      await new Promise(res => setTimeout(res, backoff + jitter));
    }
  }

  logger.error(`Ollama generate attempts failed: ${lastErr?.message || lastErr}`);
  // Increment failure count and possibly open circuit
  cb.failures = (cb.failures || 0) + 1;
  if (cb.failures >= MODEL_CB_FAILURES) {
    cb.openedUntil = Date.now() + MODEL_CB_COOLDOWN_MS;
    cb.failures = 0; // reset failures after open
    logger.warn(`Ollama circuit breaker opened until ${new Date(cb.openedUntil).toISOString()}`);
  }
  throw lastErr || new ModelUnavailableError('Ollama generate failed');
}

export default generateFromOllama;
