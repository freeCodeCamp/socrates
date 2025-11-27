import axios from 'axios';
import { OLLAMA_HOST, OLLAMA_MODEL, OLLAMA_TIMEOUT_MS, OLLAMA_MAX_RETRIES, OLLAMA_BACKOFF_BASE_MS } from '../config/env';
import { logger } from '../config/logger';

export interface OllamaResponse {
  hint: string;
  model_used?: string;
  [key: string]: any;
}

export async function generateFromOllama(prompt: string): Promise<OllamaResponse> {
  const url = `${OLLAMA_HOST}/api/generate`;
  let attempt = 0;
  let lastErr: any;

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
  throw lastErr || new Error('Ollama generate failed');
}

export default generateFromOllama;
