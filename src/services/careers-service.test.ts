import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { candidates, careerChallenges, careerSubmissions, companies, recruitmentSelections } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import type { RoleCode, SessionUser } from "@/domain";
import { CAREERS_PRIVACY_URL } from "@/domain/careers";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";

import { createCareersService } from "./careers-service";
import { MemoryMailer } from "./mail/mailer";
import { MemoryStorage } from "./storage/document-storage";

describe("public careers", () => {
  let test: TestDatabase;
  let admin: SessionUser;
  let companyId: string;
  const storage = new MemoryStorage();
  const mailer = new MemoryMailer();
  let clock = new Date("2026-10-30T10:00:00Z");
  const service = () =>
    createCareersService({
      db: test.db,
      storage,
      mailer,
      secret: "test-careers-secret",
      publicUrl: "https://hr.example.test",
      now: () => clock,
    });
  const pdf = {
    name: "curriculum.pdf",
    mimeType: "application/pdf",
    bytes: new TextEncoder().encode("%PDF-1.7\nTest CV"),
  };
  const application = (token: string) => ({
    token,
    firstName: "Mario",
    lastName: "Candidato",
    phone: "3331234567",
    message: "Il mio messaggio",
    consent: true as const,
  });
  async function newPosting() {
    const [selection] = await test.db
      .insert(recruitmentSelections)
      .values({ companyId, title: "Titolo interno riservato", status: "OPEN" })
      .returning();
    return {
      selection: selection!,
      input: {
        selectionId: selection!.id,
        board: "aziende" as const,
        title: "Operatore amministrativo",
        employer: "Azienda cliente",
        location: "Cosenza",
        summary: "Cerchiamo una persona per il nostro ufficio amministrativo.",
        duties: "Gestione documenti",
        requirements: "Esperienza in amministrazione",
        contract: "Tempo pieno",
        expiresOn: "",
      },
    };
  }
  async function link(postingId: string | null = null, email = `${randomUUID()}@example.test`) {
    await service().requestLink({ postingId, board: "aziende", email }, randomUUID());
    const message = mailer.sent.at(-1)!;
    return { token: message.text.match(/\/jobs\/candidati\/([A-Za-z0-9_-]{43})/)![1]!, email };
  }
  beforeAll(async () => {
    test = await createTestDatabase();
    await seedDatabase(test.db, { password: "Test-Password-1", now: clock });
    const user = (await test.store.users.findByEmailWithCredentials("admin@adv-hr.local"))!;
    admin = { id: user.id, email: user.email, name: user.displayName, roles: user.roles as RoleCode[] };
    const [company] = await test.db.select({ id: companies.id }).from(companies).limit(1);
    companyId = company!.id;
  }, 60_000);
  afterAll(async () => {
    await test?.close();
  });

  it("requires explicit publication and exposes only approved public fields", async () => {
    const { input, selection } = await newPosting();
    expect(await service().publication(admin, selection.id)).toBeNull();
    const posting = await service().publish(admin, input);
    const publicPosting = await service().get(posting.slug);
    expect(publicPosting?.content.title).toBe(input.title);
    expect(publicPosting).not.toHaveProperty("selectionId");
    expect(JSON.stringify(publicPosting)).not.toContain(selection.title);
    expect((await service().list("aziende")).map((item) => item.id)).toContain(posting.id);
    expect((await service().list("Careers")).map((item) => item.id)).not.toContain(posting.id);
  });
  it("denies publication to readers", async () => {
    const { input } = await newPosting();
    await expect(service().publish({ ...admin, roles: ["VIEWER"] }, input)).rejects.toThrow();
  });
  it("hides closed and withdrawn jobs and rejects outstanding application links", async () => {
    const { input, selection } = await newPosting();
    const posting = await service().publish(admin, input);
    const proof = await link(posting.id);
    await service().unpublish(admin, selection.id);
    expect(await service().get(posting.slug)).toBeNull();
    await expect(service().submit(application(proof.token), pdf, randomUUID())).rejects.toThrow();
    await service().publish(admin, input);
    await test.db
      .update(recruitmentSelections)
      .set({ status: "CLOSED" })
      .where(eq(recruitmentSelections.id, selection.id));
    expect(await service().get(posting.slug)).toBeNull();
    await expect(service().publish(admin, input)).rejects.toThrow();
  });
  it("handles Italian summer time and expires postings", async () => {
    const { input } = await newPosting();
    const posting = await service().publish(admin, { ...input, expiresOn: "2027-07-01" });
    expect(posting.expiresAt?.toISOString()).toBe("2027-07-01T21:59:59.000Z");
    clock = new Date("2027-07-02T00:00:00Z");
    expect(await service().get(posting.slug)).toBeNull();
    clock = new Date("2026-10-30T10:00:00Z");
  });
  it("sends a short-lived proof, stores only its hash and rejects invalid tokens", async () => {
    const { token, email } = await link();
    const [row] = await test.db.select().from(careerChallenges).where(eq(careerChallenges.email, email));
    expect(row?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row?.tokenHash).not.toBe(token);
    expect(await service().challenge(token)).toMatchObject({ email, completed: false });
    await expect(service().challenge("invalid")).rejects.toThrow();
    await test.db
      .update(careerChallenges)
      .set({ expiresAt: new Date("2026-10-29") })
      .where(eq(careerChallenges.id, row!.id));
    await expect(service().submit(application(token), pdf, randomUUID())).rejects.toThrow();
  });
  it("creates candidate, pipeline entry, private CV and privacy record exactly once", async () => {
    const { input } = await newPosting();
    const posting = await service().publish(admin, input);
    const { token, email } = await link(posting.id);
    await service().submit(application(token), pdf, randomUUID());
    await service().submit(application(token), pdf, randomUUID());
    const matches = await test.db.select().from(candidates).where(eq(candidates.email, email));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ firstName: "Mario", origin: "WEBSITE" });
    const entries = await test.store.applications.list({ candidateId: matches[0]!.id });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.application).toMatchObject({ selectionId: input.selectionId, source: "WEBSITE" });
    const docs = await test.store.documents.list({ candidateId: matches[0]!.id });
    expect(docs).toHaveLength(1);
    expect(await storage.get(docs[0]!.storageKey)).toEqual(pdf.bytes);
    const [submission] = await test.db
      .select()
      .from(careerSubmissions)
      .where(eq(careerSubmissions.candidateId, matches[0]!.id));
    expect(submission).toMatchObject({
      message: "Il mio messaggio",
      privacyUrl: CAREERS_PRIVACY_URL,
      possibleDuplicateId: null,
    });
    expect((await service().challenge(token)).completed).toBe(true);
  });
  it("accepts spontaneous applications without inventing a selection", async () => {
    const { token, email } = await link();
    await service().submit(application(token), pdf, randomUUID());
    const [candidate] = await test.db.select().from(candidates).where(eq(candidates.email, email));
    expect(await test.store.applications.list({ candidateId: candidate!.id })).toHaveLength(0);
    expect(await test.store.documents.list({ candidateId: candidate!.id })).toHaveLength(1);
  });
  it("handles concurrent use of one email proof without duplicate candidates or orphan files", async () => {
    const { token, email } = await link();
    const deleted: string[] = [];
    const tracked = new MemoryStorage();
    const originalDelete = tracked.delete.bind(tracked);
    tracked.delete = async (key) => {
      deleted.push(key);
      await originalDelete(key);
    };
    const concurrent = createCareersService({
      db: test.db,
      storage: tracked,
      mailer,
      secret: "test",
      publicUrl: "https://hr.example.test",
      now: () => clock,
    });
    await Promise.all([
      concurrent.submit(application(token), pdf, randomUUID()),
      concurrent.submit(application(token), pdf, randomUUID()),
    ]);
    expect(await test.db.select().from(candidates).where(eq(candidates.email, email))).toHaveLength(1);
    expect(deleted).toHaveLength(1);
    expect(await tracked.get(deleted[0]!)).toBeNull();
  });
  it("cleans up the stored CV if a job is withdrawn during submission", async () => {
    const { input, selection } = await newPosting();
    const posting = await service().publish(admin, input);
    const { token, email } = await link(posting.id);
    const tracked = new MemoryStorage();
    const put = tracked.put.bind(tracked);
    let uploadedKey = "";
    tracked.put = async (key, bytes) => {
      uploadedKey = key;
      await put(key, bytes);
      await service().unpublish(admin, selection.id);
    };
    const interrupted = createCareersService({
      db: test.db,
      storage: tracked,
      mailer,
      secret: "test",
      publicUrl: "https://hr.example.test",
      now: () => clock,
    });
    await expect(interrupted.submit(application(token), pdf, randomUUID())).rejects.toThrow();
    expect(await tracked.get(uploadedKey)).toBeNull();
    expect(await test.db.select().from(candidates).where(eq(candidates.email, email))).toHaveLength(0);
  });
  it("flags an existing email without changing the original candidate or CV", async () => {
    const [original] = await test.db
      .select()
      .from(candidates)
      .where(sql`${candidates.email} IS NOT NULL`)
      .limit(1);
    const { token } = await link(null, original!.email!);
    await service().submit(application(token), pdf, randomUUID());
    const [unchanged] = await test.db.select().from(candidates).where(eq(candidates.id, original!.id));
    expect(unchanged).toEqual(original);
    const [submission] = await test.db
      .select()
      .from(careerSubmissions)
      .where(eq(careerSubmissions.possibleDuplicateId, original!.id));
    expect(submission?.candidateId).not.toBe(original!.id);
    expect(submission?.possibleDuplicateId).toBe(original!.id);
  });
  it("rejects missing consent and disguised executables before storing a CV", async () => {
    const { token } = await link();
    await expect(
      service().submit({ ...application(token), consent: false as unknown as true }, pdf, randomUUID()),
    ).rejects.toThrow();
    await expect(
      service().submit(application(token), { ...pdf, bytes: new TextEncoder().encode("MZexecutable") }, randomUUID()),
    ).rejects.toThrow();
    expect((await service().challenge(token)).completed).toBe(false);
  });
  it("limits unsolicited email requests and ignores honeypot submissions", async () => {
    const email = `${randomUUID()}@example.test`;
    for (let count = 0; count < 3; count++) await link(null, email);
    await expect(link(null, email)).rejects.toThrow("Troppi tentativi");
    const before = mailer.sent.length;
    await service().requestLink({ email, board: "aziende", postingId: null, website: "spam" }, randomUUID());
    expect(mailer.sent).toHaveLength(before);
  });
  it("removes unconsumed proofs when email delivery fails", async () => {
    const email = `${randomUUID()}@example.test`;
    const failing = createCareersService({
      db: test.db,
      storage,
      secret: "test",
      publicUrl: "https://hr.example.test",
      mailer: {
        mode: "memory",
        async send() {
          throw new Error("offline");
        },
      },
      now: () => clock,
    });
    await expect(failing.requestLink({ email, postingId: null, board: "aziende" }, randomUUID())).rejects.toThrow(
      "offline",
    );
    expect(await test.db.select().from(careerChallenges).where(eq(careerChallenges.email, email))).toHaveLength(0);
  });
});
