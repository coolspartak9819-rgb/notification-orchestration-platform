import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockProvider, NotificationOrchestrator } from '../src/service/orchestrator.js';
import { MemoryNotificationStore, IdempotencyConflict } from '../src/store/memory-store.js';
import { buildApp } from '../src/http/app.js';

const input = { tenantId: 'tenant-a', idempotencyKey: 'order-1', channel: 'email' as const, recipient: 'user@example.com', template: 'order-confirmed', data: { orderId: 'ord-1' } };

test('same idempotency key returns the original notification', () => {
  const service = new NotificationOrchestrator(new MemoryNotificationStore(), [new MockProvider('email')]);
  const first = service.create(input);
  const second = service.create(input);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(first.notification.id, second.notification.id);
});

test('reusing an idempotency key with different data is rejected', () => {
  const service = new NotificationOrchestrator(new MemoryNotificationStore(), [new MockProvider('email')]);
  service.create(input);
  assert.throws(() => service.create({ ...input, recipient: 'other@example.com' }), IdempotencyConflict);
});

test('provider failure moves notification to retrying', async () => {
  const service = new NotificationOrchestrator(new MemoryNotificationStore(), [new MockProvider('primary', true), new MockProvider('fallback', true)]);
  const created = service.create(input).notification;
  const result = await service.deliver(created.id);
  assert.equal(result.status, 'retrying');
  assert.equal(result.attempts, 1);
});

test('fallback provider can accept after primary failure', async () => {
  const service = new NotificationOrchestrator(new MemoryNotificationStore(), [new MockProvider('primary', true), new MockProvider('fallback')]);
  const created = service.create(input).notification;
  const result = await service.deliver(created.id);
  assert.equal(result.status, 'sent');
});

test('duplicate HTTP request does not launch another delivery', async () => {
  let deliveries = 0;
  const provider = { name: 'email', async send() { deliveries += 1; return { accepted: true, provider: 'email' }; } };
  const app = buildApp(new NotificationOrchestrator(new MemoryNotificationStore(), [provider]));
  const headers = { 'x-tenant-id': input.tenantId, 'idempotency-key': input.idempotencyKey };
  const request = { method: 'POST' as const, url: '/v1/notifications', headers, payload: input };
  await app.inject(request);
  await new Promise((resolve) => setImmediate(resolve));
  const duplicate = await app.inject(request);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(duplicate.statusCode, 200);
  assert.equal(deliveries, 1);
  await app.close();
});
