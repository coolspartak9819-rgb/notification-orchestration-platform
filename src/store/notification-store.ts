import type { CreateNotification, Notification, NotificationStatus } from '../domain/notification.js';

export type NotificationQuery = { tenantId: string; status?: NotificationStatus; limit?: number };

export interface NotificationStore {
  create(input: CreateNotification): { notification: Notification; duplicate: boolean };
  update(id: string, update: (notification: Notification) => void): Notification;
  get(id: string): Notification | undefined;
  list(query: NotificationQuery): Notification[];
}
