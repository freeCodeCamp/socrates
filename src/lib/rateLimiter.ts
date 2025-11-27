import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';
import { PER_USER_LIMIT, GLOBAL_LIMIT } from '../config/env';
import { logger } from '../config/logger';
import fs from 'fs';
import path from 'path';

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
const LUA_TOKEN_BUCKET = fs.readFileSync(path.resolve(__dirname, 'lua', 'token_bucket.lua'), 'utf8');

let LUA_TOKEN_BUCKET_SHA: string | null = null;
// Try to load script automatically; if it fails we still proceed and fallback to eval
// Use any to avoid typing issues in types for script() - accept that ioredis has various overloads.
(redis as any).script('load', LUA_TOKEN_BUCKET).then((sha: string) => {
  LUA_TOKEN_BUCKET_SHA = sha;
  logger.info('Loaded rate-limiter script into Redis with SHA: ' + sha);
}).catch((err: any) => {
  logger.info('Could not pre-load Lua script into Redis; will fallback to EVAL: ' + (err?.message || err));
});

export function rateLimiterMiddleware(opts?: RateLimiterOptions) {
  const redisClient = opts?.redisClient || redis;
  const perUserCap = (opts?.perUserLimit || PER_USER_LIMIT);
  const globalCap = (opts?.globalLimit || GLOBAL_LIMIT);
  const perUserRate = tokensPerMs(perUserCap);
  const globalRate = tokensPerMs(globalCap);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = req.body?.userId || req.ip || 'anonymous';
      const now = nowMs();

      // Keys
      const userKey = `rate:user:${identifier}`;
      const globalKey = `rate:global`;
      const ttl = 3600; // seconds
      // Call Lua script atomically
      const args = [now, perUserCap, perUserRate, globalCap, globalRate, ttl];
      // First, try EVALSHA if we have a SHA; otherwise fallback to EVAL
      let evalResultRaw: unknown;
      if (LUA_TOKEN_BUCKET_SHA) {
        try {
          evalResultRaw = await (redisClient as any).evalsha(LUA_TOKEN_BUCKET_SHA, 2, userKey, globalKey, ...args);
        } catch (err: any) {
          // NOSCRIPT or other issues: fallback to EVAL
          logger.info('EVALSHA failed, falling back to EVAL: ' + (err?.message || err));
          evalResultRaw = await redisClient.eval(LUA_TOKEN_BUCKET, 2, userKey, globalKey, ...args);
        }
      } else {
        evalResultRaw = await redisClient.eval(LUA_TOKEN_BUCKET, 2, userKey, globalKey, ...args);
      }
      const evalResult = evalResultRaw as unknown as any[];
      // evalResult should be [userAllowed, userRemaining, globalAllowed, globalRemaining]
      const userAllowed = Number(evalResult[0]);
      const userRemaining = Math.floor(Number(evalResult[1]));
      const globalAllowed = Number(evalResult[2]);
      const globalRemaining = Math.floor(Number(evalResult[3]));

      if (userAllowed < 1) {
        res.set('Retry-After', '60');
        res.set('X-RateLimit-Limit', String(perUserCap));
        res.set('X-RateLimit-Remaining', String(userRemaining));
        return res.status(429).json({ message: 'Too many requests (per-user)' });
      }
      if (globalAllowed < 1) {
        res.set('Retry-After', '60');
        res.set('X-RateLimit-Limit', String(globalCap));
        res.set('X-RateLimit-Remaining', String(globalRemaining));
        return res.status(429).json({ message: 'Too many requests (global)' });
      }

      res.set('X-RateLimit-Limit', String(perUserCap));
      res.set('X-RateLimit-Remaining', String(userRemaining));

      return next();
    } catch (err: any) {
      logger.warn('Rate limiter encountered an error, allowing request: ' + (err?.message || err));
      // Allow request through if Redis or logic fails
      return next();
    }
  };
}

export default rateLimiterMiddleware;
