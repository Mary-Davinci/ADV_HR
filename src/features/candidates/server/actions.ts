"use server";

import { z } from "zod";

import { DomainRuleError } from "@/domain";
import { runAction } from "@/lib/server/action";
import { uuidSchema } from "@/lib/zod-helpers";
import type { CandidateCollectionInput, CandidateCollectionKind } from "@/repositories/types";

import {
  COLLECTION_KINDS,
  COLLECTION_SCHEMAS,
  collectionItemInput,
  contactSchema,
  identitySchema,
  preferencesSchema,
  profileSchema,
  skillSchema,
} from "../schemas/profile-schemas";

const candidatePaths = (candidateId: string) => [`/recruiting/${candidateId}`, "/recruiting", "/dashboard"];

const withCandidate = <T extends z.ZodType>(values: T) => z.object({ candidateId: uuidSchema, values });

export async function createCandidateAction(input: unknown) {
  return runAction(input, { schema: identitySchema, revalidate: ["/recruiting", "/dashboard"] }, (values, services) =>
    services.candidates.create(values),
  );
}

export async function updateIdentityAction(input: unknown) {
  return runAction(
    input,
    { schema: withCandidate(identitySchema), revalidate: ({ candidateId }) => candidatePaths(candidateId) },
    ({ candidateId, values }, services) => services.candidates.updateIdentity(candidateId, values),
  );
}

export async function updateProfileAction(input: unknown) {
  return runAction(
    input,
    { schema: withCandidate(profileSchema), revalidate: ({ candidateId }) => candidatePaths(candidateId) },
    ({ candidateId, values }, services) => services.candidates.updateProfile(candidateId, values),
  );
}

export async function updatePreferencesAction(input: unknown) {
  return runAction(
    input,
    { schema: withCandidate(preferencesSchema), revalidate: ({ candidateId }) => candidatePaths(candidateId) },
    ({ candidateId, values }, services) => services.candidates.updatePreferences(candidateId, values),
  );
}

export async function saveCollectionItemAction(input: unknown) {
  return runAction(
    input,
    { schema: collectionItemInput, revalidate: ({ candidateId }) => candidatePaths(candidateId) },
    async ({ candidateId, kind, itemId, values }, services) => {
      // Validazione server-side con lo schema specifico della collezione.
      const parsed = COLLECTION_SCHEMAS[kind].safeParse(values);
      if (!parsed.success) {
        throw new DomainRuleError(parsed.error.issues[0]?.message ?? "Dati non validi.", "VALIDATION");
      }
      await services.candidates.saveItem(
        candidateId,
        kind,
        itemId,
        parsed.data as CandidateCollectionInput<CandidateCollectionKind>,
      );
    },
  );
}

export async function removeCollectionItemAction(input: unknown) {
  return runAction(
    input,
    {
      schema: z.object({ candidateId: uuidSchema, kind: z.enum(COLLECTION_KINDS), itemId: uuidSchema }),
      revalidate: ({ candidateId }) => candidatePaths(candidateId),
    },
    ({ candidateId, kind, itemId }, services) => services.candidates.removeItem(candidateId, kind, itemId),
  );
}

export async function setSkillAction(input: unknown) {
  return runAction(
    input,
    { schema: withCandidate(skillSchema), revalidate: ({ candidateId }) => candidatePaths(candidateId) },
    ({ candidateId, values }, services) => services.candidates.setSkill(candidateId, values),
  );
}

export async function removeSkillAction(input: unknown) {
  return runAction(
    input,
    {
      schema: z.object({ candidateId: uuidSchema, skillId: uuidSchema }),
      revalidate: ({ candidateId }) => candidatePaths(candidateId),
    },
    ({ candidateId, skillId }, services) => services.candidates.removeSkill(candidateId, skillId),
  );
}

export async function logContactAction(input: unknown) {
  return runAction(
    input,
    { schema: withCandidate(contactSchema), revalidate: ({ candidateId }) => candidatePaths(candidateId) },
    ({ candidateId, values }, services) => services.candidates.logContact(candidateId, values),
  );
}

export async function lookupCandidatesAction(input: unknown) {
  return runAction(input, { schema: z.object({ text: z.string().trim().min(2).max(100) }) }, ({ text }, services) =>
    services.candidates.lookup(text),
  );
}
