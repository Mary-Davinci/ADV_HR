import { describe, expect, it } from "vitest";

import { parsePositionMatchFilters } from "@/domain/position-screening";
import { positionKeywords } from "./position-keywords";

describe("position screening criteria", () => {
  it("uses the JD to specialize a generic designer title without treating software tools as the sector", () => {
    const { screening } = positionKeywords({
      titles: ["Progettista"],
      requirements: ["Conoscenza software Autocad. Progettazione di impianti elettrici e termoidraulici."],
    });
    expect(screening.functionLabels).toEqual(["Progettazione"]);
    expect(screening.domainLabels).toEqual(["Elettrico", "Termoidraulico"]);
    expect(screening.domains.map((domain) => domain.label)).not.toContain("Software");
  });

  it("preserves an explicit profession instead of replacing it with an incidental activity in the JD", () => {
    const { screening } = positionKeywords({ titles: ["Saldatore"], requirements: ["Manutenzione ordinaria"] });
    expect(screening.functionLabels).toEqual(["saldatore"]);
  });

  it("keeps the explicit electrical sector when the JD mentions work in construction", () => {
    expect(
      positionKeywords({ titles: ["Progettista elettrico"], requirements: ["Progetti per edilizia residenziale"] })
        .screening.domainLabels,
    ).toEqual(["Elettrico"]);
  });

  it("ignores unknown filter flags and resolves mutually exclusive flags", () => {
    expect(parsePositionMatchFilters({ match: "license,unknown,policy,noPolicy", matchRegion: " Lombardia " })).toEqual(
      {
        region: "Lombardia",
        flags: ["license", "policy"],
      },
    );
  });
});
