import * as bodyParser from 'body-parser';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import { ALLOWED_ORIGINS, NODE_ENV, PORT } from './config/env';
import { logger } from './config/logger';
import rateLimiter from './lib/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger, simpleLogger } from './middleware/logger';
import healthRouter from './routes/health';
import hintRouter from './routes/hint';

const app: Application = express();

// Middleware
app.use(helmet());
// Configure CORS to be limited to ALLOWED_ORIGINS env. Default '*' (dev)
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server or curl
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin))
      return callback(null, true);
    callback(new Error('CORS: origin not allowed'));
  },
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(simpleLogger);

// Routes
app.use('/health', healthRouter);
// Rate-limit the /hint endpoint per user and globally
app.use('/hint', rateLimiter(), hintRouter);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'thelibrarian API - ready', description: 'Visit /health for status' });
});

// Not found
app.use((_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
app.use(errorHandler);

// Graceful shutdown and error events
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err}`);
  process.exit(1);
});

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT} in ${NODE_ENV} mode`);
});
