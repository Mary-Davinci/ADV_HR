import { endOfDay, startOfDay } from "date-fns";
import { describe, expect, it } from "vitest";

import { buildInterviewQuery, interviewFiltersSchema } from "./filters";

const NOW = new Date(2026, 10, 10, 12, 0);

describe("interview filters", () => {
  it("opens on interviews still to hold: scheduled after now, soonest first", () => {
    expect(buildInterviewQuery(interviewFiltersSchema.parse({}), NOW)).toMatchObject({
      statuses: ["SCHEDULED"],
      scheduledAfter: NOW,
      order: "asc",
      offset: 0,
    });
  });

  it("lists everything already past as done, even if the status was never updated", () => {
    const query = buildInterviewQuery(interviewFiltersSchema.parse({ view: "done" }), NOW);
    expect(query).toMatchObject({ concludedBy: NOW, order: "desc" });
    expect(query.statuses).toBeUndefined();
  });

  it("keeps old links working", () => {
    expect(interviewFiltersSchema.parse({ view: "today" }).view).toBe("todo");
    expect(interviewFiltersSchema.parse({ view: "upcoming" }).view).toBe("todo");
    expect(interviewFiltersSchema.parse({ view: "past" }).view).toBe("done");
  });

  it("combines search, recruiter and a specific day", () => {
    const recruiter = "9ce3351b-109f-4a3f-9df1-4fd636f10fdc";
    const day = new Date(2026, 10, 12);
    expect(
      buildInterviewQuery(
        interviewFiltersSchema.parse({ date: "2026-11-12", recruiter, q: " Rossi ", view: "done" }),
        NOW,
      ),
    ).toMatchObject({ from: startOfDay(day), to: endOfDay(day), recruiterId: recruiter, text: "Rossi" });
  });

  it("ignores invalid URL values", () => {
    const filters = interviewFiltersSchema.parse({ view: "invalid", date: "invalid", page: "-1" });
    expect(buildInterviewQuery(filters, NOW)).toMatchObject({ statuses: ["SCHEDULED"], offset: 0 });
  });
});
