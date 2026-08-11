export const channels = ['email', 'sms', 'push'] as const;
export type Channel = (typeof channels)[number];

export type NotificationStatus = 'queued' | 'processing' | 'sent' | 'retrying' | 'dead_letter';

export type Notification = {
  id: string;
  tenantId: string;
  channel: Channel;
  recipient: string;
  template: string;
  data: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNotification = Omit<Notification, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>;
