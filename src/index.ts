import { buildApp } from './http/app.js';
import { MockProvider, NotificationOrchestrator } from './service/orchestrator.js';
import { MemoryNotificationStore } from './store/memory-store.js';
import { PostgresNotificationStore } from './store/postgres-store.js';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { connect } from '@nats-io/transport-node';
import { NatsDeliveryEventPublisher } from './infra/nats-publisher.js';
import { NoopDeliveryEventPublisher } from './service/event-publisher.js';
import { RedisTenantRateLimiter, TenantRateLimiter } from './service/rate-limiter.js';

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : undefined;
const store = pool ? new PostgresNotificationStore(pool) : new MemoryNotificationStore();
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : undefined;
const nats = process.env.NATS_URL ? await connect({ servers: process.env.NATS_URL }) : undefined;
const eventPublisher = nats ? new NatsDeliveryEventPublisher(nats) : new NoopDeliveryEventPublisher();
const orchestrator = new NotificationOrchestrator(store, [new MockProvider('primary-email')], {
  maxAttempts: Number(process.env.MAX_ATTEMPTS ?? 3),
  retryBaseMs: Number(process.env.RETRY_BASE_MS ?? 250),
}, eventPublisher);
const rateLimiter = redis ? new RedisTenantRateLimiter(redis, 100, 60_000) : new TenantRateLimiter(100, 60_000);
const readiness = async () => {
  try {
    if (pool) await pool.query('SELECT 1');
    if (redis && (await redis.ping()) !== 'PONG') return false;
    if (nats) await nats.flush();
    return true;
  } catch {
    return false;
  }
};
const app = buildApp(orchestrator, rateLimiter, readiness);
const port = Number(process.env.PORT ?? 8080);

await app.listen({ host: '0.0.0.0', port });

const shutdown = async () => {
  await app.close();
  await pool?.end();
  await redis?.quit();
  await nats?.drain();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
