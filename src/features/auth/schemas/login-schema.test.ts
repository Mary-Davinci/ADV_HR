import { describe, expect, it } from "vitest";

import { getSafeCallbackUrl } from "@/lib/auth/callback-url";

import { loginSchema } from "./login-schema";

describe("loginSchema", () => {
  it("normalises the email", () => {
    expect(loginSchema.parse({ email: "  Demo@ADV-HR.local ", password: "x" })).toEqual({
      email: "demo@adv-hr.local",
      password: "x",
    });
  });

  it("returns Italian messages for missing or invalid fields", () => {
    const result = loginSchema.safeParse({ email: "non-una-email", password: "" });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toContain("Indirizzo email non valido");
    expect(messages).toContain("Inserisci la password");
  });
});

describe("getSafeCallbackUrl", () => {
  it.each([
    ["/recruiting?status=NEW", "/recruiting?status=NEW"],
    ["/recruiting/cand-001", "/recruiting/cand-001"],
  ])("keeps internal path %s", (input, expected) => {
    expect(getSafeCallbackUrl(input)).toBe(expected);
  });

  it.each([undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "/login", "/api/auth/signout"])(
    "falls back to the dashboard for %s",
    (input) => {
      expect(getSafeCallbackUrl(input)).toBe("/dashboard");
    },
  );
});
