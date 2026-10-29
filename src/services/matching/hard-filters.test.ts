import { describe, expect, it } from "vitest";

import { deriveOverallStatus, type MatchingRequirement } from "@/domain";
import type { CandidateAggregate } from "@/repositories/types";

import { buildCandidateEmbeddingText, evaluateCandidate } from "./hard-filters";

const candidate: CandidateAggregate = {
  candidate: {
    id: "c1",
    firstName: "Mario",
    lastName: "Esempio",
    fiscalCode: "XXXXXX00X00X000X",
    email: "mario@example.test",
    phone: null,
    birthDate: "1990-01-01",
    gender: "MALE",
    origin: "MANUAL",
    orientationCompletedOn: null,
    activatablePolicies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  profile: {
    candidateId: "c1",
    residenceAddress: null,
    residenceCity: "Bergamo",
    residenceProvince: "BG",
    residenceRegion: "Lombardia",
    residenceCountry: "IT",
    protectedCategory: "NONE",
    protectedCategoryNotes: null,
    employmentStatus: "UNEMPLOYED",
    professionalSummary: "Sviluppatore Java",
    lastReviewedAt: null,
    updatedAt: new Date(),
  },
  preferences: {
    candidateId: "c1",
    availability: null,
    desiredEmploymentType: null,
    desiredWorkTime: "FULL_TIME",
    desiredWorkMode: "HYBRID",
    willingToRelocate: false,
    willingToTravel: null,
    preferredLocations: [],
    availabilityNotes: null,
    updatedAt: new Date(),
  },
  experiences: [
    {
      id: "e1",
      candidateId: "c1",
      companyName: "ACME",
      roleTitle: "Sviluppatore",
      sector: "IT",
      startDate: "2020-01-01",
      endDate: "2024-01-01",
      description: null,
      currentRole: false,
    },
  ],
  education: [],
  interests: [],
  skills: [
    {
      candidateId: "c1",
      skill: { id: "s1", name: "Java", category: "TECHNICAL", normalizedName: "java" },
      level: 4,
      yearsExperience: 4,
      verified: true,
      notes: null,
    },
  ],
  languages: [{ id: "l1", candidateId: "c1", language: "Inglese", level: "B1", certified: false, notes: null }],
  certifications: [],
  drivingLicenses: [{ id: "d1", candidateId: "c1", category: "B", valid: true, notes: null }],
  activePolicies: [],
  tags: [],
};

const req = (
  code: MatchingRequirement["code"],
  params: Record<string, unknown> = {},
  mandatory = true,
): MatchingRequirement => ({
  code,
  kind: "HARD_FILTER",
  mandatory,
  params,
  label: code,
});

describe("hard filter matching", () => {
  it("explains each requirement with PASS / FAIL / UNKNOWN / REVIEW_REQUIRED", () => {
    const result = evaluateCandidate(candidate, [
      req("SKILL", { skill: "Java" }),
      req("EXPERIENCE", { minYears: 4 }),
      req("DRIVING_LICENSE", { category: "B" }),
      req("LANGUAGE", { language: "inglese", minLevel: "B2" }, false),
      req("LOCATION", { city: "Milano" }, false),
      req("EDUCATION", { minLevel: "UPPER_SECONDARY" }, false),
    ]);
    expect(result.evidence.map((item) => item.status)).toEqual(["PASS", "PASS", "PASS", "FAIL", "FAIL", "UNKNOWN"]);
    expect(result.evidence[4]?.message).toContain("Milano");
    // Un requisito non obbligatorio non soddisfatto + un dato mancante → da verificare, non uno scarto.
    expect(result.overallStatus).toBe("TO_VERIFY");
  });

  it("never marks a candidate as incompatible because of missing data", () => {
    const result = evaluateCandidate(candidate, [req("CERTIFICATION", { name: "HACCP" }), req("SEMANTIC_SIMILARITY")]);
    expect(result.evidence.every((item) => item.status === "UNKNOWN")).toBe(true);
    expect(result.overallStatus).toBe("TO_VERIFY");
  });

  it("marks NOT_COMPATIBLE only when a mandatory requirement fails", () => {
    expect(
      deriveOverallStatus([{ requirementCode: "WORK_TIME", status: "FAIL" }], [{ code: "WORK_TIME", mandatory: true }]),
    ).toBe("NOT_COMPATIBLE");
    expect(
      deriveOverallStatus(
        [{ requirementCode: "WORK_TIME", status: "FAIL" }],
        [{ code: "WORK_TIME", mandatory: false }],
      ),
    ).toBe("PARTIAL");
    expect(
      deriveOverallStatus([{ requirementCode: "SKILL", status: "PASS" }], [{ code: "SKILL", mandatory: true }]),
    ).toBe("COHERENT");
  });

  it("builds embedding text without identifying personal data", () => {
    const { text, contentHash } = buildCandidateEmbeddingText(candidate);
    expect(text).toContain("Java");
    expect(text).not.toContain("Mario");
    expect(text).not.toContain("XXXXXX00X00X000X");
    expect(text).not.toContain("example.test");
    expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
