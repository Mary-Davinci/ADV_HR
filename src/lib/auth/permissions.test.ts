import { describe, expect, it } from "vitest";

import { assertCan, can, ForbiddenError, permissionsOf } from "./permissions";

describe("RBAC", () => {
  it("grants full access to ADMIN", () => {
    expect(can({ roles: ["ADMIN"] }, "audit.read")).toBe(true);
    expect(can({ roles: ["ADMIN"] }, "company.manage")).toBe(true);
  });

  it("limits RECRUITER to candidate/application/interview work", () => {
    const recruiter = { roles: ["RECRUITER"] as const };
    expect(can(recruiter, "candidate.edit")).toBe(true);
    expect(can(recruiter, "application.manage")).toBe(true);
    expect(can(recruiter, "feedback.manage")).toBe(true);
    expect(can(recruiter, "selection.manage")).toBe(false);
    expect(can(recruiter, "company.manage")).toBe(false);
    expect(can(recruiter, "reports.read")).toBe(false);
  });

  it("gives HR_MANAGER selection management and reports but not audit", () => {
    const manager = { roles: ["HR_MANAGER"] as const };
    expect(can(manager, "selection.manage")).toBe(true);
    expect(can(manager, "reports.read")).toBe(true);
    expect(can(manager, "audit.read")).toBe(false);
  });

  it("keeps VIEWER strictly read-only", () => {
    const viewer = { roles: ["VIEWER"] as const };
    expect(permissionsOf(viewer).every((permission) => permission.endsWith(".read"))).toBe(true);
    expect(can(viewer, "candidate.read")).toBe(true);
    expect(() => assertCan(viewer, "candidate.edit")).toThrow(ForbiddenError);
  });

  it("combines permissions of multiple roles and denies users without roles", () => {
    expect(can({ roles: ["VIEWER", "RECRUITER"] }, "candidate.edit")).toBe(true);
    expect(can({ roles: [] }, "candidate.read")).toBe(false);
    expect(can(null, "candidate.read")).toBe(false);
  });
});
