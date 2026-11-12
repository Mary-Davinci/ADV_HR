import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "@/db/seed/seed";
import { candidateProfiles, legacyMappings, notifications } from "@/db/schema";
import type { SessionUser } from "@/domain";
import type { CandidateIdentityInput, TaskInput } from "@/repositories/types";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";
import { createCandidateService } from "./candidate-service";
import { createTaskService } from "./task-service";
import { createNotificationService } from "./notification-service";
import { createDocumentService } from "./document-service";
import { MemoryStorage } from "./storage/document-storage";

const NOW = new Date("2026-09-30T08:00:00Z");
describe("HR operations", () => {
  let db: TestDatabase;
  let admin: SessionUser;
  let recruiter: SessionUser;
  let viewer: SessionUser;
  const context = (actor = admin, now = NOW) => ({ store: db.store, actor, now: () => now });
  const service = () => createCandidateService(context());
  const identity = (suffix: string): CandidateIdentityInput => ({
    firstName: "Test",
    lastName: `Duplicato${suffix}`,
    email: `duplicate-${suffix}@example.test`,
    phone: "333 9988776",
    fiscalCode: null,
    birthDate: null,
    gender: "NOT_SPECIFIED",
  });
  const taskInput = (): TaskInput => ({
    title: "Richiamare il candidato",
    description: "Verificare disponibilità",
    assignedTo: recruiter.id,
    candidateId: null,
    applicationId: null,
    selectionId: null,
    dueAt: new Date(NOW.getTime() - 60_000),
    priority: "HIGH",
  });
  beforeAll(async () => {
    db = await createTestDatabase();
    await seedDatabase(db.db, { now: NOW, password: "Test-Operations-1" });
    const actor = async (email: string): Promise<SessionUser> => {
      const user = (await db.store.users.findByEmailWithCredentials(email))!;
      return { id: user.id, name: user.displayName, email: user.email, roles: user.roles };
    };
    admin = await actor("admin@adv-hr.local");
    recruiter = await actor("chiara.moretti@adv-hr.local");
    viewer = await actor("consulta@adv-hr.local");
  }, 60_000);
  afterAll(() => db?.close());

  it("detects normalized email, Italian phone prefixes and names, and requires an explicit override", async () => {
    const input = identity("A");
    const original = await service().create(input);
    const duplicate = { ...input, firstName: " TEST ", phone: "+39 333-9988776", email: input.email!.toUpperCase() };
    const found = await service().findDuplicates(duplicate);
    expect(found.find((row) => row.candidate.id === original.id)?.reasons).toEqual(
      expect.arrayContaining(["Stesso telefono", "Stessa email", "Stesso nome e cognome"]),
    );
    await expect(service().create(duplicate)).rejects.toThrow("duplicato");
    const second = await service().create(duplicate, true);
    const pairs = await service().duplicatePairs();
    expect(
      pairs.some(
        (pair) =>
          [pair.left.id, pair.right.id].includes(original.id) && [pair.left.id, pair.right.id].includes(second.id),
      ),
    ).toBe(true);
    expect(
      (await service().findDuplicates({ ...input, email: null, phone: null }, original.id)).some(
        (row) => row.candidate.id === second.id,
      ),
    ).toBe(true);
  });

  it("merges all linked records, fills a missing fiscal code and preserves overlapping application history", async () => {
    const target = await service().create(identity("Merge"), true);
    const source = await service().create({ ...identity("Merge"), fiscalCode: "MRGTST90A01F205X" }, true);
    await db.db
      .update(candidateProfiles)
      .set({ residenceCity: "Roma", professionalSummary: "Esperienza da conservare" })
      .where(eq(candidateProfiles.candidateId, source.id));
    const [selection] = (await db.store.selections.list({ statuses: ["OPEN"], limit: 1 })).items;
    const newStage = (await db.store.stages.getByCode("NEW"))!;
    const app = await db.store.applications.create({
      candidateId: source.id,
      selectionId: selection!.selection.id,
      stageId: newStage.id,
      recruiterId: null,
      source: "MANUAL",
    });
    const mainApp = await db.store.applications.create({
      candidateId: target.id,
      selectionId: selection!.selection.id,
      stageId: newStage.id,
      recruiterId: null,
      source: "MANUAL",
    });
    const interview = await db.store.interviews.create(app.id, {
      scheduledAt: NOW,
      status: "COMPLETED",
      recruiterId: recruiter.id,
      durationMinutes: 30,
      type: "HR",
      notes: "Resoconto",
      location: null,
      meetingUrl: null,
    });
    const evaluation = await db.store.applications.addEvaluation({
      applicationId: app.id,
      interviewId: interview.id,
      result: "SUITABLE",
      reason: null,
      notes: "Da conservare",
      evaluatedBy: recruiter.id,
    });
    const feedback = await db.store.feedbacks.create({
      applicationId: app.id,
      interviewId: interview.id,
      authorId: recruiter.id,
      type: "GENERAL",
      content: "Nota importante",
    });
    const document = await db.store.documents.create({
      owner: { candidateId: source.id, applicationId: app.id },
      type: "CV",
      filename: "cv-test.pdf",
      storageProvider: "MEMORY",
      storageKey: "merge/test-cv",
      mimeType: "application/pdf",
      sizeBytes: 10,
      uploadedBy: admin.id,
    });
    const pool = (await db.store.talentPools.list())[0]!;
    await db.store.talentPools.addMember(pool.id, source.id, admin.id);
    await db.store.talentPools.addMember(pool.id, target.id, admin.id);
    const input = {
      ...taskInput(),
      candidateId: source.id,
      applicationId: app.id,
      selectionId: selection!.selection.id,
    };
    const task = await createTaskService(context()).create(input);
    for (const [id, legacyId] of [
      [source.id, "merge-source"],
      [target.id, "merge-target"],
    ])
      await db.db
        .insert(legacyMappings)
        .values({ entityType: "CANDIDATE", advHrId: id!, legacySystem: "ADV_CORE", legacyId: legacyId! });
    await service().merge(source.id, target.id);
    expect(await db.store.candidates.getById(source.id)).toBeNull();
    expect(await service().mergedInto(source.id)).toBe(target.id);
    const after = (await service().getProfile(target.id))!;
    expect(after.candidate.fiscalCode).toBe("MRGTST90A01F205X");
    expect(after.profile).toMatchObject({ residenceCity: "Roma", professionalSummary: "Esperienza da conservare" });
    expect(after.applications.filter((item) => item.selection.id === selection!.selection.id)).toHaveLength(1);
    expect(after.applications.find((item) => item.application.id === mainApp.id)?.latestEvaluation?.result).toBe(
      "TO_REVIEW",
    );
    expect(after.interviews.find((item) => item.interview.id === interview.id)?.interview.applicationId).toBe(
      mainApp.id,
    );
    expect(after.evaluations[mainApp.id]?.map((item) => item.id)).toContain(evaluation.id);
    expect(after.feedbacks.map((item) => item.id)).toContain(feedback.id);
    expect(after.documents.find((item) => item.id === document.id)?.applicationId).toBe(mainApp.id);
    expect((await db.store.tasks.getById(task.id))?.candidateId).toBe(target.id);
    expect(after.talentPools.filter((item) => item.id === pool.id)).toHaveLength(1);
    const mappings = await db.db.select().from(legacyMappings).where(eq(legacyMappings.advHrId, target.id));
    expect(mappings.filter((item) => item.entityType === "CANDIDATE")).toHaveLength(2);
    const archived = await db.db.execute(sql`SELECT snapshot FROM candidate_merges WHERE source_id = ${source.id}`);
    expect(
      (archived as { rows: Array<{ snapshot: { source: { fiscal_code: string } } }> }).rows[0]?.snapshot.source
        .fiscal_code,
    ).toBe("MRGTST90A01F205X");
    await expect(service().merge(source.id, target.id)).rejects.toThrow("non esiste");
  });

  it("refuses conflicting fiscal codes and unauthorized merges without writes", async () => {
    const a = await service().create({ ...identity("ConflictA"), fiscalCode: "CNFTST90A01F205X" }, true);
    const b = await service().create({ ...identity("ConflictB"), fiscalCode: "CNFTST90A01F205Y" }, true);
    await expect(service().merge(a.id, b.id)).rejects.toThrow("fiscali");
    await expect(createCandidateService(context(viewer)).merge(a.id, b.id)).rejects.toThrow("permessi");
    expect(await db.store.candidates.getById(a.id)).not.toBeNull();
    expect(await db.store.candidates.getById(b.id)).not.toBeNull();
  });

  it("edits and reassigns tasks, preserves completion status and supports deletion with an audit", async () => {
    const tasks = createTaskService(context());
    const original = taskInput();
    const task = await tasks.create(original);
    await tasks.setStatus(task.id, "DONE");
    const values = {
      ...original,
      title: "Titolo corretto",
      assignedTo: admin.id,
      priority: "LOW" as const,
      dueAt: new Date(NOW.getTime() + 86_400_000),
    };
    await tasks.update(task.id, values);
    expect(await db.store.tasks.getById(task.id)).toMatchObject({
      title: values.title,
      assignedTo: { id: admin.id },
      priority: "LOW",
      status: "DONE",
      completedAt: NOW,
    });
    expect(
      (await db.store.notifications.listForUser(admin.id, 100)).some(
        (item) => item.kind === "TASK_ASSIGNED" && item.body === values.title,
      ),
    ).toBe(true);
    await expect(createTaskService(context(viewer)).remove(task.id)).rejects.toThrow("permessi");
    await tasks.remove(task.id);
    expect(await db.store.tasks.getById(task.id)).toBeNull();
    expect((await db.store.audit.list({ type: "TASK", id: task.id })).some((item) => item.action === "DELETE")).toBe(
      true,
    );
  });

  it("generates reminders once per event, retains read status and removes resolved reminders", async () => {
    const tasks = createTaskService(context());
    const task = await tasks.create(taskInput());
    const notify = createNotificationService(context(recruiter));
    const first = await notify.overview();
    const reminder = first.items.find((item) => item.kind === "TASK_OVERDUE" && item.href.includes(task.id))!;
    expect(reminder).toBeDefined();
    expect(first.items.some((item) => item.kind === "TASK_ASSIGNED" && item.href.includes(task.id))).toBe(true);
    expect(first.items.some((item) => item.kind === "INTERVIEW_TODAY")).toBe(true);
    await notify.markRead([reminder.id]);
    await tasks.update(task.id, { ...taskInput(), title: "Task rinominato" });
    await notify.overview();
    const after = await notify.overview();
    expect(after.items.find((item) => item.id === reminder.id)?.readAt).toBeInstanceOf(Date);
    expect(after.items.find((item) => item.id === reminder.id)?.body).toBe("Task rinominato");
    const rows = await db.db.select().from(notifications).where(eq(notifications.id, reminder.id));
    expect(rows).toHaveLength(1);
    await tasks.setStatus(task.id, "DONE");
    expect((await notify.overview()).items.map((item) => item.id)).not.toContain(reminder.id);
    await tasks.remove(task.id);
  });

  it("includes candidate names in document activity records for dashboard timelines", async () => {
    const person = await service().create(identity("Timeline"), true);
    await db.store.activities.record({
      entityType: "DOCUMENT",
      entityId: person.id,
      action: "DOCUMENT_UPLOADED",
      actorId: admin.id,
      candidateId: person.id,
      metadata: { type: "OTHER" },
    });
    const [activity] = await db.store.activities.list({ candidateId: person.id });
    expect(activity?.candidateName).toBe("Test DuplicatoTimeline");
  });

  it("retains the candidate context when a document linked only to an application is deleted", async () => {
    const [application] = await db.store.applications.list({});
    const storage = new MemoryStorage();
    const documentService = createDocumentService(context(), storage);
    const document = await documentService.upload({ applicationId: application!.application.id }, "OTHER", {
      name: "documento.pdf",
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode("%PDF-1.4 documento test"),
    });
    await documentService.remove(document.id);
    const events = await db.store.activities.list({ entity: { type: "DOCUMENT", id: document.id } });
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(["DOCUMENT_UPLOADED", "DOCUMENT_DELETED"]),
    );
    expect(events.every((event) => event.candidateName === application!.candidate.fullName)).toBe(true);
    expect(events.every((event) => event.candidateId === application!.candidate.id)).toBe(true);
  });
});
