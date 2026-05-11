import Redis from 'ioredis';
import { REDIS_URL } from './env';
import { rootLogger } from './logger';

export function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number): number | void {
      // Exponential backoff: 2^times * 100ms, capped at 30s.
      // The default linear strategy (Math.min(times * 50, 2000))
      // produces ~40 reconnection attempts/min indefinitely during
      // an outage.  This caps at dozens/hour, dramatically reducing
      // both log noise and Sentry events from OpenTelemetry spans.
      const delay = Math.min(Math.pow(2, times) * 100, 30_000);
      rootLogger.warn({ attempt: times, delayMs: delay }, 'redis reconnecting');
      return delay;
    },
  });

  client.on('error', (err) => {
    rootLogger.warn({ err }, 'redis error');
  });
  client.on('connect', () => rootLogger.info('connected to redis'));

  return client;
}
