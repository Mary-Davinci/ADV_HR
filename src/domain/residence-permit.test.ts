import { describe, expect, it } from "vitest";

import { needsResidencePermit } from "./candidate";

describe("permesso di soggiorno", () => {
  it("non serve ai cittadini italiani né a chi HR ha indicato come non necessario", () => {
    expect(needsResidencePermit({ nationality: "italiana", residencePermitStatus: null })).toBe(false);
    expect(needsResidencePermit({ nationality: " Italiana", residencePermitStatus: "VALID" })).toBe(false);
    expect(needsResidencePermit({ nationality: "Ucraina", residencePermitStatus: "NOT_REQUIRED" })).toBe(false);
  });

  it("serve per le altre nazionalità e quando la nazionalità non è indicata", () => {
    expect(needsResidencePermit({ nationality: "Ucraina", residencePermitStatus: null })).toBe(true);
    expect(needsResidencePermit({ nationality: null, residencePermitStatus: "PENDING" })).toBe(true);
  });
});
