import { index, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { candidates } from "./candidates";
import { users } from "./identity";

/** Private merge archive: snapshots never enter the general audit log. */
export const candidateMerges = pgTable(
  "candidate_merges",
  {
    sourceId: uuid("source_id").primaryKey(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "restrict" }),
    mergedBy: uuid("merged_by").references(() => users.id, { onDelete: "set null" }),
    mergedAt: timestamp("merged_at", { withTimezone: true }).notNull().defaultNow(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [index("candidate_merges_target_idx").on(t.targetId)],
);
