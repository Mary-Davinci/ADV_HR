import { describe, expect, it } from "vitest";

import { repeatsText } from "./repeats-text";

describe("repeatsText", () => {
  it("riconosce la stessa mansione scritta in due modi", () => {
    expect(
      repeatsText(
        "Manutenzione impianti idraulici, restauro e riparazione sedie in paglia",
        "Manutentore impianti idraulici - restauratore sedie in paglia di Vienna",
      ),
    ).toBe(true);
    expect(repeatsText("EDUCATRICE", "Educatrice per l'infanzia")).toBe(true);
  });

  it("tiene separati testi che dicono cose diverse", () => {
    expect(repeatsText("EDUCATRICE", "Professioni qualificate nelle attività commerciali e nei servizi")).toBe(false);
    expect(repeatsText("Magazziniere", "Carrellista con esperienza nella logistica del freddo")).toBe(false);
    expect(repeatsText("", "Qualsiasi testo")).toBe(false);
  });
});
