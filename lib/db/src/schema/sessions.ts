import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Session storage table for connect-pg-simple.
 * Kept in the Drizzle schema so the Publish flow propagates it to production.
 * The application itself never queries this table directly — connect-pg-simple
 * manages all reads/writes.  Do NOT rename columns; connect-pg-simple expects
 * the exact column names: sid, sess, expire.
 */
export const userSessionsTable = pgTable(
  "user_sessions",
  {
    sid:    varchar("sid").primaryKey(),
    sess:   json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (t) => [index("IDX_user_sessions_expire").on(t.expire)],
);
