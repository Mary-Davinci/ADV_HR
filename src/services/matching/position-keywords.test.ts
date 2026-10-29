import { describe, expect, it } from "vitest";

import { positionKeywords } from "./position-keywords";

describe("positionKeywords", () => {
  it("takes the role from the title, dropping generic words and places", () => {
    const keywords = positionKeywords({
      titles: ["Addetto commerciale junior - Bergamo", "Commerciale estero"],
      requirements: ["Ottima conoscenza dell'inglese, CRM, esperienza commerciale"],
      places: ["Bergamo"],
    });
    expect(keywords.role).toEqual(["commerciale", "estero"]);
    expect(keywords.bonus).toEqual(["inglese", "crm"]);
  });

  it("deduplicates words with the same stem", () => {
    expect(positionKeywords({ titles: ["Elettricista / elettricisti"], requirements: [] }).role).toEqual([
      "elettricista",
    ]);
  });

  it("returns no role when the title has only generic words", () => {
    expect(positionKeywords({ titles: ["Ricerca personale"], requirements: [] }).role).toEqual(["personale"]);
    expect(positionKeywords({ titles: ["Addetto"], requirements: [] }).role).toEqual([]);
  });
});
