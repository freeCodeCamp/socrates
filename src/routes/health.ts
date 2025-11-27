import { Router, Request, Response } from 'express';
import { ENABLE_EXTENDED_HEALTH } from '../config/env';
import redisClient from '../config/redis';
import axios from 'axios';
import { OLLAMA_HOST } from '../config/env';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  if (!ENABLE_EXTENDED_HEALTH) return res.json({ status: 'ok', uptime: process.uptime() });

  Promise.all([
    (async () => {
      try {
        await redisClient.ping();
        return { redis: 'ok' };
      } catch (e: any) {
        return { redis: 'error', error: e?.message };
      }
    })(),
    (async () => {
      try {
        const r = await axios.get(`${OLLAMA_HOST}/api/version`, { timeout: 1000 });
        return { ollama: 'ok', version: r.data };
      } catch (e: any) {
        return { ollama: 'error', error: e?.message };
      }
    })()
  ]).then((results) => {
    const data = { status: 'ok', uptime: process.uptime(), checks: results };
    res.json(data);
  });
});

export default router;
