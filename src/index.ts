import { buildApp } from './http/app.js';
import { MockProvider, NotificationOrchestrator } from './service/orchestrator.js';
import { MemoryNotificationStore } from './store/memory-store.js';

const store = new MemoryNotificationStore();
const orchestrator = new NotificationOrchestrator(store, [new MockProvider('primary-email')], {
  maxAttempts: Number(process.env.MAX_ATTEMPTS ?? 3),
  retryBaseMs: Number(process.env.RETRY_BASE_MS ?? 250),
});
const app = buildApp(orchestrator);
const port = Number(process.env.PORT ?? 8080);

await app.listen({ host: '0.0.0.0', port });
