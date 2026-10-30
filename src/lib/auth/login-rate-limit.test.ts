import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRepository } from "@/repositories/types";
import { createAuthService } from "@/services/auth-service";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";

import { createLoginRateLimiter, loginClientAddress, LOGIN_ACCOUNT_LIMIT, LOGIN_IP_LIMIT } from "./login-rate-limit";

describe("persistent login limits", () => {
  let database: TestDatabase;
  let limiter: ReturnType<typeof createLoginRateLimiter>;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => {
    await database?.close();
  });
  beforeEach(async () => {
    await database.db.execute(sql`DELETE FROM login_rate_limits`);
    limiter = createLoginRateLimiter(database.db, "test-secret");
  });

  it("shares an account limit across IPs, casing and process restarts", async () => {
    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT; i++) {
      expect(await limiter.consume("Person@example.com", `192.0.2.${i}`)).toBe(true);
    }
    const restarted = createLoginRateLimiter(database.db, "test-secret");
    expect(await restarted.consume(" person@EXAMPLE.com ", "192.0.2.200")).toBe(false);
    expect(await restarted.consume("other@example.com", "192.0.2.200")).toBe(true);
  });

  it("limits password spraying against different accounts from the same IP", async () => {
    for (let i = 0; i < LOGIN_IP_LIMIT; i++) {
      expect(await limiter.consume(`missing-${i}@example.com`, "192.0.2.1")).toBe(true);
    }
    expect(await limiter.consume("another@example.com", "192.0.2.1")).toBe(false);
    expect(await limiter.consume("another@example.com", "192.0.2.2")).toBe(true);
  });

  it("reserves attempts atomically under concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () => limiter.consume("person@example.com", "192.0.2.1")),
    );
    expect(results.filter(Boolean)).toHaveLength(LOGIN_ACCOUNT_LIMIT);
  });

  it("allows login again after expiry and stores only opaque keys", async () => {
    for (let i = 0; i < LOGIN_ACCOUNT_LIMIT; i++) await limiter.consume("person@example.com", "192.0.2.1");
    expect(await limiter.consume("person@example.com", "192.0.2.1")).toBe(false);
    const before = await database.db.execute(sql`SELECT key, expires_at FROM login_rate_limits ORDER BY key`);
    await limiter.consume("person@example.com", "192.0.2.1");
    const after = await database.db.execute(sql`SELECT key, expires_at FROM login_rate_limits ORDER BY key`);
    expect(after).toEqual(before); // Rejections must not renew the account lockout.
    for (const row of (before as { rows: { key: string }[] }).rows) expect(row.key).toMatch(/^[a-f0-9]{64}$/);
    await database.db.execute(
      sql`UPDATE login_rate_limits SET expires_at = statement_timestamp() - interval '1 second'`,
    );
    expect(await limiter.consume("person@example.com", "192.0.2.1")).toBe(true);
  });

  it("does not query credentials when blocked and never fails open", async () => {
    const findByEmailWithCredentials = vi.fn();
    const users = { findByEmailWithCredentials } as unknown as UserRepository;
    const auth = createAuthService(users, { consume: async () => false });
    expect(await auth.verifyCredentials("person@example.com", "wrong")).toBeNull();
    expect(findByEmailWithCredentials).not.toHaveBeenCalled();
    const unavailable = createAuthService(users, {
      consume: async () => {
        throw new Error("unavailable");
      },
    });
    await expect(unavailable.verifyCredentials("person@example.com", "wrong")).rejects.toThrow("unavailable");
    expect(findByEmailWithCredentials).not.toHaveBeenCalled();
  });
});

describe("login client identity", () => {
  it("uses Railway X-Real-IP and ignores spoofed forwarding chains", () => {
    const headers = new Headers({ "x-real-ip": "192.0.2.1", "x-forwarded-for": "198.51.100.1" });
    expect(loginClientAddress(headers, true)).toBe("192.0.2.1");
    expect(loginClientAddress(headers, false)).toBe("unknown");
    expect(loginClientAddress(new Headers({ "x-real-ip": "bad", "x-forwarded-for": "192.0.2.1" }), true)).toBe(
      "unknown",
    );
    expect(loginClientAddress(new Headers({ "x-real-ip": "2001:0db8:0:0:0:0:0:1" }), true)).toBe("[2001:db8::1]");
  });
});
