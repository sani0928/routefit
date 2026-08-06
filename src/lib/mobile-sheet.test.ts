import { describe, expect, it } from "vitest";
import {
  clampMobileSheetHeight,
  getMobileSheetStageHeights,
  getNearestMobileSheetState,
  stepMobileSheetState,
} from "./mobile-sheet";

describe("mobile sheet layout", () => {
  const stages = getMobileSheetStageHeights(800, 64);

  it("keeps the peek height and visible map area within the configured bounds", () => {
    expect(stages).toEqual({ collapsed: 44, peek: 384, expanded: 656 });
    expect(getMobileSheetStageHeights(1_200, 64).peek).toBe(430);
  });

  it("clamps live drag heights to the collapsed and expanded limits", () => {
    expect(clampMobileSheetHeight(-10, stages)).toBe(stages.collapsed);
    expect(clampMobileSheetHeight(999, stages)).toBe(stages.expanded);
  });

  it("snaps a released drag to its nearest stage", () => {
    expect(getNearestMobileSheetState(90, stages)).toBe("collapsed");
    expect(getNearestMobileSheetState(350, stages)).toBe("peek");
    expect(getNearestMobileSheetState(600, stages)).toBe("expanded");
  });

  it("moves through the expected stages for keyboard and handle actions", () => {
    expect(stepMobileSheetState("collapsed", "up")).toBe("peek");
    expect(stepMobileSheetState("peek", "up")).toBe("expanded");
    expect(stepMobileSheetState("expanded", "down")).toBe("peek");
    expect(stepMobileSheetState("peek", "down")).toBe("collapsed");
  });
});