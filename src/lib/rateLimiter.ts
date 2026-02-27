import fs from 'node:fs';
import path from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { GLOBAL_LIMIT, PER_USER_LIMIT } from '../config/env';
import { logger } from '../config/logger';
import redis from '../config/redis';
import type { RawRequestBody } from '../types/sanitizer';

export interface RateLimiterOptions {
  redisClient?: typeof redis;
  perUserLimit?: number; // requests per minute
  globalLimit?: number; // requests per minute
}

function nowMs() {
  return Date.now();
}

// Convert minute rate to tokens/ms and capacity
function tokensPerMs(limitPerMin: number) {
  return limitPerMin / 60000; // tokens per ms
}

// The LUA script performs atomic token-bucket checks and updates for user and global buckets.
const LUA_TOKEN_BUCKET = fs.readFileSync(
  path.resolve(__dirname, 'lua', 'token_bucket.lua'),
  'utf8',
);

let LUA_TOKEN_BUCKET_SHA: string | null = null;
// Try to load script automatically; if it fails we still proceed and fallback to eval
(redis as unknown as { script: (cmd: string, lua: string) => Promise<string> })
  .script('load', LUA_TOKEN_BUCKET)
  .then((sha: string) => {
    LUA_TOKEN_BUCKET_SHA = sha;
    logger.info(`Loaded rate-limiter script into Redis with SHA: ${sha}`);
  })
  .catch((err: unknown) => {
    logger.info(
      `Could not pre-load Lua script into Redis; will fallback to EVAL: ${err instanceof Error ? err.message : String(err)}`,
    );
  });

export function rateLimiterHook(opts?: RateLimiterOptions) {
  const redisClient = opts?.redisClient || redis;
  const perUserCap = opts?.perUserLimit || PER_USER_LIMIT;
  const globalCap = opts?.globalLimit || GLOBAL_LIMIT;
  const perUserRate = tokensPerMs(perUserCap);
  const globalRate = tokensPerMs(globalCap);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as RawRequestBody | undefined;
      const identifier = body?.userId || request.ip || 'anonymous';
      const now = nowMs();

      // Keys
      const userKey = `rate:user:${identifier}`;
      const globalKey = 'rate:global';
      const ttl = 3600; // seconds
      // Call Lua script atomically
      const args = [now, perUserCap, perUserRate, globalCap, globalRate, ttl];
      // First, try EVALSHA if we have a SHA; otherwise fallback to EVAL
      let evalResultRaw: unknown;
      const stringArgs = args.map(String);
      if (LUA_TOKEN_BUCKET_SHA) {
        try {
          evalResultRaw = await redisClient.call(
            'EVALSHA',
            LUA_TOKEN_BUCKET_SHA,
            '2',
            userKey,
            globalKey,
            ...stringArgs,
          );
        } catch (err: unknown) {
          logger.info(
            `EVALSHA failed, falling back to EVAL: ${err instanceof Error ? err.message : String(err)}`,
          );
          evalResultRaw = await redisClient.call(
            'EVAL',
            LUA_TOKEN_BUCKET,
            '2',
            userKey,
            globalKey,
            ...stringArgs,
          );
        }
      } else {
        evalResultRaw = await redisClient.call(
          'EVAL',
          LUA_TOKEN_BUCKET,
          '2',
          userKey,
          globalKey,
          ...stringArgs,
        );
      }
      const evalResult = evalResultRaw as [number, number, number, number];
      // evalResult should be [userAllowed, userRemaining, globalAllowed, globalRemaining]
      const userAllowed = Number(evalResult[0]);
      const userRemaining = Math.floor(Number(evalResult[1]));
      const globalAllowed = Number(evalResult[2]);
      const globalRemaining = Math.floor(Number(evalResult[3]));

      if (userAllowed < 1) {
        reply.header('Retry-After', '60');
        reply.header('X-RateLimit-Limit', String(perUserCap));
        reply.header('X-RateLimit-Remaining', String(userRemaining));
        return reply.status(429).send({ message: 'Too many requests (per-user)' });
      }
      if (globalAllowed < 1) {
        reply.header('Retry-After', '60');
        reply.header('X-RateLimit-Limit', String(globalCap));
        reply.header('X-RateLimit-Remaining', String(globalRemaining));
        return reply.status(429).send({ message: 'Too many requests (global)' });
      }

      reply.header('X-RateLimit-Limit', String(perUserCap));
      reply.header('X-RateLimit-Remaining', String(userRemaining));
    } catch (err: unknown) {
      logger.warn(
        `Rate limiter encountered an error, allowing request: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Allow request through if Redis or logic fails
    }
  };
}

export default rateLimiterHook;
