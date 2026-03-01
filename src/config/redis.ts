import Redis from 'ioredis';
import { REDIS_URL } from './env';
import { logger } from './logger';

export const redisClient = new Redis(REDIS_URL, { enableAutoPipelining: true });

redisClient.on('error', (err) => logger.warn(`Redis error: ${err?.message || err}`));
redisClient.on('connect', () => logger.info('Connected to Redis'));

export default redisClient;
