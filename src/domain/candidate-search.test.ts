import { describe, expect, it } from "vitest";

import { professionSearchStem } from "./candidate";

describe("professionSearchStem", () => {
  it("drops the ending so singular, plural and compounds match", () => {
    expect(professionSearchStem("Idraulico")).toBe("idraulic");
    expect(professionSearchStem("idrauliche")).toBe("idraulic");
    expect(professionSearchStem("Elettricista")).toBe("elettricist");
    expect(professionSearchStem("magazzinieri")).toBe("magazzinier");
    expect(professionSearchStem("Università")).toBe("universit");
  });

  it("keeps short or non-alphabetic terms unchanged", () => {
    expect(professionSearchStem("CNC")).toBe("cnc");
    expect(professionSearchStem("bar")).toBe("bar");
    expect(professionSearchStem("C++")).toBe("c++");
    expect(professionSearchStem("100%")).toBe("100%");
  });
});
