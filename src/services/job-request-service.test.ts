import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedDatabase } from "@/db/seed/seed";
import { DomainRuleError, type EntityId, type RoleCode, type SessionUser } from "@/domain";
import { jobRequestFormSchema } from "@/features/job-requests/schemas";
import { ForbiddenError } from "@/lib/auth/permissions";
import { validJobRequestValues } from "@/test/job-request-fixtures";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";

import {
  createJobRequestService,
  jobDescriptionFromForm,
  type JobRequestDependencies,
  type JobRequestPdfRenderer,
} from "./job-request-service";
import { createPublicJobRequestService, InvalidLinkError } from "./job-requests/public-job-request-service";
import { MemoryMailer } from "./mail/mailer";
import { MemoryStorage } from "./storage/document-storage";

const NOW = new Date(2026, 9, 12, 10, 0);
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\n% modulo firmato di prova\n");
const PUBLIC_URL = "https://hr.example.test";

describe("job request service", () => {
  let testDb: TestDatabase;
  let companyId: EntityId;
  let mailer: MemoryMailer;
  let clock: Date;
  const actors = {} as Record<"hr" | "recruiter" | "viewer", SessionUser>;
  const rendered: string[] = [];
  const renderPdf: JobRequestPdfRenderer = async (form, meta) => {
    rendered.push(`${meta.code}#${meta.revision}:${form.profile.role}`);
    return PDF_BYTES;
  };

  const deps = (overrides: Partial<JobRequestDependencies> = {}): JobRequestDependencies => ({
    storage: new MemoryStorage(),
    renderPdf,
    mailer,
    blankForm: async () => PDF_BYTES,
    publicUrl: PUBLIC_URL,
    ...overrides,
  });
  const service = (actor: SessionUser, overrides?: Partial<JobRequestDependencies>) =>
    createJobRequestService({ store: testDb.store, actor, now: () => clock }, deps(overrides));
  const company = () => createPublicJobRequestService(testDb.store, deps(), () => clock);

  async function actorFor(email: string): Promise<SessionUser> {
    const user = await testDb.store.users.findByEmailWithCredentials(email);
    if (!user) throw new Error(email);
    return { id: user.id, email: user.email, name: user.displayName, roles: user.roles as RoleCode[] };
  }

  /** Token preso dal link nell'ultima email inviata all'indirizzo indicato. */
  function tokenFromMail(to: string): string {
    const mail = mailer.sent.filter((message) => message.to === to).at(-1);
    const match = mail?.text.match(/\/modulo\/([A-Za-z0-9_-]{43})/);
    if (!match) throw new Error(`Nessun link inviato a ${to}`);
    return match[1]!;
  }

  async function newCompleteRequest(): Promise<EntityId> {
    const { id } = await service(actors.hr).create(companyId);
    const values = validJobRequestValues();
    await service(actors.hr).complete(id, values, jobRequestFormSchema.parse(values));
    return id;
  }

  async function sentRequest(email = "referente@azienda.example"): Promise<{ id: EntityId; token: string }> {
    const { id } = await service(actors.hr).create(companyId);
    await service(actors.hr).send(id, email);
    return { id, token: tokenFromMail(email) };
  }

  beforeAll(async () => {
    testDb = await createTestDatabase();
    await seedDatabase(testDb.db, { now: NOW, password: "Test-Password-1" });
    actors.hr = await actorFor("laura.conti@adv-hr.local");
    actors.recruiter = await actorFor("chiara.moretti@adv-hr.local");
    actors.viewer = await actorFor("consulta@adv-hr.local");
    const [first] = (await testDb.store.companies.list({ limit: 1 })).items;
    companyId = first!.company.id;
  }, 60_000);

  beforeEach(() => {
    mailer = new MemoryMailer();
    clock = NOW;
  });

  afterAll(async () => {
    await testDb?.close();
  });

  describe("compilazione da parte dell'azienda", () => {
    it("invio → compilazione online → firmato → selezione aperta, con le email previste", async () => {
      const { id, token } = await sentRequest();
      const sent = await testDb.store.jobRequests.getById(id);
      expect(sent).toMatchObject({ status: "SENT", recipientEmail: "referente@azienda.example", sentAt: NOW });
      expect(sent?.accessExpiresAt?.getTime()).toBe(NOW.getTime() + 30 * 86_400_000);
      const invitation = mailer.sent[0]!;
      expect(invitation.subject).toContain(sent!.code);
      expect(invitation.attachments?.[0]?.filename).toBe("Job Description - modulo vuoto.pdf");
      expect(invitation.replyTo).toBe("laura.conti@adv-hr.local");

      const view = await company().view(token);
      expect(view).toMatchObject({ code: sent!.code, status: "SENT", correctionNote: null });

      const values = validJobRequestValues();
      await company().saveDraft(token, values);
      await company().submit(token, values, jobRequestFormSchema.parse(values));
      const ready = await testDb.store.jobRequests.getById(id);
      expect(ready).toMatchObject({ status: "READY", submittedAt: NOW });
      expect(ready?.validatedForm?.company.vatOrFiscalCode).toBe("01234567897");

      const toCompany = mailer.sent.find((mail) => mail.subject.includes("manca la firma"));
      expect(toCompany?.to).toBe("referente@azienda.example");
      expect(toCompany?.replyTo).toBe("laura.conti@adv-hr.local");
      expect(toCompany?.attachments?.[0]?.filename).toBe(`Job Description ${sent!.code} rev 1.pdf`);
      const toHr = mailer.sent.find((mail) => mail.to === "laura.conti@adv-hr.local");
      expect(toHr?.subject).toContain("ha compilato la Job Description");
      expect(toHr?.text).toContain(`${PUBLIC_URL}/companies/${companyId}/requests/${id}`);

      expect((await company().pdf(token)).content).toEqual(PDF_BYTES);
      await company().uploadSigned(token, { name: "firmato.pdf", mimeType: "application/pdf", bytes: PDF_BYTES });
      const signed = await service(actors.hr).getDetail(id);
      expect(signed?.request.status).toBe("SIGNED");
      expect(signed?.signedDocument).toMatchObject({ type: "JOB_DESCRIPTION", uploadedBy: null, companyId });
      expect(mailer.sent.some((mail) => mail.subject.includes("modulo firmato"))).toBe(true);

      await service(actors.hr).approveAndOpenSelection(id);
      await expect(company().view(token)).rejects.toBeInstanceOf(InvalidLinkError);
    });

    it("crea e invia in un passo solo, restando utilizzabile dal link", async () => {
      const { id, code } = await service(actors.hr).createAndSend(companyId, "diretto@azienda.example");
      expect(await testDb.store.jobRequests.getById(id)).toMatchObject({
        code,
        status: "SENT",
        recipientEmail: "diretto@azienda.example",
      });
      expect(mailer.sent.at(-1)?.subject).toContain(code);
      expect((await company().view(tokenFromMail("diretto@azienda.example"))).code).toBe(code);
    });

    it("se la mail non parte, «crea e invia» non lascia richieste a metà", async () => {
      const before = (await testDb.store.jobRequests.listByCompany(companyId)).length;
      const failing = service(actors.hr, {
        mailer: {
          mode: "memory",
          send: async () => {
            throw new Error("SMTP non raggiungibile");
          },
        },
      });
      await expect(failing.createAndSend(companyId, "x@azienda.example")).rejects.toThrow("SMTP");
      expect((await testDb.store.jobRequests.listByCompany(companyId)).length).toBe(before);
    });

    it("rifiuta link inesistenti, malformati o scaduti", async () => {
      const { token } = await sentRequest();
      await expect(company().view("non-valido")).rejects.toBeInstanceOf(InvalidLinkError);
      await expect(company().view("A".repeat(43))).rejects.toBeInstanceOf(InvalidLinkError);
      clock = new Date(NOW.getTime() + 31 * 86_400_000);
      await expect(company().view(token)).rejects.toBeInstanceOf(InvalidLinkError);
    });

    it("il reinvio invalida il link precedente", async () => {
      const { id, token } = await sentRequest("a@azienda.example");
      await service(actors.hr).send(id, "b@azienda.example");
      await expect(company().view(token)).rejects.toBeInstanceOf(InvalidLinkError);
      expect((await company().view(tokenFromMail("b@azienda.example"))).status).toBe("SENT");
    });

    it("HR non modifica il modulo mentre l'azienda lo compila", async () => {
      const { id } = await sentRequest();
      await expect(service(actors.hr).saveDraft(id, validJobRequestValues())).rejects.toBeInstanceOf(DomainRuleError);
    });

    it("«Da correggere» rimanda all'azienda un nuovo link con la nota e una nuova revisione", async () => {
      const { id, token } = await sentRequest("c@azienda.example");
      const values = validJobRequestValues();
      await company().submit(token, values, jobRequestFormSchema.parse(values));
      await company().uploadSigned(token, { name: "firmato.pdf", mimeType: "application/pdf", bytes: PDF_BYTES });

      await service(actors.hr).reopen(id, "Manca il timbro");
      expect(await testDb.store.jobRequests.getById(id)).toMatchObject({
        status: "SENT",
        revision: 2,
        validatedForm: null,
        signedDocumentId: null,
      });
      await expect(company().view(token)).rejects.toBeInstanceOf(InvalidLinkError);
      const view = await company().view(tokenFromMail("c@azienda.example"));
      expect(view).toMatchObject({ revision: 2, correctionNote: "Manca il timbro" });
    });

    it("se la mail non parte, la richiesta non risulta inviata", async () => {
      const { id } = await service(actors.hr).create(companyId);
      const failing = service(actors.hr, {
        mailer: {
          mode: "memory",
          send: async () => {
            throw new Error("SMTP non raggiungibile");
          },
        },
      });
      await expect(failing.send(id, "x@azienda.example")).rejects.toThrow("SMTP");
      expect(await testDb.store.jobRequests.getById(id)).toMatchObject({ status: "DRAFT", sentAt: null });
    });
  });

  describe("compilazione interna da parte di HR", () => {
    it("percorre bozza → pronta → firmata → selezione aperta", async () => {
      const hr = service(actors.hr);
      const { id } = await hr.create(companyId);
      const created = await testDb.store.jobRequests.getById(id);
      expect(created).toMatchObject({ status: "DRAFT", revision: 1 });
      expect(created?.code).toMatch(/^JR-[2-9A-HJKMNP-Z]{6}$/);

      const values = validJobRequestValues();
      await hr.saveDraft(id, values);
      await hr.complete(id, values, jobRequestFormSchema.parse(values));
      const ready = await testDb.store.jobRequests.getById(id);
      expect(ready?.status).toBe("READY");
      expect(rendered.at(-1)).toBe(`${ready!.code}#1:Operatore macchine CNC`);
      expect((await hr.pdf(id)).filename).toBe(`Job Description ${ready!.code} rev 1.pdf`);

      await hr.uploadSigned(id, { name: "scansione.pdf", mimeType: "application/pdf", bytes: PDF_BYTES });
      const { selectionId } = await hr.approveAndOpenSelection(id);
      const selection = await testDb.store.selections.getById(selectionId);
      expect(selection?.selection).toMatchObject({ status: "OPEN", title: "Operatore macchine CNC (2 posti)" });
      expect(await testDb.store.jobDescriptions.getBySelection(selectionId)).toMatchObject({
        workTime: "FULL_TIME",
        workMode: "ONSITE",
        locationProvince: "BG",
      });
    });

    it("non apre la selezione senza modulo firmato", async () => {
      const id = await newCompleteRequest();
      await expect(service(actors.hr).approveAndOpenSelection(id)).rejects.toBeInstanceOf(DomainRuleError);
    });

    it("riapre una richiesta interna in bozza con una nuova revisione", async () => {
      const hr = service(actors.hr);
      const id = await newCompleteRequest();
      await hr.uploadSigned(id, { name: "firmato.pdf", mimeType: "application/pdf", bytes: PDF_BYTES });
      await hr.reopen(id, "Manca il timbro");
      expect(await testDb.store.jobRequests.getById(id)).toMatchObject({
        status: "DRAFT",
        revision: 2,
        reviewNote: "Manca il timbro",
      });
      await expect(hr.pdf(id)).rejects.toBeInstanceOf(DomainRuleError);
    });

    it("non completa se il PDF non si può generare", async () => {
      const { id } = await service(actors.hr).create(companyId);
      const failing = service(actors.hr, {
        renderPdf: async () => {
          throw new DomainRuleError('Il testo di "Ruolo" è troppo lungo per il modulo: accorcialo.', "PDF_OVERFLOW");
        },
      });
      const values = validJobRequestValues();
      await expect(failing.complete(id, values, jobRequestFormSchema.parse(values))).rejects.toThrow(/troppo lungo/);
      expect((await testDb.store.jobRequests.getById(id))?.status).toBe("DRAFT");
    });

    it("accetta come firmato solo PDF o immagini", async () => {
      const id = await newCompleteRequest();
      const text = new TextEncoder().encode("non un pdf");
      await expect(
        service(actors.hr).uploadSigned(id, { name: "firmato.txt", mimeType: "text/plain", bytes: text }),
      ).rejects.toThrow(/PDF, JPG o PNG/);
    });
  });

  it("applica i permessi: recruiter e consultazione non gestiscono le richieste", async () => {
    const id = await newCompleteRequest();
    await expect(service(actors.recruiter).create(companyId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service(actors.viewer).send(id, "x@azienda.example")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service(actors.viewer).cancel(id)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await service(actors.viewer).getDetail(id))?.request.id).toBe(id);
  });

  it("suggerisce candidati motivando zona, titolo di studio e parole chiave nel CV", async () => {
    const id = await newCompleteRequest();
    const [candidate] = (await testDb.store.candidates.search({ limit: 1 })).items;
    const candidateId = candidate!.id;
    const [document] = (
      (await testDb.db.execute(sql`
        INSERT INTO documents (candidate_id, type, filename, storage_provider, storage_key, mime_type, size_bytes)
        VALUES (${candidateId}, 'CV', 'cv.pdf', 'MEMORY', 'test/cv-suggerimenti', 'application/pdf', 10)
        RETURNING id`)) as unknown as { rows: Array<{ id: string }> }
    ).rows;
    await testDb.db.execute(sql`
      INSERT INTO candidate_document_texts (document_id, candidate_id, status, content, char_count, search_vector)
      VALUES (${document!.id}, ${candidateId}, 'OK', 'Operatore su macchine CNC Fanuc e tornio', 40,
              to_tsvector('italian', unaccent('Operatore su macchine CNC Fanuc e tornio')))`);

    const result = await service(actors.hr).suggestions(id);
    expect(result?.criteria.keywords).toEqual(expect.arrayContaining(["operatore", "macchine", "cnc"]));
    const suggested = result?.items.find((item) => item.candidateId === candidateId);
    expect(suggested?.matchedKeywords).toEqual(expect.arrayContaining(["operatore", "macchine", "cnc"]));
    expect(suggested?.hasReadableCv).toBe(true);
    expect(result?.items[0]?.matchedKeywords.length).toBeGreaterThan(0);
    await expect(service(actors.recruiter).suggestions(id)).resolves.not.toBeNull();
  });

  it("ricava una job description leggibile dal modulo", () => {
    const values = validJobRequestValues();
    Object.assign(values.contract, { smartWorking: true, smartWorkingDays: "venerdì", schedule: "PART" });
    const jd = jobDescriptionFromForm(jobRequestFormSchema.parse(values));
    expect(jd).toMatchObject({ workMode: "HYBRID", workTime: "PART_TIME", title: "Operatore macchine CNC" });
    expect(jd.workingHours).toBe("08:00–17:00, 40 h/sett., lun mar mer gio ven");
    expect(jd.requirements).toContain("Esperienza richiesta: junior");
    expect(jd.notes).toContain("Contratto: Tempo determinato (12 mesi)");
  });
});
