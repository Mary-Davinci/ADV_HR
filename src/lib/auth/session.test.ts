import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), getById: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/repositories", () => ({ getDataStore: () => ({ users: { getById: mocks.getById } }) }));

import { getSessionUser } from "./session";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("production session authorization", () => {
  it("rejects a previously issued session belonging to a development account", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.auth.mockResolvedValue({ user: { id: "dev" } });
    mocks.getById.mockResolvedValue({ id: "dev", email: "ADMIN@adv-hr.local", active: true, roles: ["ADMIN"] });
    expect(await getSessionUser()).toBeNull();
  });

  it("keeps real active production accounts authorized", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.auth.mockResolvedValue({ user: { id: "real" } });
    mocks.getById.mockResolvedValue({
      id: "real",
      email: "person@example.com",
      displayName: "Person",
      active: true,
      roles: ["ADMIN"],
    });
    expect(await getSessionUser()).toMatchObject({ id: "real", email: "person@example.com", roles: ["ADMIN"] });
  });

  it("revokes database-disabled users despite a valid JWT", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.auth.mockResolvedValue({ user: { id: "disabled" } });
    mocks.getById.mockResolvedValue({ id: "disabled", email: "person@example.com", active: false, roles: ["ADMIN"] });
    expect(await getSessionUser()).toBeNull();
  });
});
