import { addDays, setHours, setMinutes, startOfDay, subDays, subHours } from "date-fns";
import { eq } from "drizzle-orm";

import {
  activePolicyParticipations,
  activities,
  applicationEvaluations,
  applications,
  candidateDrivingLicenses,
  candidateEducation,
  candidateExperiences,
  candidateInterests,
  candidateLanguages,
  candidatePreferences,
  candidateProfiles,
  candidateSkills,
  candidateTags,
  candidates,
  companies,
  feedbacks,
  interviews,
  jobDescriptions,
  recruiterProfiles,
  recruitingStages,
  recruitmentSelections,
  roles,
  skills,
  tags,
  talentPoolCandidates,
  talentPools,
  tasks,
  userRoles,
  users,
} from "@/db/schema";
import { normalizeSkillName } from "@/domain";
import { hashPassword } from "@/lib/auth/password";
import type { Database } from "@/repositories/postgres";

import {
  SEED_CANDIDATES,
  SEED_COMPANIES,
  SEED_SELECTIONS,
  SEED_TAGS,
  SEED_TALENT_POOLS,
  SEED_TASKS,
  SEED_USERS,
} from "./fixtures";

export interface SeedOptions {
  now?: Date;
  /** Password di sviluppo per tutti gli utenti seed. Salvata solo come hash. */
  password: string;
}

export interface SeedSummary {
  users: number;
  candidates: number;
  companies: number;
  selections: number;
  applications: number;
  interviews: number;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Seed: riferimento mancante (${what})`);
  return value;
}

/**
 * Popola un database VUOTO (dopo le migration) con dati fittizi coerenti.
 * Le date sono relative a `now` per mantenere significative dashboard e agenda.
 */
export async function seedDatabase(db: Database, options: SeedOptions): Promise<SeedSummary> {
  const now = options.now ?? new Date();
  const at = (daysAgo: number, hour = 9, minute = 0) =>
    setMinutes(setHours(startOfDay(subDays(now, daysAgo)), hour), minute);

  return db.transaction(async (tx) => {
    /* ---------------- Utenti e ruoli ---------------- */
    const roleRows = await tx.select().from(roles);
    const roleId = new Map(roleRows.map((role) => [role.code, role.id]));
    const passwordHash = await hashPassword(options.password);

    const userIds = new Map<string, string>();
    for (const seedUser of SEED_USERS) {
      const [user] = await tx
        .insert(users)
        .values({ email: seedUser.email, displayName: seedUser.displayName, passwordHash, createdAt: subDays(now, 90) })
        .returning({ id: users.id });
      const userId = must(user, seedUser.email).id;
      userIds.set(seedUser.key, userId);
      await tx
        .insert(userRoles)
        .values(seedUser.roles.map((code) => ({ userId, roleId: must(roleId.get(code), `ruolo ${code}`) })));
      if (seedUser.recruiter) await tx.insert(recruiterProfiles).values({ userId, ...seedUser.recruiter });
    }
    const userId = (key: string) => must(userIds.get(key), `utente ${key}`);

    /* ---------------- Stage ---------------- */
    const stageRows = await tx.select().from(recruitingStages);
    const stage = (code: string) =>
      must(
        stageRows.find((row) => row.code === code),
        `stage ${code}`,
      );

    /* ---------------- Aziende, selezioni, JD ---------------- */
    const companyIds = new Map<string, string>();
    for (const seedCompany of SEED_COMPANIES) {
      const [company] = await tx
        .insert(companies)
        .values({
          name: seedCompany.name,
          sector: seedCompany.sector,
          city: seedCompany.city,
          province: seedCompany.province,
          region: seedCompany.region,
          email: `selezione@${seedCompany.key}.example.test`,
          source: "ADV_HR",
          createdAt: subDays(now, 80),
        })
        .returning({ id: companies.id });
      companyIds.set(seedCompany.key, must(company, seedCompany.name).id);
    }

    const selectionIds = new Map<string, string>();
    const selectionCompany = new Map<string, string>();
    for (const seedSelection of SEED_SELECTIONS) {
      const companyId = must(companyIds.get(seedSelection.company), seedSelection.company);
      const [selection] = await tx
        .insert(recruitmentSelections)
        .values({
          companyId,
          title: seedSelection.title,
          status: seedSelection.status,
          openedAt: seedSelection.openedDaysAgo === null ? null : at(seedSelection.openedDaysAgo),
          closedAt: seedSelection.closedDaysAgo === undefined ? null : at(seedSelection.closedDaysAgo, 18),
          createdBy: userId(seedSelection.createdBy),
          createdAt: at(seedSelection.openedDaysAgo ?? 3),
        })
        .returning({ id: recruitmentSelections.id });
      const selectionId = must(selection, seedSelection.title).id;
      selectionIds.set(seedSelection.key, selectionId);
      selectionCompany.set(seedSelection.key, companyId);

      const { jd } = seedSelection;
      await tx.insert(jobDescriptions).values({
        selectionId,
        title: seedSelection.title,
        summary: jd.summary,
        duties: jd.duties,
        requirements: jd.requirements,
        employmentType: jd.workTime,
        workTime: jd.workTime,
        workMode: jd.workMode,
        salaryMin: jd.salaryMin ?? null,
        salaryMax: jd.salaryMax ?? null,
        currency: jd.salaryMin ? "EUR" : null,
        workingHours: jd.workingHours,
        locationCity: jd.city,
        locationProvince: jd.province,
        locationRegion: jd.region,
      });
      await tx.insert(activities).values({
        entityType: "SELECTION",
        entityId: selectionId,
        action: "CREATED",
        actorId: userId(seedSelection.createdBy),
        selectionId,
        companyId,
        metadata: { title: seedSelection.title },
        createdAt: at(seedSelection.openedDaysAgo ?? 3),
      });
    }

    /* ---------------- Skill catalog ---------------- */
    const skillIds = new Map<string, string>();
    for (const seedCandidate of SEED_CANDIDATES) {
      for (const skill of seedCandidate.skills) {
        const normalizedName = normalizeSkillName(skill.name);
        if (skillIds.has(normalizedName)) continue;
        const [row] = await tx
          .insert(skills)
          .values({ name: skill.name, category: skill.category, normalizedName })
          .returning({ id: skills.id });
        skillIds.set(normalizedName, must(row, skill.name).id);
      }
    }

    /* ---------------- Candidati ---------------- */
    const candidateIds = new Map<string, string>();
    let applicationCount = 0;
    let interviewCount = 0;

    for (const seed of SEED_CANDIDATES) {
      const createdAt = at(seed.createdDaysAgo, 9, 15);
      const [candidate] = await tx
        .insert(candidates)
        .values({
          firstName: seed.firstName,
          lastName: seed.lastName,
          fiscalCode: seed.fiscalCode,
          email: `${seed.key}@candidati.example.test`,
          phone: "+39 000 000 0000",
          birthDate: seed.birthDate,
          gender: seed.gender,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: candidates.id });
      const candidateId = must(candidate, seed.key).id;
      candidateIds.set(seed.key, candidateId);

      await tx.insert(candidateProfiles).values({
        candidateId,
        residenceCity: seed.city,
        residenceProvince: seed.province,
        residenceRegion: seed.region,
        residenceCountry: "IT",
        protectedCategory: seed.protectedCategory ?? "NONE",
        employmentStatus: seed.employmentStatus,
        professionalSummary: seed.summary,
        lastReviewedAt: createdAt,
      });
      await tx.insert(candidatePreferences).values({
        candidateId,
        availability: seed.availability,
        desiredEmploymentType: seed.workTime,
        desiredWorkTime: seed.workTime,
        desiredWorkMode: seed.workMode,
        willingToRelocate: seed.relocate,
        willingToTravel: seed.relocate,
        preferredLocations: [seed.city],
      });

      if (seed.experiences.length) {
        await tx.insert(candidateExperiences).values(
          seed.experiences.map((experience) => ({
            candidateId,
            companyName: experience.company,
            roleTitle: experience.role,
            sector: experience.sector,
            startDate: experience.start,
            endDate: experience.end,
            currentRole: experience.end === null,
            description: experience.description ?? null,
          })),
        );
      }
      if (seed.education.length) {
        await tx.insert(candidateEducation).values(
          seed.education.map((education) => ({
            candidateId,
            qualification: education.qualification,
            level: education.level,
            year: education.year,
            institution: education.institution ?? null,
            fieldOfStudy: education.field ?? null,
          })),
        );
      }
      if (seed.skills.length) {
        await tx.insert(candidateSkills).values(
          seed.skills.map((skill) => ({
            candidateId,
            skillId: must(skillIds.get(normalizeSkillName(skill.name)), skill.name),
            level: skill.level,
            yearsExperience: skill.years ?? null,
            verified: skill.level >= 4,
          })),
        );
      }
      if (seed.languages.length) {
        await tx
          .insert(candidateLanguages)
          .values(
            seed.languages.map((language) => ({ candidateId, ...language, certified: language.certified ?? false })),
          );
      }
      if (seed.licenses?.length) {
        await tx
          .insert(candidateDrivingLicenses)
          .values(seed.licenses.map((category) => ({ candidateId, category, valid: true })));
      }
      if (seed.policies?.length) {
        await tx.insert(activePolicyParticipations).values(
          seed.policies.map((policy) => ({
            candidateId,
            programType: policy.program,
            referenceYear: policy.year,
            status: "ACTIVE" as const,
          })),
        );
      }
      if (seed.interests?.length) {
        await tx
          .insert(candidateInterests)
          .values(seed.interests.map((sector, index) => ({ candidateId, sector, priority: index + 1 })));
      }

      await tx.insert(activities).values({
        entityType: "CANDIDATE",
        entityId: candidateId,
        action: "CREATED",
        actorId: userId("chiara"),
        candidateId,
        metadata: {},
        createdAt,
      });

      /* ---------------- Candidature ---------------- */
      for (const seedApp of seed.applications) {
        const selectionId = must(selectionIds.get(seedApp.selection), seedApp.selection);
        const companyId = must(selectionCompany.get(seedApp.selection), seedApp.selection);
        const appStage = stage(seedApp.stage);
        const recruiterId = userId(seedApp.recruiter);
        const appCreatedAt = at(seedApp.createdDaysAgo, 10);
        const appUpdatedAt = subHours(now, 2 + applicationCount * 3);

        const [application] = await tx
          .insert(applications)
          .values({
            candidateId,
            selectionId,
            stageId: appStage.id,
            recruiterId,
            source: applicationCount % 3 === 0 ? "WEBSITE" : applicationCount % 3 === 1 ? "MANUAL" : "EMAIL",
            createdAt: appCreatedAt,
            updatedAt: appUpdatedAt,
            closedAt: appStage.isTerminal ? appUpdatedAt : null,
          })
          .returning({ id: applications.id });
        const applicationId = must(application, "candidatura").id;
        applicationCount += 1;

        const context = { candidateId, selectionId, companyId };
        await tx.insert(activities).values({
          entityType: "APPLICATION",
          entityId: applicationId,
          action: "APPLICATION_CREATED",
          actorId: recruiterId,
          ...context,
          metadata: { stage: "NEW" },
          createdAt: appCreatedAt,
        });
        if (seedApp.stage !== "NEW") {
          await tx.insert(activities).values({
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "STATUS_CHANGED",
            actorId: recruiterId,
            ...context,
            metadata: { from: "NEW", to: seedApp.stage, fromLabel: stage("NEW").label, toLabel: appStage.label },
            createdAt: appUpdatedAt,
          });
        }
        if (seedApp.contactDaysAgo !== undefined) {
          await tx.insert(activities).values({
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "PHONE_CALL",
            actorId: recruiterId,
            ...context,
            metadata: { note: "Contatto telefonico" },
            createdAt: at(seedApp.contactDaysAgo, 11, 20),
          });
        }

        let interviewId: string | null = null;
        if (seedApp.interview) {
          const scheduledAt = setMinutes(
            setHours(startOfDay(addDays(now, seedApp.interview.inDays)), seedApp.interview.hour),
            seedApp.interview.minute ?? 0,
          );
          const [interview] = await tx
            .insert(interviews)
            .values({
              applicationId,
              recruiterId,
              scheduledAt,
              durationMinutes: 45,
              type: seedApp.interview.type,
              status: seedApp.interview.completed ? "COMPLETED" : "SCHEDULED",
              location: seedApp.interview.type === "SCREENING" ? null : "Sede ADV – Sala colloqui 2",
              meetingUrl: seedApp.interview.type === "SCREENING" ? "https://meet.example.test/adv-hr" : null,
            })
            .returning({ id: interviews.id });
          interviewId = must(interview, "colloquio").id;
          interviewCount += 1;
          await tx.insert(activities).values({
            entityType: "INTERVIEW",
            entityId: interviewId,
            action: "INTERVIEW_SCHEDULED",
            actorId: recruiterId,
            ...context,
            metadata: { scheduledAt: scheduledAt.toISOString(), type: seedApp.interview.type },
            createdAt: subDays(appUpdatedAt, 1),
          });
          if (seedApp.interview.completed) {
            await tx.insert(activities).values({
              entityType: "INTERVIEW",
              entityId: interviewId,
              action: "INTERVIEW_COMPLETED",
              actorId: recruiterId,
              ...context,
              metadata: {},
              createdAt: addDays(scheduledAt, 0),
            });
          }
        }

        if (seedApp.feedback) {
          const feedbackAt = seedApp.interview?.completed
            ? addDays(startOfDay(addDays(now, seedApp.interview.inDays)), 0)
            : subDays(appUpdatedAt, 0);
          await tx.insert(feedbacks).values({
            applicationId,
            interviewId: seedApp.interview?.completed ? interviewId : null,
            authorId: recruiterId,
            type: seedApp.interview?.completed ? "INTERVIEW" : "GENERAL",
            content: seedApp.feedback,
            createdAt: setHours(feedbackAt, 17),
            updatedAt: setHours(feedbackAt, 17),
          });
          await tx.insert(activities).values({
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "FEEDBACK_ADDED",
            actorId: recruiterId,
            ...context,
            metadata: {},
            createdAt: setHours(feedbackAt, 17),
          });
        }

        if (seedApp.evaluation) {
          await tx.insert(applicationEvaluations).values({
            applicationId,
            result: seedApp.evaluation.result,
            reason: seedApp.evaluation.reason ?? null,
            evaluatedBy: recruiterId,
            evaluatedAt: subHours(appUpdatedAt, 1),
          });
          await tx.insert(activities).values({
            entityType: "APPLICATION",
            entityId: applicationId,
            action: "EVALUATION_ADDED",
            actorId: recruiterId,
            ...context,
            metadata: { result: seedApp.evaluation.result },
            createdAt: subHours(appUpdatedAt, 1),
          });
        }

        await tx.update(candidates).set({ updatedAt: appUpdatedAt }).where(eq(candidates.id, candidateId));
      }
    }
    const candidateId = (key: string) => must(candidateIds.get(key), `candidato ${key}`);

    /* ---------------- Tag, talent pool, task ---------------- */
    for (const seedTag of SEED_TAGS) {
      const [tag] = await tx.insert(tags).values({ name: seedTag.name, slug: seedTag.slug }).returning({ id: tags.id });
      const tagId = must(tag, seedTag.slug).id;
      await tx
        .insert(candidateTags)
        .values(seedTag.candidates.map((key) => ({ candidateId: candidateId(key), tagId })));
    }

    for (const seedPool of SEED_TALENT_POOLS) {
      const [pool] = await tx
        .insert(talentPools)
        .values({ name: seedPool.name, description: seedPool.description, createdBy: userId("manager") })
        .returning({ id: talentPools.id });
      const poolId = must(pool, seedPool.name).id;
      await tx.insert(talentPoolCandidates).values(
        seedPool.members.map((key) => ({
          talentPoolId: poolId,
          candidateId: candidateId(key),
          addedBy: userId("manager"),
        })),
      );
    }

    for (const seedTask of SEED_TASKS) {
      await tx.insert(tasks).values({
        title: seedTask.title,
        assignedTo: userId(seedTask.assignee),
        createdBy: userId("manager"),
        candidateId: "candidate" in seedTask && seedTask.candidate ? candidateId(seedTask.candidate) : null,
        selectionId:
          "selection" in seedTask && seedTask.selection
            ? must(selectionIds.get(seedTask.selection), seedTask.selection)
            : null,
        dueAt: setHours(startOfDay(addDays(now, seedTask.dueInDays)), 17),
        priority: seedTask.priority,
        status: "OPEN",
      });
    }

    return {
      users: SEED_USERS.length,
      candidates: SEED_CANDIDATES.length,
      companies: SEED_COMPANIES.length,
      selections: SEED_SELECTIONS.length,
      applications: applicationCount,
      interviews: interviewCount,
    };
  });
}
