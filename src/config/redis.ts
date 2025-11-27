import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(REDIS_URL, { enableAutoPipelining: true });

redisClient.on('error', (err) => logger.warn('Redis error: ' + (err?.message || err)));
redisClient.on('connect', () => logger.info('Connected to Redis'));

export default redisClient;
