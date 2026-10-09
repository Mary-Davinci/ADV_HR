import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedDatabase } from "@/db/seed/seed";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";

const NOW = new Date(2026, 8, 30, 8, 0);

describe("PostgreSQL repositories", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await seedDatabase(testDb.db, { now: NOW, password: "test-password" });
  }, 60_000);

  afterAll(async () => {
    await testDb?.close();
  });

  it("applies migrations with pgvector and reference data", async () => {
    const stages = await testDb.store.stages.list();
    expect(stages.map((stage) => stage.code)).toEqual([
      "NEW",
      "TO_REVIEW",
      "CONTACTED",
      "INTERVIEW_SCHEDULED",
      "INTERVIEWED",
      "SECOND_INTERVIEW",
      "SELECTED",
      "REJECTED",
      "ON_HOLD",
    ]);
    const result = await testDb.db.execute(sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`);
    expect((result as { rows: unknown[] }).rows).toHaveLength(1);
  });

  it("searches candidates accent-insensitively and derives the latest stage", async () => {
    const byName = await testDb.store.candidates.search({ text: "nicolo de luca" });
    expect(byName.items.map((item) => item.lastName)).toEqual(["De Luca"]);
    expect(byName.items[0]?.latestApplication?.stageCode).toBe("INTERVIEW_SCHEDULED");
    expect(byName.items[0]?.lastContactAt).toBeInstanceOf(Date);
  });

  it("supports structured filters without exposing SQL to callers", async () => {
    const protectedCategory = await testDb.store.candidates.search({ protectedCategory: true });
    expect(protectedCategory.items.map((item) => item.lastName).sort()).toEqual(["Fontana", "Mancini"]);

    const forklift = await testDb.store.candidates.search({ drivingLicense: "FORKLIFT" });
    expect(forklift.items.map((item) => item.lastName).sort()).toEqual(["Marchetti", "Pellegrini"]);

    const experienced = await testDb.store.candidates.search({ skill: "excel", minExperienceMonths: 60 });
    expect(experienced.items.map((item) => item.lastName).sort()).toEqual(["Galli", "Rizzi", "Villa"]);

    const english = await testDb.store.candidates.search({ language: "inglese", region: "Lombardia" });
    expect(english.total).toBeGreaterThan(3);

    const stage = await testDb.store.candidates.search({ stageCodes: ["TO_REVIEW", "NEW"] });
    expect(stage.items.map((item) => item.lastName).sort()).toEqual(["Barbieri", "Longo", "Testa"]);
  });

  it("treats wildcard characters in user input literally", async () => {
    const result = await testDb.store.candidates.search({ text: "%" });
    expect(result.total).toBe(0);
  });

  it("loads the full candidate aggregate", async () => {
    const [galli] = (await testDb.store.candidates.search({ text: "Galli" })).items;
    const aggregate = await testDb.store.candidates.getAggregate(galli!.id);
    expect(aggregate?.profile.residenceCity).toBe("Milano");
    expect(aggregate?.preferences.availability).toBe("WITHIN_1_MONTH");
    expect(aggregate?.experiences).toHaveLength(2);
    expect(aggregate?.experiences[0]?.currentRole).toBe(true);
    expect(aggregate?.skills.map((skill) => skill.skill.name)).toContain("Excel");
    expect(aggregate?.tags).toEqual([]);
  });

  it("computes selection statistics from applications and evaluations", async () => {
    const { items } = await testDb.store.selections.list({ text: "amministrativ" });
    const selection = items[0];
    expect(selection?.companyName).toBe("Studio Verdi & Associati");
    expect(selection?.stats).toMatchObject({ applications: 5, suitable: 2, notSuitable: 1, toEvaluate: 2 });
  });

  it("returns application views with derived evaluation, feedback and interview", async () => {
    const [rizziSearch] = (await testDb.store.candidates.search({ text: "Rizzi" })).items;
    const [view] = await testDb.store.applications.list({ candidateId: rizziSearch!.id });
    expect(view?.stage.code).toBe("REJECTED");
    expect(view?.latestEvaluation?.result).toBe("NOT_SUITABLE");
    expect(view?.latestFeedback?.content).toContain("budget");
    expect(view?.recruiter?.displayName).toBe("Chiara Moretti");
  });

  it("rejects a NOT_SUITABLE evaluation without reason at database level", async () => {
    const [application] = await testDb.store.applications.list({ stageCodes: ["TO_REVIEW"] });
    const evaluator = await testDb.store.users.findByEmailWithCredentials("admin@adv-hr.local");
    await expect(
      testDb.store.applications.addEvaluation({
        applicationId: application!.application.id,
        result: "NOT_SUITABLE",
        reason: "  ",
        notes: null,
        evaluatedBy: evaluator!.id,
      }),
    ).rejects.toThrow();
  });

  it("rolls back every write when a transaction fails", async () => {
    const before = await testDb.store.reports.countCandidates();
    await expect(
      testDb.store.transaction(async (repos) => {
        await repos.candidates.create({
          firstName: "Rollback",
          lastName: "Test",
          fiscalCode: null,
          email: null,
          phone: null,
          birthDate: null,
          gender: "NOT_SPECIFIED",
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await testDb.store.reports.countCandidates()).toBe(before);
  });

  it("produces report aggregates", async () => {
    const byStage = await testDb.store.reports.candidatesByStage();
    expect(byStage.reduce((sum, row) => sum + row.count, 0)).toBe(17);
    const bySource = await testDb.store.reports.applicationsBySource();
    expect(bySource.reduce((sum, row) => sum + row.count, 0)).toBe(17);
    expect(await testDb.store.reports.countSelections({ statuses: ["OPEN"] })).toBe(5);
  });

  it("manages talent pool membership idempotently", async () => {
    const [pool] = await testDb.store.talentPools.list();
    const admin = await testDb.store.users.findByEmailWithCredentials("admin@adv-hr.local");
    const [candidate] = (await testDb.store.candidates.search({ text: "Serra" })).items;
    expect(await testDb.store.talentPools.addMember(pool!.id, candidate!.id, admin!.id)).toBe(true);
    expect(await testDb.store.talentPools.addMember(pool!.id, candidate!.id, admin!.id)).toBe(false);
    expect(await testDb.store.talentPools.removeMember(pool!.id, candidate!.id)).toBe(true);
  });
});
