import { describe, expect, it } from "vitest";

import type { RecruitingStage } from "@/domain";

import { stagePath } from "./stage-path";

const stage = (code: string, position: number, isTerminal = false, active = true): RecruitingStage => ({
  id: code,
  code,
  label: code,
  position,
  active,
  isTerminal,
});
const STAGES = [
  stage("NEW", 10),
  stage("TO_REVIEW", 20),
  stage("INTERVIEWED", 50),
  stage("OLD", 55, false, false),
  stage("SELECTED", 70, true),
  stage("REJECTED", 80, true),
  stage("ON_HOLD", 90),
];

describe("stagePath", () => {
  it("costruisce il percorso dalle fasi attive prima degli esiti finali", () => {
    const path = stagePath(STAGES, STAGES[1]!);
    expect(path.steps.map((item) => item.code)).toEqual(["NEW", "TO_REVIEW", "INTERVIEWED"]);
    expect(path).toMatchObject({ currentIndex: 1, outcome: null, aside: null, next: { code: "INTERVIEWED" } });
  });

  it("all'ultima fase non propone un passo successivo", () => {
    expect(stagePath(STAGES, STAGES[2]!).next).toBeNull();
  });

  it("distingue esiti finali e fasi fuori percorso", () => {
    expect(stagePath(STAGES, STAGES[5]!)).toMatchObject({
      currentIndex: -1,
      outcome: { code: "REJECTED" },
      next: null,
    });
    expect(stagePath(STAGES, STAGES[6]!)).toMatchObject({ currentIndex: -1, aside: { code: "ON_HOLD" }, next: null });
  });
});
