# Notification Orchestration Platform

Node.js 22 and TypeScript service for reliable multi-tenant notifications across email, SMS and push channels.

The project models a real operational problem: a notification request must be accepted once, delivered through a provider, retried after an outage and switched to a fallback provider when the primary provider is unavailable.

## Current slice

- Fastify HTTP API;
- tenant-scoped idempotency;
- notification status tracking;
- primary and fallback provider abstraction;
- retryable state after provider failure;
- strict TypeScript and tests for the main correctness rules.

## Run

```bash
npm install
npm test
npm run check
npm run dev
```

Create a notification:

```bash
curl -X POST http://localhost:8080/v1/notifications \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-ID: shop-1' \
  -H 'Idempotency-Key: order-123-confirmation' \
  -d '{"channel":"email","recipient":"user@example.com","template":"order-confirmed","data":{"orderId":"order-123"}}'
```

## Roadmap

PostgreSQL will store notification state and templates, Redis will provide queues and tenant rate limits, and NATS JetStream will carry delivery events. The later slices will add provider webhooks, exponential retry with DLQ, OpenTelemetry, Prometheus, Docker, Kubernetes and a load scenario for multi-tenant traffic.
