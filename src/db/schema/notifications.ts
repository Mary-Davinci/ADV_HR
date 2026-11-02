import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import type { NotificationKind } from "@/domain/notification";

import { createdAt, id } from "./_shared";
import { candidates } from "./candidates";
import { users } from "./identity";

/** Una riga per destinatario: lettura e cancellazione sono per singolo utente. */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 40 }).$type<NotificationKind>().notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: varchar("body", { length: 300 }).notNull(),
    href: varchar("href", { length: 300 }).notNull(),
    candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);
