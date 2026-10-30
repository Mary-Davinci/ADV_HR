import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { sql } from "drizzle-orm";

import type { Database } from "@/repositories/postgres/db";

export interface LoginRateLimiter {
  consume(email: string, clientAddress: string): Promise<boolean>;
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_ACCOUNT_LIMIT = 5;
export const LOGIN_IP_LIMIT = 30;

/** Railway sets X-Real-IP at its edge. Never trust caller-supplied X-Forwarded-For. */
export function loginClientAddress(headers: Headers, behindRailway: boolean): string {
  const address = behindRailway ? headers.get("x-real-ip")?.trim() : undefined;
  if (!address || !isIP(address)) return "unknown";
  return isIP(address) === 6 ? new URL(`http://[${address}]/`).hostname : address;
}

/** Shared across replicas and deploys. An unavailable database fails the login closed. */
export function createLoginRateLimiter(db: Database, secret: string): LoginRateLimiter {
  if (!secret) throw new Error("AUTH_SECRET is required for login rate limiting");
  let nextCleanup = 0;
  const digest = (scope: string, value: string) =>
    createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex");

  async function take(key: string, limit: number): Promise<boolean> {
    // Atomic reservation BEFORE password hashing, including concurrent requests.
    // Rejected attempts never extend the lockout or increase the counter.
    const result = await db.execute(sql`
      INSERT INTO login_rate_limits (key, attempts, expires_at)
      VALUES (${key}, 1, statement_timestamp() + ${LOGIN_WINDOW_MS} * interval '1 millisecond')
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN login_rate_limits.expires_at <= statement_timestamp()
          THEN 1 ELSE login_rate_limits.attempts + 1 END,
        expires_at = CASE WHEN login_rate_limits.expires_at <= statement_timestamp()
          THEN EXCLUDED.expires_at ELSE login_rate_limits.expires_at END
      WHERE login_rate_limits.expires_at <= statement_timestamp()
        OR login_rate_limits.attempts < ${limit}
      RETURNING key
    `);
    return (result as { rows: unknown[] }).rows.length === 1;
  }

  return {
    async consume(email, clientAddress) {
      if (Date.now() >= nextCleanup) {
        nextCleanup = Date.now() + 60_000;
        // Bounded cleanup during login traffic. Recheck expiry after concurrent updates.
        await db.execute(sql`DELETE FROM login_rate_limits WHERE expires_at <= statement_timestamp() AND key IN (
          SELECT key FROM login_rate_limits WHERE expires_at <= statement_timestamp()
          ORDER BY expires_at LIMIT 500
        )`);
      }
      // IP first bounds the number of rows created by attempts against random emails.
      if (!(await take(digest("ip", clientAddress), LOGIN_IP_LIMIT))) return false;
      return take(digest("account", email.trim().toLowerCase()), LOGIN_ACCOUNT_LIMIT);
    },
  };
}
