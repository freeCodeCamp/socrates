import pino from 'pino';
import { isProd, LOG_LEVEL } from './env.js';

const transport = isProd ? undefined : pino.transport({ target: 'pino-pretty' });

export const logger = pino({ level: LOG_LEVEL || 'info' }, transport);
