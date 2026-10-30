import { index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/** Only HMAC digests are stored: never email addresses, IPs or passwords. */
export const loginRateLimits = pgTable(
  "login_rate_limits",
  {
    key: varchar("key", { length: 64 }).primaryKey(),
    attempts: integer("attempts").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("login_rate_limits_expiry_idx").on(t.expiresAt)],
);
