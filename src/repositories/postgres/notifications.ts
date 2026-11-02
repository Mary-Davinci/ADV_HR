import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { notifications } from "@/db/schema";
import type { EntityId, Notification, NotificationInput } from "@/domain";

import type { NotificationRepository } from "../types";
import type { Database } from "./db";

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Database) {}

  async createForUsers(userIds: readonly EntityId[], input: NotificationInput): Promise<void> {
    const recipients = [...new Set(userIds)];
    if (recipients.length === 0) return;
    await this.db.insert(notifications).values(recipients.map((userId) => ({ userId, ...input })));
  }

  async listForUser(userId: EntityId, limit: number): Promise<Notification[]> {
    return this.db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(Math.min(limit, 100));
  }

  async countUnread(userId: EntityId): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.value ?? 0;
  }

  async markRead(userId: EntityId, ids?: readonly EntityId[]): Promise<void> {
    if (ids && ids.length === 0) return;
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          ids ? inArray(notifications.id, [...ids]) : undefined,
        ),
      );
  }
}
