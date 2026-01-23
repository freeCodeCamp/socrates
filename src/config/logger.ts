import { createLogger, format, transports } from 'winston';
import { LOG_LEVEL } from './env';

const { combine, timestamp, printf, colorize } = format;

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}: ${message}${metaStr}`;
});

export const logger = createLogger({
  level: LOG_LEVEL || 'info',
  format: combine(timestamp(), devFormat),
  transports: [new transports.Console({ format: combine(colorize(), devFormat) })],
});
