import type { Pool, QueryResultRow } from 'pg';
import type { CreateNotification, Notification } from '../domain/notification.js';
import { IdempotencyConflict } from './memory-store.js';
import type { NotificationQuery } from './notification-store.js';

type Row = QueryResultRow & {
  id: string; tenant_id: string; channel: Notification['channel']; recipient: string;
  template: string; data: Record<string, unknown>; status: Notification['status']; attempts: number;
  idempotency_key: string; last_provider: string | null; last_error: string | null;
  created_at: Date; updated_at: Date;
};

const toNotification = (row: Row): Notification => ({
  id: row.id, tenantId: row.tenant_id, channel: row.channel, recipient: row.recipient,
  template: row.template, data: row.data, status: row.status, attempts: row.attempts,
  idempotencyKey: row.idempotency_key, lastProvider: row.last_provider ?? undefined,
  lastError: row.last_error ?? undefined, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
});

export class PostgresNotificationStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateNotification): Promise<{ notification: Notification; duplicate: boolean }> {
    const existing = await this.pool.query<Row>(
      'SELECT * FROM notifications WHERE tenant_id = $1 AND idempotency_key = $2', [input.tenantId, input.idempotencyKey],
    );
    if (existing.rows[0]) {
      const notification = toNotification(existing.rows[0]);
      const same = JSON.stringify({ channel: notification.channel, recipient: notification.recipient, template: notification.template, data: notification.data }) ===
        JSON.stringify({ channel: input.channel, recipient: input.recipient, template: input.template, data: input.data });
      if (!same) throw new IdempotencyConflict();
      return { notification, duplicate: true };
    }
    const result = await this.pool.query<Row>(
      `INSERT INTO notifications (tenant_id, idempotency_key, channel, recipient, template, data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [input.tenantId, input.idempotencyKey, input.channel, input.recipient, input.template, JSON.stringify(input.data)],
    );
    return { notification: toNotification(result.rows[0]!), duplicate: false };
  }

  async update(id: string, update: (notification: Notification) => void): Promise<Notification> {
    const current = await this.getRequired(id);
    update(current);
    const result = await this.pool.query<Row>(
      `UPDATE notifications SET status = $2, attempts = $3, last_provider = $4, last_error = $5, updated_at = now()
       WHERE id = $1 RETURNING *`, [id, current.status, current.attempts, current.lastProvider ?? null, current.lastError ?? null],
    );
    return toNotification(result.rows[0]!);
  }

  async get(id: string): Promise<Notification | undefined> {
    const result = await this.pool.query<Row>('SELECT * FROM notifications WHERE id = $1', [id]);
    return result.rows[0] ? toNotification(result.rows[0]) : undefined;
  }

  async list(query: NotificationQuery): Promise<Notification[]> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const result = query.status
      ? await this.pool.query<Row>('SELECT * FROM notifications WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3', [query.tenantId, query.status, limit])
      : await this.pool.query<Row>('SELECT * FROM notifications WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2', [query.tenantId, limit]);
    return result.rows.map(toNotification);
  }

  private async getRequired(id: string): Promise<Notification> {
    const notification = await this.get(id);
    if (!notification) throw new Error('notification not found');
    return notification;
  }
}
