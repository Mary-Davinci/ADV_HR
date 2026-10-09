// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SearchInput } from "./search-input";

function ControlledSearch() {
  const [value, setValue] = useState("");
  return <SearchInput value={value} onValueChange={setValue} label="Cerca candidati" />;
}

describe("SearchInput", () => {
  it("is reachable by its accessible label and can be cleared", async () => {
    const user = userEvent.setup();
    render(<ControlledSearch />);

    const input = screen.getByRole("searchbox", { name: "Cerca candidati" });
    expect(screen.queryByRole("button", { name: "Cancella ricerca" })).not.toBeInTheDocument();

    await user.type(input, "Galli");
    expect(input).toHaveValue("Galli");

    await user.click(screen.getByRole("button", { name: "Cancella ricerca" }));
    expect(input).toHaveValue("");
  });
});
