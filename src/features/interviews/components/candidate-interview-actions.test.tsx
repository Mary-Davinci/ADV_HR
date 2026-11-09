// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Interview } from "@/domain";
import { evaluateApplicationAction, recordCompletedInterviewAction } from "@/features/recruiting/server/actions";

import { InterviewReportActions, RegisterCompletedInterviewButton } from "./candidate-interview-actions";

vi.mock("@/features/recruiting/server/actions", () => ({
  recordCompletedInterviewAction: vi.fn(),
  evaluateApplicationAction: vi.fn(),
  addFeedbackAction: vi.fn(),
  changeStageAction: vi.fn(),
  scheduleInterviewAction: vi.fn(),
  updateInterviewAction: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const APPLICATION = "11e3484d-0af0-4021-8f83-986939f175bc";
const RECRUITER = "c945bccc-0245-4d9a-a15f-d5cdbd530cb9";

function withProvider(children: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      {children}
    </QueryClientProvider>,
  );
}

describe("candidate interview report actions", () => {
  it("requires a report and sends the completed interview to the selected candidate and position", async () => {
    vi.mocked(recordCompletedInterviewAction).mockResolvedValue({ ok: true, data: { id: "interview-1" } });
    const user = userEvent.setup();
    withProvider(
      <RegisterCompletedInterviewButton
        candidateId="candidate-1"
        candidateName="Mario Rossi"
        applications={[{ id: APPLICATION, label: "Operaio idraulico" }]}
        recruiters={[{ id: RECRUITER, displayName: "Recruiter HR" }]}
        defaultRecruiterId={RECRUITER}
        canEvaluate
      />,
    );
    await user.click(screen.getByRole("button", { name: "Registra colloquio svolto" }));
    await user.click(screen.getByRole("button", { name: "Salva nello storico" }));
    expect(await screen.findByText("Scrivi il resoconto del colloquio")).toBeInTheDocument();
    expect(recordCompletedInterviewAction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: /Resoconto del colloquio/ }), {
      target: { value: "Colloquio positivo sulla posizione di operaio idraulico." },
    });
    await user.click(screen.getByRole("button", { name: "Salva nello storico" }));
    await waitFor(() =>
      expect(recordCompletedInterviewAction).toHaveBeenCalledWith({
        candidateId: "candidate-1",
        values: expect.objectContaining({
          applicationId: APPLICATION,
          recruiterId: RECRUITER,
          notes: "Colloquio positivo sulla posizione di operaio idraulico.",
          result: "",
        }),
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  }, 15_000);

  it("links an outcome added from the history to that exact interview", async () => {
    vi.mocked(evaluateApplicationAction).mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    const interview: Interview = {
      id: "ba5da0ed-163b-4b58-8007-1433e6b8dded",
      applicationId: APPLICATION,
      scheduledAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      durationMinutes: 30,
      type: "HR",
      status: "COMPLETED",
      recruiterId: RECRUITER,
      location: null,
      meetingUrl: null,
      notes: "Resoconto",
    };
    withProvider(
      <InterviewReportActions interview={interview} candidateName="Mario Rossi" canEvaluate canFeedback={false} />,
    );
    await user.click(screen.getByRole("button", { name: "Registra esito" }));
    await user.click(screen.getByRole("button", { name: "Registra valutazione" }));
    await waitFor(() =>
      expect(evaluateApplicationAction).toHaveBeenCalledWith({
        applicationId: APPLICATION,
        values: expect.objectContaining({ interviewId: interview.id, result: "SUITABLE" }),
      }),
    );
  });
});
