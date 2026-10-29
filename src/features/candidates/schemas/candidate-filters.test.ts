import { describe, expect, it } from "vitest";

import {
  countAdvancedFilters,
  parseCandidateFilters,
  PENDING_REVIEW_FILTER,
  toCandidateSearchQuery,
  toSearchParams,
} from "./candidate-filters";
import { COLLECTION_SCHEMAS, identitySchema, preferencesSchema, trackingSchema } from "./profile-schemas";

// Mercoledì 30 settembre 2026, 10:00 ora locale.
const NOW = new Date(2026, 8, 30, 10, 0);

describe("candidate search filters (URL)", () => {
  it("parses structured filters", () => {
    const filters = parseCandidateFilters({
      q: "  rossi ",
      city: "Bergamo",
      skill: "excel",
      protected: "yes",
      license: "B",
      minExp: "3",
      workMode: "HYBRID",
      stage: "INTERVIEW_SCHEDULED",
    });
    expect(filters).toMatchObject({ q: "rossi", city: "Bergamo", protected: "yes", license: "B", minExp: 3 });
    expect(countAdvancedFilters(filters)).toBe(6);
  });

  it("maps policy, orientation and origin filters to the domain query", () => {
    const filters = parseCandidateFilters({ policy: "NONE", orientation: "yes", origin: "INDEED", region: "Calabria" });
    expect(countAdvancedFilters(filters)).toBe(4);
    expect(toCandidateSearchQuery(filters, NOW)).toMatchObject({
      activePolicy: "NONE",
      orientationCompleted: true,
      origin: "INDEED",
      region: "Calabria",
    });
    expect(parseCandidateFilters({ origin: "FACEBOOK", orientation: "forse" })).toMatchObject({
      origin: undefined,
      orientation: undefined,
    });
  });

  it("drops tampered values instead of failing or passing them to SQL", () => {
    const filters = parseCandidateFilters({
      stage: "x'; DROP TABLE candidates;--",
      recruiter: "../../etc",
      license: "Z",
      minExp: "999",
      protected: "maybe",
    });
    expect(filters.stage).toBeUndefined();
    expect(filters.recruiter).toBeUndefined();
    expect(filters.license).toBeUndefined();
    expect(filters.minExp).toBeUndefined();
    expect(filters.protected).toBeUndefined();
  });

  it("maps filters to the domain query", () => {
    const query = toCandidateSearchQuery(
      parseCandidateFilters({
        protected: "no",
        relocate: "yes",
        minExp: "2",
        stage: PENDING_REVIEW_FILTER,
        interview: "week",
        page: "3",
      }),
      NOW,
    );
    expect(query).toMatchObject({
      protectedCategory: false,
      willingToRelocate: true,
      minExperienceMonths: 24,
      stageCodes: ["NEW", "TO_REVIEW"],
      offset: 50,
      limit: 25,
    });
    expect(query.interviewFrom).toEqual(new Date(2026, 8, 28, 0, 0));
  });

  it("serialises only non-default values", () => {
    expect(toSearchParams({ q: "galli", sort: "updatedAt_desc", page: 1, city: undefined })).toBe("?q=galli");
  });
});

describe("candidate form schemas", () => {
  it("validates the tracking section (origin, orientation, activatable policies)", () => {
    expect(
      trackingSchema.parse({ origin: "LINKEDIN", orientationCompletedOn: "", activatablePolicies: ["DIL", "GOL"] }),
    ).toEqual({ origin: "LINKEDIN", orientationCompletedOn: null, activatablePolicies: ["DIL", "GOL"] });
    expect(
      trackingSchema.safeParse({ origin: "ADV_CORE", orientationCompletedOn: "2999-01-01", activatablePolicies: [] })
        .success,
    ).toBe(false);
    expect(
      trackingSchema.safeParse({ origin: "ADV_CORE", orientationCompletedOn: "", activatablePolicies: ["BONUS"] })
        .success,
    ).toBe(false);
  });

  it("normalises identity input and validates the fiscal code format", () => {
    const parsed = identitySchema.parse({
      firstName: " Martina ",
      lastName: "Galli",
      fiscalCode: "gllmtn94c52x000a",
      email: "",
      phone: "",
      birthDate: "1994-03-12",
      gender: "FEMALE",
    });
    expect(parsed).toMatchObject({ firstName: "Martina", fiscalCode: "GLLMTN94C52X000A", email: null, phone: null });

    const invalid = identitySchema.safeParse({
      firstName: "A",
      lastName: "B",
      fiscalCode: "123",
      email: "",
      phone: "",
      birthDate: "",
      gender: "MALE",
    });
    expect(invalid.error?.issues[0]?.message).toBe("Codice fiscale non valido");
  });

  it("rejects experiences ending before they start and clears end date for current roles", () => {
    const base = { companyName: "ACME", roleTitle: "Operatore", sector: "", description: "" };
    expect(
      COLLECTION_SCHEMAS.experiences.safeParse({
        ...base,
        startDate: "2024-05-01",
        endDate: "2023-01-01",
        currentRole: false,
      }).success,
    ).toBe(false);
    expect(
      COLLECTION_SCHEMAS.experiences.parse({
        ...base,
        startDate: "2024-05-01",
        endDate: "2025-01-01",
        currentRole: true,
      }).endDate,
    ).toBeNull();
  });

  it("converts tri-state and list preferences", () => {
    const parsed = preferencesSchema.parse({
      availability: "",
      desiredEmploymentType: "FULL_TIME",
      desiredWorkTime: "",
      desiredWorkMode: "HYBRID",
      willingToRelocate: "true",
      willingToTravel: "",
      preferredLocations: "Milano, , Bergamo ",
      availabilityNotes: "",
    });
    expect(parsed).toMatchObject({
      availability: null,
      willingToRelocate: true,
      willingToTravel: null,
      preferredLocations: ["Milano", "Bergamo"],
    });
  });
});
