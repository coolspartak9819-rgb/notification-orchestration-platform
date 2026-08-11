import type { CreateNotification, Notification } from '../domain/notification.js';
import { MemoryNotificationStore } from '../store/memory-store.js';

export type ProviderResult = { accepted: boolean; provider: string; error?: string };

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
  constructor(
    private readonly store: MemoryNotificationStore,
    private readonly providers: NotificationProvider[],
  ) {}

  create(input: CreateNotification): { notification: Notification; duplicate: boolean } {
    return this.store.create(input);
  }

  get(id: string): Notification | undefined { return this.store.get(id); }

  async deliver(id: string): Promise<Notification> {
    const notification = this.store.update(id, (item) => {
      item.status = 'processing';
      item.attempts += 1;
    });
    for (const provider of this.providers) {
      const result = await provider.send(notification);
      if (result.accepted) {
        return this.store.update(id, (item) => { item.status = 'sent'; });
      }
    }
    return this.store.update(id, (item) => { item.status = 'retrying'; });
  }
}
