import type { CreateNotification, Notification } from '../domain/notification.js';
import { MemoryNotificationStore } from '../store/memory-store.js';

export type ProviderResult = { accepted: boolean; provider: string; error?: string };

export type DeliveryMetrics = {
  accepted: number;
  delivered: number;
  retried: number;
  deadLettered: number;
  providerFailures: number;
};

export interface NotificationProvider {
  readonly name: string;
  send(notification: Notification): Promise<ProviderResult>;
}

export class MockProvider implements NotificationProvider {
  constructor(public readonly name: string, private readonly shouldFail = false) {}

  async send(_notification: Notification): Promise<ProviderResult> {
    if (this.shouldFail) return { accepted: false, provider: this.name, error: 'provider unavailable' };
    return { accepted: true, provider: this.name };
  }
}

export class NotificationOrchestrator {
  private readonly active = new Set<string>();
  private readonly metrics: DeliveryMetrics = { accepted: 0, delivered: 0, retried: 0, deadLettered: 0, providerFailures: 0 };

  constructor(
    private readonly store: MemoryNotificationStore,
    private readonly providers: NotificationProvider[],
    private readonly options: { maxAttempts?: number; retryBaseMs?: number } = {},
  ) {}

  create(input: CreateNotification): { notification: Notification; duplicate: boolean } {
    const result = this.store.create(input);
    if (!result.duplicate) this.metrics.accepted += 1;
    return result;
  }

  get(id: string): Notification | undefined { return this.store.get(id); }

  list(query: { tenantId: string; status?: Notification['status']; limit?: number }): Notification[] {
    return this.store.list(query);
  }

  getMetrics(): DeliveryMetrics { return { ...this.metrics }; }

  async deliver(id: string): Promise<Notification> {
    if (this.active.has(id)) return this.store.get(id) as Notification;
    const current = this.store.get(id);
    if (!current) throw new Error('notification not found');
    if (current.status === 'sent' || current.status === 'dead_letter') return current;
    this.active.add(id);
    const notification = this.store.update(id, (item) => {
      item.status = 'processing';
      item.attempts += 1;
    });
    try {
      for (const provider of this.providers) {
        let result: ProviderResult;
        try {
          result = await provider.send(notification);
        } catch (error) {
          result = { accepted: false, provider: provider.name, error: error instanceof Error ? error.message : 'provider error' };
        }
        if (result.accepted) {
          this.metrics.delivered += 1;
          return this.store.update(id, (item) => {
            item.status = 'sent';
            item.lastProvider = result.provider;
            item.lastError = undefined;
          });
        }
        this.metrics.providerFailures += 1;
        this.store.update(id, (item) => { item.lastProvider = result.provider; item.lastError = result.error; });
      }
      const maxAttempts = this.options.maxAttempts ?? 3;
      if (notification.attempts >= maxAttempts) {
        this.metrics.deadLettered += 1;
        return this.store.update(id, (item) => { item.status = 'dead_letter'; });
      }
      this.metrics.retried += 1;
      const delay = (this.options.retryBaseMs ?? 100) * 2 ** (notification.attempts - 1);
      const retrying = this.store.update(id, (item) => { item.status = 'retrying'; });
      setTimeout(() => { void this.deliver(id); }, delay).unref();
      return retrying;
    } finally {
      this.active.delete(id);
    }
  }
}
