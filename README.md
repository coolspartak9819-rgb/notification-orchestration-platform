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
