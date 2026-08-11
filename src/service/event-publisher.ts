import type { Notification } from '../domain/notification.js';

export interface DeliveryEventPublisher {
  publish(event: { type: string; notification: Notification }): Promise<void>;
}

export class NoopDeliveryEventPublisher implements DeliveryEventPublisher {
  async publish(_event: { type: string; notification: Notification }): Promise<void> {}
}
