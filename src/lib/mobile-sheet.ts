export type MobileSheetState = "collapsed" | "peek" | "expanded";

export const COLLAPSED_SHEET_HEIGHT = 44;

export function getMobileSheetStageHeights(layoutViewportHeight: number, navigationHeight: number): Record<MobileSheetState, number> {
  const peek = Math.min(layoutViewportHeight * 0.48, 430);
  const expandedMapPeek = Math.min(96, Math.max(72, layoutViewportHeight * 0.1));

  return {
    collapsed: COLLAPSED_SHEET_HEIGHT,
    peek,
    expanded: Math.max(peek, layoutViewportHeight - navigationHeight - expandedMapPeek),
  };
}

export function clampMobileSheetHeight(height: number, stages: Record<MobileSheetState, number>) {
  return Math.min(stages.expanded, Math.max(stages.collapsed, height));
}

export function getNearestMobileSheetState(height: number, stages: Record<MobileSheetState, number>): MobileSheetState {
  return (Object.entries(stages) as Array<[MobileSheetState, number]>).reduce((nearest, candidate) => (
    Math.abs(candidate[1] - height) < Math.abs(nearest[1] - height) ? candidate : nearest
  ))[0];
}

export function stepMobileSheetState(state: MobileSheetState, direction: "up" | "down"): MobileSheetState {
  if (direction === "up") return state === "collapsed" ? "peek" : "expanded";
  return state === "expanded" ? "peek" : "collapsed";
}
