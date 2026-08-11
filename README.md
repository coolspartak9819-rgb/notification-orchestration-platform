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
- tenant isolation on notification detail reads;
- Kubernetes-friendly liveness (`/healthz`) and readiness (`/readyz`) probes;
- Resend email and Twilio SMS HTTP providers;
- a configurable concurrent load scenario;
- Kubernetes Deployment, Service, HPA, ConfigMap and Secret templates;
- tenant request rate limiting with `429` responses;
- storage port plus a PostgreSQL adapter and migration for durable state;
- optional Redis-backed rate limiting;
- optional NATS JetStream delivery event publisher;
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
`GET /readyz` returns `503` while configured PostgreSQL, Redis or NATS
dependencies are unavailable.

Set `RESEND_API_KEY` and `RESEND_FROM` to enable real email delivery, or
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` for SMS. Without
provider credentials the service uses a mock provider for local development.

Run a local load scenario against a running API:

```bash
TOTAL=1000 CONCURRENCY=50 npm run load
```

Kubernetes templates are in `k8s/`. Copy `secret.example.yaml` to a protected
Secret workflow and replace the placeholder image with the image built by CI.

List a tenant's notifications with `GET /v1/notifications` and the required
`X-Tenant-ID` header. Optional query parameters are `status` and `limit`.
The in-memory rate limiter defaults to 100 requests per tenant per minute for
the local demo; a distributed deployment should replace it with Redis.

`src/store/postgres-store.ts` contains the durable repository adapter and
`migrations/001_notifications.sql` creates its schema. The demo entrypoint
uses memory storage when `DATABASE_URL` is absent. Set `DATABASE_URL` to switch
the same API to PostgreSQL; the Compose setup does this automatically.
When `REDIS_URL` is set, rate limiting is shared across API replicas. When
`NATS_URL` is set, `notification.queued`, `notification.sent` and
`notification.dead_letter` events are published to the
`notifications.delivery` subject. Create a matching JetStream stream before
using the publisher in a deployed environment.

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
