"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from "react";

export type MobileTab = "places" | "lists" | "results";
export type MobileSheetState = "collapsed" | "peek" | "expanded";

type MobileSheetDrag = {
  startY: number;
  sheetState: MobileSheetState;
  scrollContainers: HTMLElement[];
  pointerId: number;
  inputSource: "pointer" | "touch";
  fromHandle: boolean;
  claimed: boolean;
};

const MOBILE_QUERY = "(max-width: 700px)";
const DRAG_CLAIM_DISTANCE = 10;
const DRAG_COMMIT_DISTANCE = 42;
const HANDLE_TAP_DISTANCE = 18;

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, input, textarea, select, a, [role=button], [contenteditable=true]"));
}

function findScrollableAncestors(target: EventTarget | null, sheet: HTMLElement) {
  const scrollContainers: HTMLElement[] = [];
  let element = target instanceof HTMLElement ? target : null;

  while (element) {
    const overflowY = window.getComputedStyle(element).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight) {
      scrollContainers.push(element);
    }
    if (element === sheet) break;
    element = element.parentElement;
  }

  return scrollContainers;
}

export function useMobileSheetController(initialTab: MobileTab = "places") {
  const [mobileTab, setMobileTab] = useState<MobileTab>(initialTab);
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>("collapsed");
  const dragRef = useRef<MobileSheetDrag | null>(null);

  useEffect(() => {
    if (!isMobileViewport()) return;
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => window.cancelAnimationFrame(frame);
  }, [mobileSheetState]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener(listener: (event: MediaQueryListEvent) => void): void;
      removeListener(listener: (event: MediaQueryListEvent) => void): void;
    };
    const root = document.documentElement;
    const visualViewport = window.visualViewport;

    const syncVisibleViewport = () => {
      if (!mediaQuery.matches) {
        root.style.removeProperty("--mobile-visual-viewport-height");
        return;
      }

      const height = Math.round(visualViewport?.height ?? window.innerHeight);
      root.style.setProperty("--mobile-visual-viewport-height", `${height}px`);
    };

    syncVisibleViewport();
    visualViewport?.addEventListener("resize", syncVisibleViewport);
    visualViewport?.addEventListener("scroll", syncVisibleViewport);
    window.addEventListener("resize", syncVisibleViewport);
    if ("addEventListener" in mediaQuery) mediaQuery.addEventListener("change", syncVisibleViewport);
    else legacyMediaQuery.addListener(syncVisibleViewport);

    return () => {
      visualViewport?.removeEventListener("resize", syncVisibleViewport);
      visualViewport?.removeEventListener("scroll", syncVisibleViewport);
      window.removeEventListener("resize", syncVisibleViewport);
      if ("removeEventListener" in mediaQuery) mediaQuery.removeEventListener("change", syncVisibleViewport);
      else legacyMediaQuery.removeListener(syncVisibleViewport);
      root.style.removeProperty("--mobile-visual-viewport-height");
    };
  }, []);

  const stepMobileSheet = useCallback((direction: "up" | "down") => {
    setMobileSheetState((current) => {
      if (direction === "up") return current === "collapsed" ? "peek" : "expanded";
      return current === "expanded" ? "peek" : "collapsed";
    });
  }, []);

  const cycleMobileSheet = useCallback(() => {
    setMobileSheetState((current) => current === "collapsed" ? "peek" : current === "peek" ? "expanded" : "collapsed");
  }, []);

  const selectMobileTab = useCallback((nextTab: MobileTab) => {
    const isActiveTab = mobileTab === nextTab;
    setMobileTab(nextTab);
    setMobileSheetState((currentSheetState) => {
      if (!isActiveTab || currentSheetState === "collapsed") return "peek";
      return currentSheetState === "peek" ? "expanded" : "peek";
    });
  }, [mobileTab]);

  const prepareSearchFocus = useCallback(() => {
    if (!isMobileViewport()) return;
    setMobileSheetState((current) => current === "peek" ? "expanded" : current);
  }, []);

  const canClaimDrag = useCallback((drag: MobileSheetDrag, direction: "up" | "down") => {
    if (drag.fromHandle || drag.sheetState === "peek") return true;
    if (drag.sheetState === "collapsed") return false;
    if (direction === "up") return false;

    // 중첩된 목록과 시트 본문 모두 최상단일 때만 아래 스와이프를 시트 축소로 해석한다.
    return drag.scrollContainers.every((container) => container.scrollTop <= 1);
  }, []);

  const beginDrag = useCallback((input: Omit<MobileSheetDrag, "claimed" | "scrollContainers"> & { target: EventTarget | null; sheet: HTMLElement }) => {
    if (!isMobileViewport()) return;
    if (!input.fromHandle && input.sheetState !== "peek" && isInteractiveTarget(input.target)) return;

    dragRef.current = {
      startY: input.startY,
      sheetState: input.sheetState,
      scrollContainers: input.fromHandle ? [] : findScrollableAncestors(input.target, input.sheet),
      pointerId: input.pointerId,
      inputSource: input.inputSource,
      fromHandle: input.fromHandle,
      claimed: false,
    };
  }, []);

  const moveDrag = useCallback((clientY: number, preventDefault: () => void, pointerId: number, inputSource: MobileSheetDrag["inputSource"]) => {
    const drag = dragRef.current;
    if (!drag || drag.inputSource !== inputSource || drag.pointerId !== pointerId) return false;

    const distance = clientY - drag.startY;
    if (!drag.claimed && Math.abs(distance) >= DRAG_CLAIM_DISTANCE) {
      const direction = distance < 0 ? "up" : "down";
      if (!canClaimDrag(drag, direction)) return false;
      drag.claimed = true;
    }

    if (drag.claimed) {
      preventDefault();
      return true;
    }

    return false;
  }, [canClaimDrag]);

  const endDrag = useCallback((clientY: number, pointerId: number, inputSource: MobileSheetDrag["inputSource"]) => {
    const drag = dragRef.current;
    if (!drag || drag.inputSource !== inputSource || drag.pointerId !== pointerId) return;
    dragRef.current = null;

    const distance = clientY - drag.startY;
    if (!drag.claimed) {
      if (drag.fromHandle && Math.abs(distance) < HANDLE_TAP_DISTANCE) cycleMobileSheet();
      return;
    }

    if (Math.abs(distance) >= DRAG_COMMIT_DISTANCE) stepMobileSheet(distance < 0 ? "up" : "down");
  }, [cycleMobileSheet, stepMobileSheet]);

  const cancelDrag = useCallback((inputSource?: MobileSheetDrag["inputSource"]) => {
    if (!inputSource || dragRef.current?.inputSource === inputSource) dragRef.current = null;
  }, []);

  const onSheetPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.pointerType === "touch") return;
    beginDrag({
      startY: event.clientY,
      sheetState: mobileSheetState,
      pointerId: event.pointerId,
      inputSource: "pointer",
      fromHandle: false,
      target: event.target,
      sheet: event.currentTarget,
    });
  }, [beginDrag, mobileSheetState]);

  const onSheetPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    if (moveDrag(event.clientY, () => event.preventDefault(), event.pointerId, "pointer")) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }, [moveDrag]);

  const onSheetPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const hasCapture = event.currentTarget.hasPointerCapture(event.pointerId);
    endDrag(event.clientY, event.pointerId, "pointer");
    if (hasCapture) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [endDrag]);

  const onSheetPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") cancelDrag("pointer");
  }, [cancelDrag]);

  const onHandlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.pointerType === "touch") return;
    beginDrag({
      startY: event.clientY,
      sheetState: mobileSheetState,
      pointerId: event.pointerId,
      inputSource: "pointer",
      fromHandle: true,
      target: event.target,
      sheet: event.currentTarget.closest(".mobile-sheet-panel, .map-list-manager") ?? event.currentTarget,
    });
  }, [beginDrag, mobileSheetState]);

  const onSheetTouchStart = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const fromHandle = event.target instanceof Element && Boolean(event.target.closest(".mobile-sheet-handle"));
    beginDrag({
      startY: touch.clientY,
      sheetState: mobileSheetState,
      pointerId: touch.identifier,
      inputSource: "touch",
      fromHandle,
      target: event.target,
      sheet: event.currentTarget,
    });
  }, [beginDrag, mobileSheetState]);

  const onSheetTouchMove = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.inputSource !== "touch") return;
    const touch = Array.from(event.touches).find((item) => item.identifier === drag.pointerId);
    if (!touch) return;
    // React의 합성 touchmove는 passive일 수 있다. 스크롤 잠금은 상태별 touch-action으로 처리한다.
    moveDrag(touch.clientY, () => undefined, touch.identifier, "touch");
  }, [moveDrag]);

  const onSheetTouchEnd = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.inputSource !== "touch") return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === drag.pointerId);
    if (!touch) return;
    endDrag(touch.clientY, touch.identifier, "touch");
  }, [endDrag]);

  const sheetGestureHandlers = useMemo(() => ({
    onPointerDown: onSheetPointerDown,
    onPointerMove: onSheetPointerMove,
    onPointerUp: onSheetPointerUp,
    onPointerCancel: onSheetPointerCancel,
    onTouchStart: onSheetTouchStart,
    onTouchMove: onSheetTouchMove,
    onTouchEnd: onSheetTouchEnd,
    onTouchCancel: () => cancelDrag("touch"),
  }), [cancelDrag, onSheetPointerCancel, onSheetPointerDown, onSheetPointerMove, onSheetPointerUp, onSheetTouchEnd, onSheetTouchMove, onSheetTouchStart]);

  const handlePointerHandlers = useMemo(() => ({
    onPointerDown: onHandlePointerDown,
    onPointerMove: onSheetPointerMove,
    onPointerUp: onSheetPointerUp,
    onPointerCancel: onSheetPointerCancel,
  }), [onHandlePointerDown, onSheetPointerCancel, onSheetPointerMove, onSheetPointerUp]);

  return {
    mobileTab,
    mobileSheetState,
    setMobileTab,
    setMobileSheetState,
    selectMobileTab,
    prepareSearchFocus,
    stepMobileSheet,
    cycleMobileSheet,
    sheetGestureHandlers,
    handlePointerHandlers,
  };
}