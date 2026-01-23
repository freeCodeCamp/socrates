import * as bodyParser from 'body-parser';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { ALLOWED_ORIGINS, NODE_ENV, PORT } from './config/env';
import { logger } from './config/logger';
import swaggerSpec from './config/swagger';
import rateLimiter from './lib/rateLimiter';
import docsAuthMiddleware from './middleware/docsAuth';
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

// Swagger UI - disable CSP for this route to allow inline styles/scripts
app.use('/api-docs', docsAuthMiddleware);
app.use('/api-docs', (_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
});
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Socrates API Docs',
  }),
);

// OpenAPI JSON spec endpoint
app.get('/api-docs.json', docsAuthMiddleware, (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.use('/health', healthRouter);
// Rate-limit the /hint endpoint per user and globally
app.use('/hint', rateLimiter(), hintRouter);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'socrates API - ready',
    description: 'Visit /health for status',
    docs: '/api-docs',
  });
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
