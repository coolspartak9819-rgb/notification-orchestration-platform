import { jetstream } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import type { Notification } from '../domain/notification.js';
import type { DeliveryEventPublisher } from '../service/event-publisher.js';

export class NatsDeliveryEventPublisher implements DeliveryEventPublisher {
  private readonly client: ReturnType<typeof jetstream>;
  constructor(private readonly connection: NatsConnection, private readonly subject = 'notifications.delivery') {
    this.client = jetstream(connection);
  }

  async publish(event: { type: string; notification: Notification }): Promise<void> {
    await this.client.publish(this.subject, new TextEncoder().encode(JSON.stringify(event)));
  }
}
