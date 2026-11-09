import { endOfDay, startOfDay } from "date-fns";
import { describe, expect, it } from "vitest";

import { buildInterviewQuery, interviewFiltersSchema } from "./filters";

const NOW = new Date(2026, 10, 9, 10, 0);

describe("interview agenda filters", () => {
  it("opens on upcoming scheduled interviews with no upper date limit", () => {
    const query = buildInterviewQuery(interviewFiltersSchema.parse({}), NOW);
    expect(query).toMatchObject({ from: NOW, statuses: ["SCHEDULED"], order: "asc", offset: 0 });
    expect(query.to).toBeUndefined();
  });

  it("keeps today and past views available", () => {
    expect(buildInterviewQuery(interviewFiltersSchema.parse({ view: "today" }), NOW)).toMatchObject({
      from: startOfDay(NOW),
      to: endOfDay(NOW),
    });
    expect(buildInterviewQuery(interviewFiltersSchema.parse({ view: "past" }), NOW)).toMatchObject({
      concludedBy: NOW,
      order: "desc",
    });
  });

  it("searches a specific day with the selected filters and no implicit scheduled status", () => {
    const recruiter = "9ce3351b-109f-4a3f-9df1-4fd636f10fdc";
    const day = new Date(2026, 10, 12);
    expect(buildInterviewQuery(interviewFiltersSchema.parse({ date: "2026-11-12", recruiter }), NOW)).toMatchObject({
      from: startOfDay(day),
      to: endOfDay(day),
      recruiterId: recruiter,
      statuses: undefined,
    });
    expect(buildInterviewQuery(interviewFiltersSchema.parse({ status: "COMPLETED" }), NOW).statuses).toEqual([
      "COMPLETED",
    ]);
  });

  it("ignores invalid URL values and falls back to upcoming interviews", () => {
    const filters = interviewFiltersSchema.parse({ view: "invalid", date: "invalid", status: "invalid", page: "-1" });
    expect(buildInterviewQuery(filters, NOW)).toMatchObject({ from: NOW, statuses: ["SCHEDULED"], offset: 0 });
  });
});
