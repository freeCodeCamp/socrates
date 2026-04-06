import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isProd = NODE_ENV === 'production';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
export const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
export const GROQ_TIMEOUT_MS = () =>
  process.env.GROQ_TIMEOUT_MS ? Number(process.env.GROQ_TIMEOUT_MS) : 30000;
export const GROQ_BACKOFF_BASE_MS = () =>
  process.env.GROQ_BACKOFF_BASE_MS ? Number(process.env.GROQ_BACKOFF_BASE_MS) : 500;
export const GROQ_MAX_RETRIES = () =>
  process.env.GROQ_MAX_RETRIES ? Number(process.env.GROQ_MAX_RETRIES) : 2;
export const GROQ_MAX_TOKENS = () =>
  process.env.GROQ_MAX_TOKENS ? Number(process.env.GROQ_MAX_TOKENS) : 1024;
export const GROQ_MAX_TOKENS_RETRY = () =>
  process.env.GROQ_MAX_TOKENS_RETRY ? Number(process.env.GROQ_MAX_TOKENS_RETRY) : 2048;
export const GROQ_EMPTY_RESPONSE_RETRIES = () =>
  process.env.GROQ_EMPTY_RESPONSE_RETRIES ? Number(process.env.GROQ_EMPTY_RESPONSE_RETRIES) : 1;
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const PER_USER_LIMIT = process.env.PER_USER_LIMIT ? Number(process.env.PER_USER_LIMIT) : 10; // requests per minute
export const GLOBAL_LIMIT = process.env.GLOBAL_LIMIT ? Number(process.env.GLOBAL_LIMIT) : 1000; // requests per minute
export const MODEL_CB_FAILURES = process.env.MODEL_CB_FAILURES
  ? Number(process.env.MODEL_CB_FAILURES)
  : 3; // failures before open
export const MODEL_CB_COOLDOWN_MS = process.env.MODEL_CB_COOLDOWN_MS
  ? Number(process.env.MODEL_CB_COOLDOWN_MS)
  : 30000; // cooldown
export const ENABLE_EXTENDED_HEALTH = process.env.ENABLE_EXTENDED_HEALTH === 'true';
export const API_KEY = process.env.API_KEY || '';
export const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
export const BUILD_VERSION = process.env.BUILD_VERSION || 'unknown';

// Validate required environment variables
if (!API_KEY) {
  throw new Error('API_KEY environment variable is required');
}
if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY environment variable is required');
}
