import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq, gt, isNotNull, or, isNull, sql } from "drizzle-orm";
import type { z } from "zod";

import { candidates, careerChallenges, careerPostings, careerSubmissions, recruitmentSelections } from "@/db/schema";
import type { SessionUser } from "@/domain";
import { DomainRuleError, INITIAL_STAGE_CODE } from "@/domain";
import { CAREERS_PRIVACY_URL, CAREERS_PRIVACY_VERSION, type CareerBoard } from "@/domain/careers";
import { careerApplicationSchema, publicationSchema, requestCareerLinkSchema } from "@/features/careers/schemas";
import { assertCan } from "@/lib/auth/permissions";
import { createPostgresDataStore } from "@/repositories/postgres";
import type { Database } from "@/repositories/postgres/db";

import { NotFoundError } from "./context";
import { sanitizeFilename, validateUpload, type UploadedFile } from "./document-service";
import type { Mailer } from "./mail/mailer";
import type { DocumentStorage } from "./storage/document-storage";

interface CareersDependencies {
  db: Database;
  storage: DocumentStorage;
  mailer: Mailer;
  secret: string;
  publicUrl: string;
  now?: () => Date;
}
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const invalidLink = () =>
  new NotFoundError("Il link non è valido o è scaduto. Richiedi un nuovo link dalla pagina dell'annuncio.");

export function createCareersService(deps: CareersDependencies) {
  const { db, storage, mailer } = deps;
  const now = () => deps.now?.() ?? new Date();
  if (!deps.secret) throw new Error("Careers signing secret missing");
  const visible = () =>
    and(
      isNotNull(careerPostings.publishedAt),
      eq(recruitmentSelections.status, "OPEN"),
      or(isNull(careerPostings.expiresAt), gt(careerPostings.expiresAt, now())),
    );

  async function take(scope: string, value: string, limit: number, windowMs: number) {
    const key = createHmac("sha256", deps.secret).update(`careers:${scope}:${value}`).digest("hex");
    const result = await db.execute(sql`INSERT INTO login_rate_limits (key, attempts, expires_at)
      VALUES (${key}, 1, statement_timestamp() + ${windowMs} * interval '1 millisecond')
      ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN login_rate_limits.expires_at <= statement_timestamp() THEN 1 ELSE login_rate_limits.attempts + 1 END,
      expires_at = CASE WHEN login_rate_limits.expires_at <= statement_timestamp() THEN EXCLUDED.expires_at ELSE login_rate_limits.expires_at END
      WHERE login_rate_limits.expires_at <= statement_timestamp() OR login_rate_limits.attempts < ${limit} RETURNING key`);
    if (!(result as { rows: unknown[] }).rows.length)
      throw new DomainRuleError("Troppi tentativi. Attendi prima di riprovare.", "RATE_LIMIT");
  }

  async function activePosting(id: string, database: Database = db, lock = false) {
    const query = database
      .select({ posting: careerPostings })
      .from(careerPostings)
      .innerJoin(recruitmentSelections, eq(recruitmentSelections.id, careerPostings.selectionId))
      .where(and(eq(careerPostings.id, id), visible()));
    const rows = lock ? await query.for("share") : await query;
    if (!rows[0]) throw new NotFoundError("Questa offerta non è più disponibile.");
    return rows[0].posting;
  }

  return {
    async list(board: CareerBoard) {
      return db
        .select({
          id: careerPostings.id,
          slug: careerPostings.slug,
          board: careerPostings.board,
          content: careerPostings.content,
          publishedAt: careerPostings.publishedAt,
          expiresAt: careerPostings.expiresAt,
        })
        .from(careerPostings)
        .innerJoin(recruitmentSelections, eq(recruitmentSelections.id, careerPostings.selectionId))
        .where(and(eq(careerPostings.board, board), visible()))
        .orderBy(desc(careerPostings.publishedAt))
        .limit(200);
    },
    async get(slug: string) {
      const rows = await db
        .select({
          id: careerPostings.id,
          slug: careerPostings.slug,
          board: careerPostings.board,
          content: careerPostings.content,
          publishedAt: careerPostings.publishedAt,
          expiresAt: careerPostings.expiresAt,
        })
        .from(careerPostings)
        .innerJoin(recruitmentSelections, eq(recruitmentSelections.id, careerPostings.selectionId))
        .where(and(eq(careerPostings.slug, slug), visible()))
        .limit(1);
      return rows[0] ?? null;
    },
    async publication(actor: SessionUser, selectionId: string) {
      assertCan(actor, "selection.read");
      return (
        (await db.select().from(careerPostings).where(eq(careerPostings.selectionId, selectionId)).limit(1))[0] ?? null
      );
    },
    async publish(actor: SessionUser, raw: z.input<typeof publicationSchema>) {
      assertCan(actor, "selection.manage");
      const input = publicationSchema.parse(raw);
      // End of the selected date in Europe/Rome, including daylight saving time.
      const midday = input.expiresOn ? new Date(`${input.expiresOn}T12:00:00Z`) : null;
      const offset = midday
        ? new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", timeZoneName: "longOffset" })
            .formatToParts(midday)
            .find((part) => part.type === "timeZoneName")!
            .value.replace("GMT", "")
        : "";
      const expiresAt = input.expiresOn ? new Date(`${input.expiresOn}T23:59:59${offset}`) : null;
      if (expiresAt && expiresAt <= now()) throw new DomainRuleError("La scadenza deve essere futura.", "EXPIRY");
      return db.transaction(async (tx) => {
        const [selection] = await tx
          .select()
          .from(recruitmentSelections)
          .where(eq(recruitmentSelections.id, input.selectionId))
          .for("share");
        if (!selection || selection.status !== "OPEN")
          throw new DomainRuleError("Apri la selezione prima di pubblicare l'annuncio.", "SELECTION_STATUS");
        const content = {
          title: input.title,
          employer: input.employer,
          location: input.location,
          summary: input.summary,
          duties: input.duties,
          requirements: input.requirements,
          contract: input.contract,
        };
        const slugTitle =
          input.title
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 130) || "opportunita";
        const [posting] = await tx
          .insert(careerPostings)
          .values({
            selectionId: selection.id,
            slug: `${slugTitle}-${randomUUID()}`,
            board: input.board,
            content,
            publishedAt: now(),
            expiresAt,
          })
          .onConflictDoUpdate({
            target: careerPostings.selectionId,
            set: { board: input.board, content, publishedAt: now(), expiresAt, updatedAt: now() },
          })
          .returning();
        await createPostgresDataStore(tx).audit.record({
          actorId: actor.id,
          entityType: "SELECTION",
          entityId: selection.id,
          action: "UPDATE",
          changes: { publicPosting: "published" },
        });
        return posting!;
      });
    },
    async unpublish(actor: SessionUser, selectionId: string) {
      assertCan(actor, "selection.manage");
      await db.transaction(async (tx) => {
        await tx
          .update(careerPostings)
          .set({ publishedAt: null, updatedAt: now() })
          .where(eq(careerPostings.selectionId, selectionId));
        await createPostgresDataStore(tx).audit.record({
          actorId: actor.id,
          entityType: "SELECTION",
          entityId: selectionId,
          action: "UPDATE",
          changes: { publicPosting: "withdrawn" },
        });
      });
    },
    async requestLink(raw: z.input<typeof requestCareerLinkSchema>, clientAddress: string) {
      const input = requestCareerLinkSchema.parse(raw);
      if (input.website) return;
      await take("link-ip", clientAddress, 10, 60 * 60_000);
      await take("link-email", input.email, 3, 60 * 60_000);
      await take("link-global", "all", 100, 60 * 60_000);
      const posting = input.postingId ? await activePosting(input.postingId) : null;
      const board = posting?.board ?? input.board;
      // Clean up bounded batches of expired, unused email proofs; no CVs exist at this stage.
      await db.execute(
        sql`DELETE FROM career_challenges WHERE consumed_at IS NULL AND expires_at < statement_timestamp() AND id IN (SELECT id FROM career_challenges WHERE consumed_at IS NULL AND expires_at < statement_timestamp() LIMIT 100)`,
      );
      await db.execute(
        sql`DELETE FROM login_rate_limits WHERE expires_at < statement_timestamp() AND key IN (SELECT key FROM login_rate_limits WHERE expires_at < statement_timestamp() LIMIT 100)`,
      );
      const token = randomBytes(32).toString("base64url");
      const [challenge] = await db
        .insert(careerChallenges)
        .values({
          tokenHash: tokenHash(token),
          email: input.email,
          postingId: posting?.id ?? null,
          board,
          expiresAt: new Date(now().getTime() + 30 * 60_000),
        })
        .returning({ id: careerChallenges.id });
      const link = `${deps.publicUrl.replace(/\/$/, "")}/jobs/candidati/${token}`;
      try {
        await mailer.send({
          to: input.email,
          subject: "Conferma la tua candidatura · Accademia Da Vinci",
          text: `Per completare la candidatura, conferma il tuo indirizzo e allega il CV da questo link: ${link}\nIl link è valido per 30 minuti. Se non hai richiesto una candidatura, ignora questa email.`,
          html: `<p>Per completare la candidatura, conferma il tuo indirizzo e allega il CV.</p><p><a href="${link.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">Completa la candidatura</a></p><p>Il link è valido per 30 minuti. Se non hai richiesto una candidatura, ignora questa email.</p>`,
        });
      } catch (error) {
        await db.delete(careerChallenges).where(eq(careerChallenges.id, challenge!.id));
        throw error;
      }
    },
    async challenge(token: string) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalidLink();
      const [challenge] = await db
        .select()
        .from(careerChallenges)
        .where(and(eq(careerChallenges.tokenHash, tokenHash(token)), gt(careerChallenges.expiresAt, now())))
        .limit(1);
      if (!challenge) throw invalidLink();
      const posting = challenge.postingId ? await activePosting(challenge.postingId) : null;
      return {
        email: challenge.email,
        title: posting?.content.title ?? "Candidatura spontanea",
        board: challenge.board,
        completed: Boolean(challenge.consumedAt),
      };
    },
    async submit(raw: z.input<typeof careerApplicationSchema>, file: UploadedFile, clientAddress: string) {
      const input = careerApplicationSchema.parse(raw);
      if (input.website) throw new DomainRuleError("Invio non riuscito.", "INVALID_FORM");
      const current = await this.challenge(input.token);
      if (current.completed) return;
      await take("upload-ip", clientAddress, 10, 60 * 60_000);
      if (file.mimeType !== "application/pdf")
        throw new DomainRuleError("Carica il curriculum in formato PDF.", "FILE_TYPE");
      validateUpload(file);
      const key = `careers/${randomUUID()}`;
      await storage.put(key, file.bytes);
      let used = false;
      try {
        used = Boolean(
          await db.transaction(async (tx) => {
            const [proof] = await tx
              .select()
              .from(careerChallenges)
              .where(eq(careerChallenges.tokenHash, tokenHash(input.token)))
              .for("update");
            if (!proof || proof.expiresAt <= now()) throw invalidLink();
            if (proof.consumedAt) return;
            const posting = proof.postingId ? await activePosting(proof.postingId, tx, true) : null;
            const repos = createPostgresDataStore(tx);
            const stage = posting ? await repos.stages.getByCode(INITIAL_STAGE_CODE) : null;
            if (posting && (!stage || !stage.active))
              throw new DomainRuleError("La candidatura non è momentaneamente disponibile.", "STAGE");
            const [duplicate] = await tx
              .select({ id: candidates.id })
              .from(candidates)
              .where(sql`lower(${candidates.email}) = ${proof.email}`)
              .limit(1);
            const candidate = await repos.candidates.create({
              firstName: input.firstName,
              lastName: input.lastName,
              email: proof.email,
              phone: input.phone,
              fiscalCode: null,
              birthDate: null,
              gender: "NOT_SPECIFIED",
            });
            await tx.update(candidates).set({ origin: "WEBSITE" }).where(eq(candidates.id, candidate.id));
            const application = posting
              ? await repos.applications.create({
                  candidateId: candidate.id,
                  selectionId: posting.selectionId,
                  stageId: stage!.id,
                  recruiterId: null,
                  source: "WEBSITE",
                })
              : null;
            const document = await repos.documents.create({
              owner: { candidateId: candidate.id },
              type: "CV",
              filename: sanitizeFilename(file.name),
              storageProvider: storage.provider,
              storageKey: key,
              mimeType: file.mimeType,
              sizeBytes: file.bytes.byteLength,
              uploadedBy: null,
            });
            await tx
              .insert(careerSubmissions)
              .values({
                challengeId: proof.id,
                postingId: posting?.id ?? null,
                candidateId: candidate.id,
                applicationId: application?.id ?? null,
                documentId: document.id,
                possibleDuplicateId: duplicate?.id ?? null,
                message: input.message || null,
                privacyUrl: CAREERS_PRIVACY_URL,
                privacyVersion: CAREERS_PRIVACY_VERSION,
                consentedAt: now(),
              });
            await repos.activities.record({
              actorId: null,
              entityType: "CANDIDATE",
              entityId: candidate.id,
              action: "CREATED",
              candidateId: candidate.id,
              metadata: { source: "WEBSITE", possibleDuplicate: Boolean(duplicate), board: proof.board },
            });
            await repos.audit.record({
              actorId: null,
              entityType: "CANDIDATE",
              entityId: candidate.id,
              action: "CREATE",
              changes: { source: "WEBSITE", privacyVersion: CAREERS_PRIVACY_VERSION },
            });
            await tx.update(careerChallenges).set({ consumedAt: now() }).where(eq(careerChallenges.id, proof.id));
            return true;
          }),
        );
      } finally {
        if (!used) await storage.delete(key);
      }
    },
    async submissions(actor: SessionUser, candidateId: string) {
      assertCan(actor, "candidate.read");
      return db
        .select({
          message: careerSubmissions.message,
          possibleDuplicateId: careerSubmissions.possibleDuplicateId,
          consentedAt: careerSubmissions.consentedAt,
        })
        .from(careerSubmissions)
        .where(eq(careerSubmissions.candidateId, candidateId));
    },
  };
}
