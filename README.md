# Notification Orchestration Platform

Node.js 22 and TypeScript service for reliable multi-tenant notifications across email, SMS and push channels.

The project models a real operational problem: a notification request must be accepted once, delivered through a provider, retried after an outage and switched to a fallback provider when the primary provider is unavailable.

## Current slice

- Fastify HTTP API;
- tenant-scoped idempotency;
- notification status tracking;
- primary and fallback provider abstraction;
- retryable state after provider failure;
- exponential retry backoff with a configurable attempt limit;
- dead-letter state after exhausted delivery attempts;
- provider exception isolation and last failure details;
- Prometheus-compatible `/metrics` endpoint;
- tenant-scoped notification listing with status filters;
- tenant request rate limiting with `429` responses;
- storage port plus a PostgreSQL adapter and migration for durable state;
- Docker image and local Compose setup;
- strict TypeScript and tests for the main correctness rules.

## Run

```bash
npm install
npm test
npm run check
npm run dev
```

Or run the container:

```bash
docker compose up --build
```

The API listens on `http://localhost:8080`. `GET /healthz` is a liveness check and
`GET /metrics` exposes delivery counters. Retry behaviour is controlled by
`MAX_ATTEMPTS` and `RETRY_BASE_MS`.

List a tenant's notifications with `GET /v1/notifications` and the required
`X-Tenant-ID` header. Optional query parameters are `status` and `limit`.
The in-memory rate limiter defaults to 100 requests per tenant per minute for
the local demo; a distributed deployment should replace it with Redis.

`src/store/postgres-store.ts` contains the durable repository adapter and
`migrations/001_notifications.sql` creates its schema. The demo entrypoint
uses memory storage when `DATABASE_URL` is absent. Set `DATABASE_URL` to switch
the same API to PostgreSQL; the Compose setup does this automatically.

Create a notification:

```bash
curl -X POST http://localhost:8080/v1/notifications \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-ID: shop-1' \
  -H 'Idempotency-Key: order-123-confirmation' \
  -d '{"channel":"email","recipient":"user@example.com","template":"order-confirmed","data":{"orderId":"order-123"}}'
```

## Roadmap

PostgreSQL will store notification state and templates, Redis will provide queues and tenant rate limits, and NATS JetStream will carry delivery events. Later slices will add provider webhooks, OpenTelemetry tracing, durable queue consumers, Kubernetes manifests and a load scenario for multi-tenant traffic.
