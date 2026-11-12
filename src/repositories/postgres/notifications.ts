import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { notifications } from "@/db/schema";
import type { EntityId, Notification, NotificationInput } from "@/domain";

import type { NotificationRepository } from "../types";
import type { Database } from "./db";

export class PostgresNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Database) {}

  async createForUsers(userIds: readonly EntityId[], input: NotificationInput): Promise<void> {
    const recipients = [...new Set(userIds)];
    if (recipients.length === 0) return;
    await this.db
      .insert(notifications)
      .values(recipients.map((userId) => ({ userId, ...input })))
      .onConflictDoNothing();
  }

  async refreshReminders(userId: EntityId, now: Date): Promise<void> {
    const instant = now.toISOString();
    // Giorno operativo italiano, indipendente dal fuso del server Railway.
    const active = sql`
      SELECT 'TASK_OVERDUE' AS kind, 'Task scaduto' AS title, t.title AS body,
        '/tasks?filter=overdue&task=' || t.id AS href, t.candidate_id,
        'task-overdue:' || t.id || ':' || extract(epoch from t.due_at)::text AS source_key
      FROM tasks t WHERE t.assigned_to = ${userId} AND t.status IN ('OPEN', 'IN_PROGRESS') AND t.due_at < ${instant}::timestamptz
      UNION ALL
      SELECT 'INTERVIEW_TODAY', 'Colloquio oggi', c.first_name || ' ' || c.last_name || ' · ' || to_char(i.scheduled_at AT TIME ZONE 'Europe/Rome', 'HH24:MI'),
        '/recruiting/' || c.id, c.id,
        'interview-today:' || i.id || ':' || extract(epoch from i.scheduled_at)::text
      FROM interviews i JOIN applications a ON a.id = i.application_id JOIN candidates c ON c.id = a.candidate_id
      JOIN recruitment_selections s ON s.id = a.selection_id
      WHERE coalesce(i.recruiter_id, a.recruiter_id, c.recruiter_id) = ${userId} AND i.status = 'SCHEDULED' AND a.closed_at IS NULL AND s.status NOT IN ('CLOSED', 'ARCHIVED')
        AND (i.scheduled_at AT TIME ZONE 'Europe/Rome')::date = (${instant}::timestamptz AT TIME ZONE 'Europe/Rome')::date
    `;
    await this.db.execute(sql`DELETE FROM notifications n WHERE n.user_id = ${userId} AND (
      (n.kind IN ('TASK_OVERDUE', 'INTERVIEW_TODAY') AND NOT EXISTS (SELECT 1 FROM (${active}) live WHERE live.source_key = n.source_key))
      OR (n.kind = 'TASK_ASSIGNED' AND NOT EXISTS (SELECT 1 FROM tasks t WHERE n.source_key LIKE 'task-assigned:' || t.id || ':%' AND t.assigned_to = ${userId}))
    )`);
    await this.db.execute(sql`INSERT INTO notifications (user_id, kind, title, body, href, candidate_id, source_key)
      SELECT ${userId}::uuid, live.kind, live.title, left(live.body, 300), live.href, live.candidate_id, live.source_key FROM (${active}) live
      ON CONFLICT (user_id, source_key) DO UPDATE SET title = excluded.title, body = excluded.body, href = excluded.href`);
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
