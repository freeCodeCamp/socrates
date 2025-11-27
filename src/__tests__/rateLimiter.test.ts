import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bodyParser from 'body-parser';
import rateLimiter from '../lib/rateLimiter';

// Use a fake Redis-like in-memory store for tests
class FakeRedis {
  store: Record<string, Record<string, any>> = {};
  async hgetall(key: string) {
    const val = this.store[key];
    if (!val) return {};
    return val;
  }
  async hset(key: string, ...args: string[]) {
    if (!this.store[key]) this.store[key] = {} as any;
    for (let i = 0; i < args.length; i += 2) {
      this.store[key][args[i]] = args[i + 1];
    }
  }
  async expire(key: string, ttl: number) {
    // ignore TTL for fake redis
    return 1;
  }
  // Provide eval to run the Lua logic, recreated in JS for tests
  async eval(script: string, numKeys: number, ...args: any[]) {
    // keys
    const keys = args.slice(0, numKeys);
    const argv = args.slice(numKeys);
    const now = Number(argv[0]);
    const perUserCap = Number(argv[1]);
    const perUserRate = Number(argv[2]);
    const globalCap = Number(argv[3]);
    const globalRate = Number(argv[4]);
    const ttl = Number(argv[5]);

    const [userKey, globalKey] = keys;

    const getBucket = (key: string, cap: number) => {
      const obj = this.store[key] || {};
      const tokens = obj.tokens !== undefined ? Number(obj.tokens) : cap;
      const last = obj.last !== undefined ? Number(obj.last) : now;
      return { tokens, last };
    };

    const setBucket = (key: string, tokens: number, last: number) => {
      this.store[key] = { tokens: String(tokens), last: String(last) } as any;
    };

    const user = getBucket(userKey, perUserCap);
    const userRefill = Math.min(perUserCap, user.tokens + (now - user.last) * perUserRate);
    let userAllowed = 0;
    let userRemaining = userRefill;
    if (userRefill >= 1) {
      userRemaining = userRefill - 1;
      userAllowed = 1;
    }
    setBucket(userKey, userRemaining, now);

    const global = getBucket(globalKey, globalCap);
    const gRefill = Math.min(globalCap, global.tokens + (now - global.last) * globalRate);
    let globalAllowed = 0;
    let globalRemaining = gRefill;
    if (gRefill >= 1) {
      globalRemaining = gRefill - 1;
      globalAllowed = 1;
    }
    setBucket(globalKey, globalRemaining, now);

    return [userAllowed, String(userRemaining), globalAllowed, String(globalRemaining)];
  }
  async script(cmd: string, script: string) {
    // store script under a simple sha (just length + time for tests)
    const sha = 'sha:' + Math.abs(script.length + Date.now()).toString();
    // map sha->script not used further in fake, but helpful if evalsha invoked with the string
    this.store['__scripts__'] = this.store['__scripts__'] || {} as any;
    (this.store['__scripts__'] as any)[sha] = script;
    return sha;
  }
  async evalsha(sha: string, numKeys: number, ...args: any[]) {
    // Just call eval with same args; verify script exists
    if (!this.store['__scripts__'] || !(this.store['__scripts__'] as any)[sha]) {
      throw new Error('NOSCRIPT No matching script. Please use EVAL.');
    }
    // call eval with same behavior
    return this.eval((this.store['__scripts__'] as any)[sha], numKeys, ...args);
  }
}

describe('rateLimiter', () => {
  let app: express.Express;
  let redisClient: any;

  beforeEach(() => {
    app = express();
    app.use(bodyParser.json());
    redisClient = new FakeRedis();
    // bind to /hint with per-user cap 3/min and global 10/min for tests
    app.post('/hint', rateLimiter({ redisClient, perUserLimit: 3, globalLimit: 10 }), (req, res) => res.json({ ok: true }));
  });

  it('allows requests up to per-user limit then blocks', async () => {
    // same user sends 4 requests
    const user = 'userA';

    for (let i = 0; i < 3; i++) {
      await request(app).post('/hint').send({ userId: user }).expect(200);
    }

    const r = await request(app).post('/hint').send({ userId: user }).expect(429);
    expect(r.body.message).toContain('Too many requests');
  });

  it('applies global limit across users', async () => {
    // 5 users, global limit 4: 4 allowed, 5th should be 429
    const redisClient2 = new FakeRedis();
    app = express();
    app.use(bodyParser.json());
    app.post('/hint', rateLimiter({ redisClient: redisClient2 as any, perUserLimit: 10, globalLimit: 4 }), (req, res) => res.json({ ok: true }));

    for (let i = 0; i < 4; i++) {
      await request(app).post('/hint').send({ userId: `u${i}` }).expect(200);
    }
    const r = await request(app).post('/hint').send({ userId: 'uX' }).expect(429);
    expect(r.body.message).toContain('Too many requests');
  });
});
