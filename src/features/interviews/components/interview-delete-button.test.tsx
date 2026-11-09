// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { removeInterviewAction } from "@/features/recruiting/server/actions";

import { InterviewDeleteButton } from "./interview-delete-button";

vi.mock("@/features/recruiting/server/actions", () => ({ removeInterviewAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(removeInterviewAction).mockReset();
});

function renderButton() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InterviewDeleteButton interviewId="interview-1" candidateName="Mario Rossi" />
    </QueryClientProvider>,
  );
}

describe("InterviewDeleteButton", () => {
  it("asks for confirmation and leaves the interview intact when cancelled", async () => {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: "Elimina colloquio con Mario Rossi" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Il colloquio verrà eliminato, vuoi procedere?");
    expect(removeInterviewAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(removeInterviewAction).not.toHaveBeenCalled();
  });

  it("deletes the selected interview only after confirmation", async () => {
    vi.mocked(removeInterviewAction).mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole("button", { name: "Elimina colloquio con Mario Rossi" }));
    await user.click(screen.getByRole("button", { name: "Elimina" }));
    await waitFor(() => expect(removeInterviewAction).toHaveBeenCalledExactlyOnceWith({ interviewId: "interview-1" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
