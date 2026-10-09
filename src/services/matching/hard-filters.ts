import { createHash } from "node:crypto";

import {
  deriveOverallStatus,
  getTotalExperienceMonths,
  normalizeSkillName,
  type EducationLevel,
  type LanguageLevel,
  type MatchingEvidence,
  type MatchingEvidenceStatus,
  type MatchingRequirement,
  type MatchingResult,
} from "@/domain";
import type { CandidateAggregate } from "@/repositories/types";

import type { HardFilterEvaluator } from "./contracts";

/**
 * Valutatori "hard filter" basati su regole esplicite. Ogni esito è
 * spiegabile (PASS / FAIL / UNKNOWN / REVIEW_REQUIRED) e un dato mancante
 * non diventa mai un FAIL: diventa UNKNOWN, da verificare con il candidato.
 */

const LANGUAGE_ORDER: LanguageLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2", "NATIVE"];
const EDUCATION_ORDER: EducationLevel[] = [
  "LOWER_SECONDARY",
  "VOCATIONAL",
  "UPPER_SECONDARY",
  "POST_SECONDARY",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
];

function evidence(
  requirement: MatchingRequirement,
  status: MatchingEvidenceStatus,
  message: string,
  metadata: Record<string, unknown> = {},
): MatchingEvidence {
  return { requirementCode: requirement.code, status, message, metadata };
}

const str = (value: unknown) => (typeof value === "string" ? value : undefined);
const num = (value: unknown) => (typeof value === "number" ? value : undefined);
const same = (a: string, b: string) => normalizeSkillName(a) === normalizeSkillName(b);

export const hardFilterEvaluator: HardFilterEvaluator = {
  evaluate(candidate, requirement) {
    const { profile, preferences } = candidate;
    const params = requirement.params;

    switch (requirement.code) {
      case "LOCATION": {
        const city = str(params.city);
        if (!city) return evidence(requirement, "UNKNOWN", "Sede della posizione non indicata");
        if (profile.residenceCity && same(profile.residenceCity, city))
          return evidence(requirement, "PASS", `Residente a ${city}`);
        if (preferences.preferredLocations.some((location) => same(location, city))) {
          return evidence(requirement, "PASS", `${city} tra le sedi preferite`);
        }
        if (preferences.willingToRelocate)
          return evidence(requirement, "REVIEW_REQUIRED", `Non residente a ${city}, disponibile al trasferimento`);
        if (!profile.residenceCity) return evidence(requirement, "UNKNOWN", "Residenza non indicata");
        return evidence(
          requirement,
          "FAIL",
          `Sede richiesta (${city}) diversa dalla residenza (${profile.residenceCity})`,
        );
      }
      case "RELOCATION":
        if (preferences.willingToRelocate === null)
          return evidence(requirement, "UNKNOWN", "Disponibilità al trasferimento non dichiarata");
        return preferences.willingToRelocate
          ? evidence(requirement, "PASS", "Disponibile al trasferimento")
          : evidence(requirement, "FAIL", "Non disponibile al trasferimento");
      case "WORK_MODE": {
        const mode = str(params.mode);
        if (!preferences.desiredWorkMode)
          return evidence(requirement, "UNKNOWN", "Modalità di lavoro preferita non dichiarata");
        if (!mode || preferences.desiredWorkMode === mode || preferences.desiredWorkMode === "FLEXIBLE") {
          return evidence(requirement, "PASS", "Modalità di lavoro compatibile");
        }
        return evidence(requirement, "REVIEW_REQUIRED", "Modalità di lavoro preferita diversa da quella offerta");
      }
      case "WORK_TIME": {
        const time = str(params.workTime);
        if (!preferences.desiredWorkTime) return evidence(requirement, "UNKNOWN", "Orario preferito non dichiarato");
        if (
          !time ||
          time === "EITHER" ||
          preferences.desiredWorkTime === "EITHER" ||
          preferences.desiredWorkTime === time
        ) {
          return evidence(requirement, "PASS", "Orario compatibile");
        }
        return evidence(requirement, "FAIL", "Orario preferito non compatibile");
      }
      case "DRIVING_LICENSE": {
        const category = str(params.category);
        const license = candidate.drivingLicenses.find((item) => item.category === category);
        if (license?.valid) return evidence(requirement, "PASS", `Patente ${category} valida`);
        if (license) return evidence(requirement, "REVIEW_REQUIRED", `Patente ${category} da verificare (non valida)`);
        return evidence(requirement, "FAIL", `Patente ${category} non presente`);
      }
      case "PROTECTED_CATEGORY": {
        if (profile.protectedCategory === "NOT_SPECIFIED")
          return evidence(requirement, "UNKNOWN", "Appartenenza L. 68/99 non indicata");
        const isProtected = profile.protectedCategory === "ART_1" || profile.protectedCategory === "ART_18";
        return isProtected
          ? evidence(requirement, "PASS", "Iscritto alle categorie protette (L. 68/99)")
          : evidence(requirement, "FAIL", "Non appartiene alle categorie protette");
      }
      case "EDUCATION": {
        const minLevel = str(params.minLevel) as EducationLevel | undefined;
        if (candidate.education.length === 0) return evidence(requirement, "UNKNOWN", "Titolo di studio non indicato");
        if (!minLevel) return evidence(requirement, "PASS", "Titolo di studio presente");
        const best = Math.max(...candidate.education.map((item) => EDUCATION_ORDER.indexOf(item.level)));
        return best >= EDUCATION_ORDER.indexOf(minLevel)
          ? evidence(requirement, "PASS", "Titolo di studio adeguato")
          : evidence(requirement, "FAIL", "Titolo di studio inferiore a quello richiesto");
      }
      case "LANGUAGE": {
        const language = str(params.language) ?? "";
        const minLevel = (str(params.minLevel) ?? "A1") as LanguageLevel;
        const known = candidate.languages.find((item) => same(item.language, language));
        if (!known) return evidence(requirement, "UNKNOWN", `${language}: non indicata nel profilo`);
        return LANGUAGE_ORDER.indexOf(known.level) >= LANGUAGE_ORDER.indexOf(minLevel)
          ? evidence(requirement, "PASS", `${language} ${known.level}`)
          : evidence(requirement, "FAIL", `${language} ${known.level}, richiesto almeno ${minLevel}`);
      }
      case "CERTIFICATION": {
        const name = str(params.name) ?? "";
        return candidate.certifications.some((item) => normalizeSkillName(item.name).includes(normalizeSkillName(name)))
          ? evidence(requirement, "PASS", `Certificazione ${name} presente`)
          : evidence(requirement, "UNKNOWN", `Certificazione ${name} non indicata`);
      }
      case "EXPERIENCE": {
        const minYears = num(params.minYears) ?? 0;
        if (candidate.experiences.length === 0) return evidence(requirement, "UNKNOWN", "Esperienze non indicate");
        const years = Math.floor(getTotalExperienceMonths(candidate.experiences) / 12);
        return years >= minYears
          ? evidence(requirement, "PASS", `${years} anni di esperienza`, { years })
          : evidence(requirement, "FAIL", `${years} anni di esperienza, richiesti ${minYears}`, { years });
      }
      case "SKILL": {
        const skill = str(params.skill) ?? "";
        const minYears = num(params.minYears);
        const found = candidate.skills.find((item) => item.skill.normalizedName === normalizeSkillName(skill));
        if (!found) return evidence(requirement, "UNKNOWN", `${skill}: competenza non indicata`);
        if (minYears !== undefined && found.yearsExperience !== null && found.yearsExperience < minYears) {
          return evidence(
            requirement,
            "REVIEW_REQUIRED",
            `${skill}: ${found.yearsExperience} anni, richiesti ${minYears}`,
          );
        }
        return evidence(
          requirement,
          found.verified ? "PASS" : "REVIEW_REQUIRED",
          found.verified ? skill : `${skill} (non verificata)`,
        );
      }
      case "SEMANTIC_SIMILARITY":
        return evidence(requirement, "UNKNOWN", "Similarità semantica non disponibile in questa versione");
    }
  },
};

/** Valuta un profilo su un insieme di requisiti: risultato spiegabile, nessun punteggio. */
export function evaluateCandidate(candidate: CandidateAggregate, requirements: MatchingRequirement[]): MatchingResult {
  const evidence = requirements.map((requirement) => hardFilterEvaluator.evaluate(candidate, requirement));
  return {
    candidateId: candidate.candidate.id,
    overallStatus: deriveOverallStatus(evidence, requirements),
    evidence,
    semanticSimilarity: null,
  };
}

/**
 * Testo del profilo da cui verrà calcolato l'embedding (futuro). Esclude
 * dati identificativi (nome, CF, contatti, data di nascita, L. 68/99).
 */
export function buildCandidateEmbeddingText(candidate: CandidateAggregate): { text: string; contentHash: string } {
  const parts = [
    candidate.profile.professionalSummary,
    ...candidate.experiences.map((item) => [item.roleTitle, item.sector, item.description].filter(Boolean).join(" · ")),
    ...candidate.skills.map((item) => item.skill.name),
    ...candidate.education.map((item) => [item.qualification, item.fieldOfStudy].filter(Boolean).join(" · ")),
    ...candidate.interests.map((item) => item.sector),
  ].filter((part): part is string => Boolean(part && part.trim()));
  const text = parts.join("\n");
  return { text, contentHash: createHash("sha256").update(text).digest("hex") };
}
