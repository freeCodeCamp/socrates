import { format, createLogger, transports } from 'winston';
import { LOG_LEVEL } from './env';

const { combine, timestamp, printf, colorize } = format;

const devFormat = printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`);

export const logger = createLogger({
  level: LOG_LEVEL || 'info',
  format: combine(timestamp(), devFormat),
  transports: [new transports.Console({ format: combine(colorize(), devFormat) })]
});
