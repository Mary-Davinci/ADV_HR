import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedDatabase } from "@/db/seed/seed";
import { DomainRuleError, type RoleCode, type SessionUser } from "@/domain";
import { ForbiddenError } from "@/lib/auth/permissions";
import { createLoginRateLimiter } from "@/lib/auth/login-rate-limit";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";

import { createApplicationService } from "./application-service";
import { createAuthService } from "./auth-service";
import { createCandidateService } from "./candidate-service";
import { createDashboardService } from "./dashboard-service";
import { createDocumentService, sanitizeFilename } from "./document-service";
import { createInterviewService } from "./interview-service";
import { MemoryStorage } from "./storage/document-storage";

const NOW = new Date(2026, 8, 30, 8, 0);
const PASSWORD = "Test-Password-1";

describe("services", () => {
  let testDb: TestDatabase;
  const actors = {} as Record<"admin" | "recruiter" | "viewer", SessionUser>;

  const ctx = (actor: SessionUser) => ({ store: testDb.store, actor, now: () => NOW });

  async function actorFor(email: string): Promise<SessionUser> {
    const user = await testDb.store.users.findByEmailWithCredentials(email);
    if (!user) throw new Error(email);
    return { id: user.id, email: user.email, name: user.displayName, roles: user.roles as RoleCode[] };
  }

  async function applicationOf(lastName: string) {
    const [candidate] = (await testDb.store.candidates.search({ text: lastName })).items;
    const [view] = await testDb.store.applications.list({ candidateId: candidate!.id });
    return view!;
  }

  async function countRows(table: string, where = sql`true`): Promise<number> {
    const result = await testDb.db.execute(sql`SELECT count(*)::int AS c FROM ${sql.identifier(table)} WHERE ${where}`);
    return Number((result as { rows: Array<{ c: number }> }).rows[0]?.c ?? 0);
  }

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await seedDatabase(testDb.db, { now: NOW, password: PASSWORD });
    actors.admin = await actorFor("admin@adv-hr.local");
    actors.recruiter = await actorFor("chiara.moretti@adv-hr.local");
    actors.viewer = await actorFor("consulta@adv-hr.local");
  }, 60_000);

  afterAll(async () => {
    await testDb?.close();
  });

  describe("authentication", () => {
    it("rejects development accounts in production even with a correct password", async () => {
      const auth = createAuthService(testDb.store.users, createLoginRateLimiter(testDb.db, "test-secret"), false);
      expect(await auth.verifyCredentials("admin@adv-hr.local", PASSWORD)).toBeNull();
    });
    it("authenticates DB users with hashed passwords only", async () => {
      const auth = createAuthService(testDb.store.users, createLoginRateLimiter(testDb.db, "test-secret"));
      const user = await auth.verifyCredentials("Chiara.Moretti@adv-hr.local", PASSWORD);
      expect(user).toMatchObject({ email: "chiara.moretti@adv-hr.local", roles: ["RECRUITER"] });
      expect(await auth.verifyCredentials("chiara.moretti@adv-hr.local", "wrong")).toBeNull();
      expect(await auth.verifyCredentials("missing@adv-hr.local", PASSWORD)).toBeNull();

      const stored = await testDb.store.users.findByEmailWithCredentials("chiara.moretti@adv-hr.local");
      expect(stored?.passwordHash).toMatch(/^scrypt\$/);
      expect(stored?.passwordHash).not.toContain(PASSWORD);
    });
  });

  describe("application pipeline", () => {
    it("changes stage atomically with activity and audit records", async () => {
      const view = await applicationOf("Barbieri");
      const target = await testDb.store.stages.getByCode("CONTACTED");
      const activitiesBefore = await countRows("activities", sql`entity_id = ${view.application.id}`);

      await createApplicationService(ctx(actors.recruiter)).changeStage(view.application.id, { stageId: target!.id });

      const after = await testDb.store.applications.getView(view.application.id);
      expect(after?.stage.code).toBe("CONTACTED");
      expect(await countRows("activities", sql`entity_id = ${view.application.id}`)).toBe(activitiesBefore + 1);
      const [audit] = await testDb.store.audit.list({ type: "APPLICATION", id: view.application.id });
      expect(audit).toMatchObject({ action: "STAGE_CHANGE", changes: { from: "TO_REVIEW", to: "CONTACTED" } });
    });

    it("requires a reason to reject and records a NOT_SUITABLE evaluation", async () => {
      const service = createApplicationService(ctx(actors.recruiter));
      const view = await applicationOf("Longo");
      const rejected = await testDb.store.stages.getByCode("REJECTED");

      await expect(
        service.changeStage(view.application.id, { stageId: rejected!.id, reason: " " }),
      ).rejects.toBeInstanceOf(DomainRuleError);
      expect((await testDb.store.applications.getView(view.application.id))?.stage.code).toBe("NEW");

      await service.changeStage(view.application.id, {
        stageId: rejected!.id,
        reason: "Nessuna esperienza in magazzino",
      });
      const after = await testDb.store.applications.getView(view.application.id);
      expect(after?.stage.code).toBe("REJECTED");
      expect(after?.application.closedAt).toEqual(NOW);
      expect(after?.latestEvaluation).toMatchObject({
        result: "NOT_SUITABLE",
        reason: "Nessuna esperienza in magazzino",
      });
    });

    it("keeps an evaluation history per application", async () => {
      const service = createApplicationService(ctx(actors.recruiter));
      const view = await applicationOf("Serra");
      await expect(
        service.evaluate(view.application.id, { result: "NOT_SUITABLE", reason: null, notes: null }),
      ).rejects.toThrow("motivazione");
      await service.evaluate(view.application.id, { result: "SUITABLE", reason: null, notes: "Profilo coerente" });

      const history = await testDb.store.applications.listEvaluations(view.application.id);
      expect(history.map((evaluation) => evaluation.result)).toEqual(["SUITABLE", "TO_REVIEW"]);
    });

    it("prevents duplicate applications for the same selection", async () => {
      const view = await applicationOf("Galli");
      await expect(
        createApplicationService(ctx(actors.recruiter)).create({
          candidateId: view.candidate.id,
          selectionId: view.selection.id,
          recruiterId: null,
          source: "MANUAL",
        }),
      ).rejects.toThrow("già associato");
    });

    it("adds compatible candidates in bulk, skipping those already in the selection", async () => {
      const galli = await applicationOf("Galli");
      const selectionId = galli.selection.id;
      const members = await testDb.store.applications.list({ selectionId });
      const memberIds = new Set(members.map((view) => view.candidate.id));
      const outsider = (await testDb.store.candidates.search({ limit: 50 })).items.find(
        (item) => !memberIds.has(item.id),
      );

      const result = await createApplicationService(ctx(actors.recruiter)).createMany({
        selectionId,
        candidateIds: [galli.candidate.id, outsider!.id, outsider!.id],
        source: "ADV_HR",
      });

      expect(result).toEqual({ added: 1, skipped: 1 });
      expect((await testDb.store.applications.list({ selectionId })).length).toBe(members.length + 1);
      await expect(
        createApplicationService(ctx(actors.viewer)).createMany({
          selectionId,
          candidateIds: [outsider!.id],
          source: "ADV_HR",
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("appends feedback history instead of overwriting", async () => {
      const service = createApplicationService(ctx(actors.recruiter));
      const view = await applicationOf("Ferri");
      await service.addFeedback(view.application.id, {
        type: "GENERAL",
        content: "Richiamata per chiarimenti",
        interviewId: null,
      });
      const feedbacks = await testDb.store.feedbacks.list({ applicationId: view.application.id });
      expect(feedbacks).toHaveLength(2);
      expect(feedbacks[0]?.content).toBe("Richiamata per chiarimenti");
    });
  });

  describe("authorization", () => {
    it("denies write operations to read-only users server-side", async () => {
      const view = await applicationOf("Galli");
      const stage = await testDb.store.stages.getByCode("CONTACTED");
      await expect(
        createApplicationService(ctx(actors.viewer)).changeStage(view.application.id, { stageId: stage!.id }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        createCandidateService(ctx(actors.viewer)).logContact(view.candidate.id, {
          action: "PHONE_CALL",
          note: null,
          applicationId: null,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      // Lettura consentita
      await expect(createCandidateService(ctx(actors.viewer)).getProfile(view.candidate.id)).resolves.not.toBeNull();
    });
  });

  describe("candidate profile", () => {
    it("derives last contact from contact activities", async () => {
      const service = createCandidateService(ctx(actors.recruiter));
      const [candidate] = (await testDb.store.candidates.search({ text: "Lombardo" })).items;
      expect((await service.getProfile(candidate!.id))?.lastContactAt).toBeNull();

      await service.logContact(candidate!.id, {
        action: "PHONE_CALL",
        note: "Disponibile da lunedì",
        applicationId: null,
      });
      const profile = await service.getProfile(candidate!.id);
      expect(profile?.lastContactAt).toBeInstanceOf(Date);
      expect(profile?.timeline[0]).toMatchObject({ action: "PHONE_CALL", metadata: { note: "Disponibile da lunedì" } });
    });

    it("updates last review, activity and audit on relevant profile changes", async () => {
      const service = createCandidateService(ctx(actors.recruiter));
      const [candidate] = (await testDb.store.candidates.search({ text: "Cattaneo" })).items;
      await service.saveItem(candidate!.id, "languages", null, {
        language: "Tedesco",
        level: "A2",
        certified: false,
        notes: null,
      });
      const profile = await service.getProfile(candidate!.id);
      expect(profile?.languages.map((language) => language.language)).toContain("Tedesco");
      expect(profile?.profile.lastReviewedAt).toEqual(NOW);
      const [audit] = await testDb.store.audit.list({ type: "CANDIDATE", id: candidate!.id });
      expect(audit).toMatchObject({ action: "CREATE", changes: { section: "languages" } });
    });

    it("rejects duplicate fiscal codes", async () => {
      await expect(
        createCandidateService(ctx(actors.recruiter)).create({
          firstName: "Doppio",
          lastName: "Codice",
          fiscalCode: "gllmtn94c52x000a",
          email: null,
          phone: null,
          birthDate: null,
          gender: "NOT_SPECIFIED",
        }),
      ).rejects.toThrow("codice fiscale");
    });
  });

  describe("interviews", () => {
    it("records a contact when an interview is completed", async () => {
      const view = await applicationOf("Marchetti");
      const [interview] = (await testDb.store.interviews.list({ applicationId: view.application.id })).items;
      const service = createInterviewService(ctx(actors.recruiter));
      await service.update(interview!.interview.id, { ...interview!.interview, status: "COMPLETED" });

      expect(await testDb.store.activities.lastContactAt(view.candidate.id)).toBeInstanceOf(Date);
      const actions = (
        await testDb.store.activities.list({ entity: { type: "INTERVIEW", id: interview!.interview.id } })
      ).map((activity) => activity.action);
      expect(actions).toEqual(expect.arrayContaining(["INTERVIEW_COMPLETED", "INTERVIEW"]));
    });

    it("refuses to schedule interviews in the past", async () => {
      const view = await applicationOf("Gatti");
      await expect(
        createInterviewService(ctx(actors.recruiter)).schedule(view.application.id, {
          recruiterId: null,
          scheduledAt: new Date(2026, 8, 1, 10, 0),
          durationMinutes: 30,
          type: "HR",
          status: "SCHEDULED",
          location: null,
          meetingUrl: null,
          notes: null,
        }),
      ).rejects.toThrow("passato");
    });
  });

  describe("documents", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

    it("stores the file outside the DB and only metadata in PostgreSQL", async () => {
      const storage = new MemoryStorage();
      const service = createDocumentService(ctx(actors.recruiter), storage);
      const [candidate] = (await testDb.store.candidates.search({ text: "Galli" })).items;

      const document = await service.upload({ candidateId: candidate!.id }, "CV", {
        name: "../../CV Galli.pdf",
        mimeType: "application/pdf",
        bytes: pdf,
      });
      expect(document).toMatchObject({ filename: "CV Galli.pdf", processingStatus: "UPLOADED", sizeBytes: 8 });
      expect(document.storageKey).not.toContain("Galli");
      expect((await service.download(document.id)).content).toEqual(pdf);
    });

    it("rejects disallowed types, spoofed content and oversize files", async () => {
      const service = createDocumentService(ctx(actors.recruiter), new MemoryStorage());
      const [candidate] = (await testDb.store.candidates.search({ text: "Galli" })).items;
      const owner = { candidateId: candidate!.id };

      await expect(
        service.upload(owner, "OTHER", { name: "x.exe", mimeType: "application/x-msdownload", bytes: pdf }),
      ).rejects.toThrow("Formato");
      await expect(
        service.upload(owner, "CV", { name: "cv.pdf", mimeType: "application/pdf", bytes: new Uint8Array([1, 2, 3]) }),
      ).rejects.toThrow("contenuto");
      await expect(
        service.upload(owner, "CV", {
          name: "cv.pdf",
          mimeType: "application/pdf",
          bytes: new Uint8Array(11 * 1024 * 1024),
        }),
      ).rejects.toThrow("10 MB");
    });

    it("sanitizes filenames", () => {
      expect(sanitizeFilename('C:\\temp\\a"b<c>.pdf')).toBe("a_b_c_.pdf");
    });
  });

  describe("dashboard", () => {
    it("computes KPIs from persistent data", async () => {
      const summary = await createDashboardService(ctx(actors.admin)).getSummary();
      expect(summary.kpi.openSelections).toBe(5);
      expect(summary.kpi.interviewsToday).toBeGreaterThanOrEqual(2);
      expect(summary.kpi.overdueTasks).toBe(2);
      expect(summary.upcomingInterviews.length).toBeGreaterThan(0);
      expect(summary.recentActivities.length).toBeGreaterThan(0);
    });
  });
});
