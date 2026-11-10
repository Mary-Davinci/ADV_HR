// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { InterviewHistoryView } from "@/repositories/types";

import { InterviewsTable } from "./interviews-table";

afterEach(cleanup);

const NOW = new Date("2026-11-10T10:00:00Z");
const historical: InterviewHistoryView = {
  id: "historical-result",
  source: "EVALUATION",
  occurredAt: new Date("2026-11-05T16:47:00Z"),
  type: null,
  status: null,
  notes: "Esito della prima fase",
  outcome: "SUITABLE",
  candidate: { id: "candidate-1", fullName: "Davide De Filippis" },
  selection: { id: "selection-1", title: "Prima selezione" },
  company: { id: "company-1", name: "Azienda" },
  recruiter: { id: "recruiter-1", displayName: "Recruiter" },
};

describe("interview history", () => {
  it.each([
    ["SUITABLE", "Idoneo"],
    ["NOT_SUITABLE", "Non idoneo"],
  ] as const)("shows the historical %s outcome on desktop and mobile", (outcome, label) => {
    render(<InterviewsTable items={[{ ...historical, outcome }]} done now={NOW} />);
    expect(screen.getAllByText(label)).toHaveLength(2);
    expect(screen.getAllByText(/^Valutazione(?: ·|$)/)).toHaveLength(2);
    expect(screen.getByText("Esito registrato")).toBeInTheDocument();
    expect(screen.getAllByText(historical.notes!)).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: historical.candidate.fullName })) {
      expect(link).toHaveAttribute("href", "/recruiting/candidate-1?tab=applications");
    }
    expect(screen.queryByText("Programmato")).not.toBeInTheDocument();
  });

  it("distinguishes a past scheduled interview with no recorded outcome", () => {
    render(
      <InterviewsTable
        items={[
          {
            ...historical,
            source: "INTERVIEW",
            type: "HR",
            status: "SCHEDULED",
            outcome: null,
          },
        ]}
        done
        now={NOW}
      />,
    );
    expect(screen.getAllByText("Esito da registrare")).toHaveLength(2);
    expect(screen.queryByText("Esito registrato")).not.toBeInTheDocument();
  });
});
