import Fastify from 'fastify';
import { channels, type Channel } from '../domain/notification.js';
import { IdempotencyConflict } from '../store/memory-store.js';
import { NotificationOrchestrator } from '../service/orchestrator.js';

export function buildApp(orchestrator: NotificationOrchestrator) {
  const app = Fastify({ logger: true });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.post<{ Body: { channel?: Channel; recipient?: string; template?: string; data?: Record<string, unknown> }; Headers: { 'x-tenant-id'?: string; 'idempotency-key'?: string } }>('/v1/notifications', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'];
    const idempotencyKey = request.headers['idempotency-key'];
    const body = request.body ?? {};
    if (!tenantId || !idempotencyKey || !body.channel || !channels.includes(body.channel) || !body.recipient || !body.template) {
      return reply.code(400).send({ error: 'x-tenant-id, idempotency-key, channel, recipient and template are required' });
    }
    try {
      const result = orchestrator.create({ tenantId, idempotencyKey, channel: body.channel, recipient: body.recipient, template: body.template, data: body.data ?? {} });
      if (!result.duplicate) void orchestrator.deliver(result.notification.id);
      return reply.code(result.duplicate ? 200 : 202).send(result.notification);
    } catch (error) {
      if (error instanceof IdempotencyConflict) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });

  app.get<{ Params: { id: string } }>('/v1/notifications/:id', async (request, reply) => {
    const notification = orchestrator.get(request.params.id);
    if (!notification) return reply.code(404).send({ error: 'notification not found' });
    return notification;
  });

  return app;
}
