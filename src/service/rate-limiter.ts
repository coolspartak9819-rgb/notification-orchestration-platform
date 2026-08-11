export class TenantRateLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  allow(tenantId: string): boolean {
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
