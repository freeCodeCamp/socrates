import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import bodyParser from 'body-parser';
import { PORT } from './config/env';
import healthRouter from './routes/health';
import { requestLogger } from './middleware/logger';

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestLogger);

// Routes
app.use('/health', healthRouter);

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'thelibrarian API - ready', description: 'Visit /health for status' });
});

// Not found
app.use((_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
