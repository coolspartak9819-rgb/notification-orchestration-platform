import type { CreateNotification, Notification, NotificationStatus } from '../domain/notification.js';

export class IdempotencyConflict extends Error {
  constructor() { super('idempotency key was already used with another request'); }
}

export class MemoryNotificationStore {
  private readonly notifications = new Map<string, Notification>();
  private readonly byIdempotency = new Map<string, string>();

  create(input: CreateNotification): { notification: Notification; duplicate: boolean } {
    const idempotencyId = `${input.tenantId}:${input.idempotencyKey}`;
    const existingId = this.byIdempotency.get(idempotencyId);
    if (existingId) {
      const existing = this.notifications.get(existingId);
      if (!existing) throw new Error('idempotency index is inconsistent');
      if (JSON.stringify({ channel: existing.channel, recipient: existing.recipient, template: existing.template, data: existing.data }) !==
        JSON.stringify({ channel: input.channel, recipient: input.recipient, template: input.template, data: input.data })) {
        throw new IdempotencyConflict();
      }
      return { notification: existing, duplicate: true };
    }

    const now = new Date().toISOString();
    const notification: Notification = {
      ...input,
      id: `ntf_${crypto.randomUUID()}`,
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.notifications.set(notification.id, notification);
    this.byIdempotency.set(idempotencyId, notification.id);
    return { notification, duplicate: false };
  }

  update(id: string, update: (notification: Notification) => void): Notification {
    const notification = this.notifications.get(id);
    if (!notification) throw new Error('notification not found');
    update(notification);
    notification.updatedAt = new Date().toISOString();
    return notification;
  }

  get(id: string): Notification | undefined { return this.notifications.get(id); }

  list(query: { tenantId: string; status?: NotificationStatus; limit?: number }): Notification[] {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    return [...this.notifications.values()]
      .filter((item) => item.tenantId === query.tenantId && (!query.status || item.status === query.status))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }
}
