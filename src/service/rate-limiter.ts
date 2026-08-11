import type { Redis } from 'ioredis';

export interface RateLimiter {
  allow(tenantId: string): Promise<boolean>;
}

export class TenantRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  async allow(tenantId: string): Promise<boolean> {
    const now = Date.now();
    const current = this.windows.get(tenantId);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.windows.set(tenantId, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }
}

export class RedisTenantRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis, private readonly limit: number, private readonly windowMs: number) {}

  async allow(tenantId: string): Promise<boolean> {
    const key = `notification-rate:${tenantId}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.pexpire(key, this.windowMs);
    return count <= this.limit;
  }
}
