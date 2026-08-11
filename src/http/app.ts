import Fastify from 'fastify';
import { channels, type Channel, type NotificationStatus } from '../domain/notification.js';
import { IdempotencyConflict } from '../store/memory-store.js';
import { NotificationOrchestrator } from '../service/orchestrator.js';
import { TenantRateLimiter } from '../service/rate-limiter.js';

export function buildApp(orchestrator: NotificationOrchestrator, rateLimiter = new TenantRateLimiter(100, 60_000)) {
  const app = Fastify({ logger: true });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/metrics', async (_request, reply) => {
    const metrics = orchestrator.getMetrics();
    const lines = Object.entries(metrics).map(([name, value]) => `notification_${name}_total ${value}`);
    return reply.type('text/plain').send(`${lines.join('\n')}\n`);
  });

  app.get<{ Querystring: { status?: NotificationStatus; limit?: string }; Headers: { 'x-tenant-id'?: string } }>('/v1/notifications', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId) return reply.code(400).send({ error: 'x-tenant-id is required' });
    return { items: await orchestrator.list({ tenantId, status: request.query.status, limit: Number(request.query.limit ?? 50) }) };
  });

  app.post<{ Body: { channel?: Channel; recipient?: string; template?: string; data?: Record<string, unknown> }; Headers: { 'x-tenant-id'?: string; 'idempotency-key'?: string } }>('/v1/notifications', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'];
    const idempotencyKey = request.headers['idempotency-key'];
    const body = request.body ?? {};
    if (!tenantId || !idempotencyKey || !body.channel || !channels.includes(body.channel) || !body.recipient || !body.template) {
      return reply.code(400).send({ error: 'x-tenant-id, idempotency-key, channel, recipient and template are required' });
    }
    if (!rateLimiter.allow(tenantId)) return reply.code(429).send({ error: 'tenant rate limit exceeded' });
    try {
      const result = await orchestrator.create({ tenantId, idempotencyKey, channel: body.channel, recipient: body.recipient, template: body.template, data: body.data ?? {} });
      if (!result.duplicate) void orchestrator.deliver(result.notification.id);
      return reply.code(result.duplicate ? 200 : 202).send(result.notification);
    } catch (error) {
      if (error instanceof IdempotencyConflict) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>('/v1/notifications/:id', async (request, reply) => {
    const notification = await orchestrator.get(request.params.id);
    if (!notification) return reply.code(404).send({ error: 'notification not found' });
    return notification;
  });

  return app;
}
