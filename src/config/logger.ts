import pino from 'pino';
import { isProd, LOG_LEVEL } from './env';

const transport = isProd ? undefined : pino.transport({ target: 'pino-pretty' });

export const logger = pino({ level: LOG_LEVEL || 'info' }, transport);
