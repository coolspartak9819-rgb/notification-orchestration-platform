import type { CreateNotification, Notification, NotificationStatus } from '../domain/notification.js';

export type NotificationQuery = { tenantId: string; status?: NotificationStatus; limit?: number };

export interface NotificationStore {
  create(input: CreateNotification): Promise<{ notification: Notification; duplicate: boolean }>;
  update(id: string, update: (notification: Notification) => void): Promise<Notification>;
  get(id: string): Promise<Notification | undefined>;
  list(query: NotificationQuery): Promise<Notification[]>;
}
