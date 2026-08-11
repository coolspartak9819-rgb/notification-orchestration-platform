const baseUrl = process.env.BASE_URL ?? 'http://localhost:8080';
const total = Number(process.env.TOTAL ?? 200);
const concurrency = Number(process.env.CONCURRENCY ?? 20);
let next = 0;
let completed = 0;
let failed = 0;
const startedAt = performance.now();

const worker = async () => {
  while (true) {
    const index = next++;
    if (index >= total) return;
    const response = await fetch(`${baseUrl}/v1/notifications`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': `load-${index % 10}`, 'idempotency-key': `load-${index}` },
      body: JSON.stringify({ channel: 'email', recipient: `load-${index}@example.com`, template: 'load-test', data: { index } }),
    });
    if (response.ok) completed += 1; else failed += 1;
  }
};
await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
const durationSeconds = (performance.now() - startedAt) / 1000;
console.log(JSON.stringify({ total, completed, failed, durationSeconds: Number(durationSeconds.toFixed(3)), rps: Number((total / durationSeconds).toFixed(2)) }, null, 2));
