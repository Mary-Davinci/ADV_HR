import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedDatabase } from "@/db/seed/seed";
import type { SessionUser } from "@/domain";
import type { InterviewInput } from "@/repositories/types";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";

import { createApplicationService } from "./application-service";
import { createSelectionService } from "./company-service";
import { createInterviewService } from "./interview-service";

const NOW = new Date("2026-09-30T08:00:00Z");

describe("recruiting lifecycle integration", () => {
  let db: TestDatabase;
  let actor: SessionUser;
  let recruiterId: string;
  const context = () => ({ store: db.store, actor, now: () => NOW });
  const interviews = () => createInterviewService(context());
  const applications = () => createApplicationService(context());
  const input = (minutes = 120): InterviewInput => ({
    scheduledAt: new Date(NOW.getTime() + minutes * 60_000),
    durationMinutes: 45,
    recruiterId,
    type: "HR",
    status: "SCHEDULED",
    location: null,
    meetingUrl: null,
    notes: null,
  });
  async function fixture() {
    const [candidate] = (await db.store.candidates.search({ text: "Galli" })).items;
    const [company] = (await db.store.companies.list({ limit: 1 })).items;
    const selection = await db.store.selections.create({
      companyId: company!.company.id,
      title: "Lifecycle test",
      status: "OPEN",
      openedAt: NOW,
      closedAt: null,
      createdBy: actor.id,
    });
    const application = await applications().create({
      candidateId: candidate!.id,
      selectionId: selection.id,
      source: "MANUAL",
      recruiterId: actor.id,
    });
    return { applicationId: application.id, selection, candidateId: candidate!.id };
  }
  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDatabase(db.db, { now: NOW, password: "Lifecycle-Test-1" });
    const user = await db.store.users.findByEmailWithCredentials("admin@adv-hr.local");
    recruiterId = (await db.store.users.findByEmailWithCredentials("chiara.moretti@adv-hr.local"))!.id;
    actor = { id: user!.id, email: user!.email, name: user!.displayName, roles: ["ADMIN"] };
  }, 60_000);
  afterAll(async () => {
    await db?.close();
  });

  it("synchronizes scheduling, completion and deletion, including timeline and last contact", async () => {
    const f = await fixture();
    const { id } = await interviews().schedule(f.applicationId, input(6000));
    expect((await applications().getView(f.applicationId))?.view.stage.code).toBe("INTERVIEW_SCHEDULED");
    await expect(interviews().update(id, { ...input(6000), status: "COMPLETED" })).rejects.toThrow("futuro");
    const oldContact = await db.store.activities.lastContactAt(f.candidateId);
    await interviews().update(id, { ...input(-1), status: "COMPLETED" });
    expect((await applications().getView(f.applicationId))?.view.stage.code).toBe("INTERVIEWED");
    await interviews().remove(id);
    expect(await db.store.activities.list({ entity: { type: "INTERVIEW", id } })).toEqual([]);
    expect(await db.store.activities.lastContactAt(f.candidateId)).toEqual(oldContact);
    expect((await applications().getView(f.applicationId))?.view.stage.code).toBe("CONTACTED");
  });

  it("rejects overlapping slots across applications and allows adjacent slots and editing itself", async () => {
    const a = await fixture();
    const b = await fixture();
    const { id } = await interviews().schedule(a.applicationId, input(7000));
    await interviews().update(id, input(7000));
    await expect(interviews().schedule(b.applicationId, input(7030))).rejects.toThrow("recruiter");
    const adjacent = await interviews().schedule(b.applicationId, input(7045));
    await interviews().remove(id);
    await interviews().remove(adjacent.id);
  });

  it.each(["stage", "evaluation"])(
    "rejects through %s, cancels every scheduled interview and blocks further work",
    async (via) => {
      const f = await fixture();
      const first = await interviews().schedule(f.applicationId, input(8000));
      const second = await interviews().schedule(f.applicationId, input(8100));
      const target = await db.store.stages.getByCode("REJECTED");
      if (via === "stage")
        await applications().changeStage(f.applicationId, { stageId: target!.id, reason: "Requisiti mancanti" });
      else
        await applications().evaluate(f.applicationId, {
          result: "NOT_SUITABLE",
          reason: "Requisiti mancanti",
          notes: null,
        });
      const view = await db.store.applications.getView(f.applicationId);
      expect(view?.stage.code).toBe("REJECTED");
      expect(view?.application.closedAt).toEqual(NOW);
      expect(view?.latestEvaluation?.result).toBe("NOT_SUITABLE");
      expect((await db.store.interviews.getById(first.id))?.status).toBe("CANCELLED");
      expect((await db.store.interviews.getById(second.id))?.status).toBe("CANCELLED");
      expect(await db.store.interviews.count({ applicationId: f.applicationId, statuses: ["SCHEDULED"] })).toBe(0);
      await expect(interviews().schedule(f.applicationId, input(8200))).rejects.toThrow("chiusa");
      const contacted = await db.store.stages.getByCode("CONTACTED");
      await expect(applications().changeStage(f.applicationId, { stageId: contacted!.id })).rejects.toThrow("chiusa");
    },
  );

  it("advances a suitable evaluation without selecting the candidate automatically", async () => {
    const f = await fixture();
    await applications().evaluate(f.applicationId, { result: "SUITABLE", reason: null, notes: null });
    const view = await db.store.applications.getView(f.applicationId);
    expect(view?.stage.code).toBe("INTERVIEWED");
    expect(view?.application.closedAt).toBeNull();
  });

  it("keeps the next interview scheduled after a suitable report and preserves an explicit review outcome", async () => {
    const f = await fixture();
    const next = await interviews().schedule(f.applicationId, input(10000));
    await interviews().recordCompleted(f.candidateId, f.applicationId, {
      ...input(-20),
      recruiterId,
      notes: "Primo colloquio",
      result: "SUITABLE",
      reason: null,
    });
    expect((await db.store.applications.getView(f.applicationId))?.stage.code).toBe("INTERVIEW_SCHEDULED");
    await interviews().recordCompleted(f.candidateId, f.applicationId, {
      ...input(-10),
      recruiterId,
      notes: "Verificare disponibilità",
      result: "TO_REVIEW",
      reason: null,
    });
    expect((await db.store.applications.getView(f.applicationId))?.stage.code).toBe("TO_REVIEW");
    await interviews().remove(next.id);
  });

  it("does not reopen a rejection recorded together with a completed interview", async () => {
    const f = await fixture();
    const next = await interviews().schedule(f.applicationId, input(11000));
    await interviews().recordCompleted(f.candidateId, f.applicationId, {
      ...input(-10),
      recruiterId,
      notes: "Colloquio concluso",
      result: "NOT_SUITABLE",
      reason: "Requisiti mancanti",
    });
    const view = await db.store.applications.getView(f.applicationId);
    expect(view?.stage.code).toBe("REJECTED");
    expect(view?.application.closedAt).toEqual(NOW);
    expect((await db.store.interviews.getById(next.id))?.status).toBe("CANCELLED");
  });

  it.each(["CLOSED", "ARCHIVED"] as const)(
    "closes applications and cancels interviews when the selection becomes %s",
    async (status) => {
      const f = await fixture();
      const { id } = await interviews().schedule(f.applicationId, input(9000));
      await createSelectionService(context()).update(f.selection.id, { ...f.selection, status });
      expect((await db.store.applications.getById(f.applicationId))?.closedAt).toEqual(NOW);
      expect((await db.store.interviews.getById(id))?.status).toBe("CANCELLED");
      expect((await db.store.applications.getView(f.applicationId))?.latestEvaluation).toBeNull();
      await expect(interviews().schedule(f.applicationId, input(9100))).rejects.toThrow("selezione");
      await expect(interviews().update(id, input(9100))).rejects.toThrow("selezione");
      await expect(
        interviews().recordCompleted(f.candidateId, f.applicationId, {
          ...input(-10),
          recruiterId: actor.id,
          notes: "Resoconto",
          result: null,
          reason: null,
        }),
      ).rejects.toThrow("selezione");
      const target = await db.store.stages.getByCode("CONTACTED");
      await expect(applications().changeStage(f.applicationId, { stageId: target!.id })).rejects.toThrow("selezione");
    },
  );
});
