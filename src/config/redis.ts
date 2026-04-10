import Redis from 'ioredis';
import { REDIS_URL } from './env';
import { rootLogger } from './logger';

export const redisClient = new Redis(REDIS_URL, { enableAutoPipelining: true });

redisClient.on('error', (err) => rootLogger.warn({ err }, 'redis error'));
redisClient.on('connect', () => rootLogger.info('connected to redis'));

export default redisClient;
