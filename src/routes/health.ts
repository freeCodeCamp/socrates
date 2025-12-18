import axios from 'axios';
import { type Request, type Response, Router } from 'express';
import { ENABLE_EXTENDED_HEALTH, GROQ_API_KEY } from '../config/env';
import redisClient from '../config/redis';

const router: Router = Router();

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
        const r = await axios.get('https://api.groq.com/openai/v1/models', {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          timeout: 5000,
        });
        return { groq: 'ok', models_count: r.data?.data?.length || 0 };
      } catch (e: any) {
        return { groq: 'error', error: e?.message };
      }
    })(),
  ]).then((results) => {
    const data = { status: 'ok', uptime: process.uptime(), checks: results };
    res.json(data);
  });
});

export default router;
