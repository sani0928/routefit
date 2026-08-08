"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from "react";
import {
  clampMobileSheetHeight,
  getMobileSheetStageHeights,
  getNearestMobileSheetState,
  stepMobileSheetState,
  type MobileSheetState,
} from "@/lib/mobile-sheet";

export type MobileTab = "places" | "lists" | "results";
export type { MobileSheetState } from "@/lib/mobile-sheet";

type MobileSheetDrag = {
  startX: number;
  startY: number;
  sheetState: MobileSheetState;
  startHeight: number;
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
const KEYBOARD_OPEN_THRESHOLD = 120;

function getIosStandaloneScreenHeight() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  if (iosNavigator.standalone !== true) return 0;

  // A translucent iOS standalone status bar can make every viewport API omit
  // a portion of the physical display. screen.height is reliable in this mode.
  return Math.round(Math.max(window.screen.height, window.screen.availHeight));
}

function getSheetStageHeights() {
  const root = document.documentElement;
  const layoutViewportHeight = Number.parseFloat(root.style.getPropertyValue("--mobile-layout-viewport-height")) || window.innerHeight;
  const navHeight = document.querySelector<HTMLElement>(".mobile-bottom-nav")?.getBoundingClientRect().height ?? 64;
  return getMobileSheetStageHeights(layoutViewportHeight, navHeight);
}

function clampSheetHeight(height: number) {
  return clampMobileSheetHeight(height, getSheetStageHeights());
}

function getNearestSheetState(height: number): MobileSheetState {
  return getNearestMobileSheetState(height, getSheetStageHeights());
}
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
  const [mobileSheetDragging, setMobileSheetDragging] = useState(false);
  const dragRef = useRef<MobileSheetDrag | null>(null);
  const dragPreviewClearFrameRef = useRef<number | null>(null);
  const stableViewportRef = useRef({ width: 0, height: 0 });

  const dragPreviewFrameRef = useRef<number | null>(null);
  const pendingDragPreviewHeightRef = useRef<number | null>(null);
  const dragPreviewActiveRef = useRef(false);

  const cancelDeferredPreviewClear = useCallback(() => {
    if (dragPreviewClearFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPreviewClearFrameRef.current);
      dragPreviewClearFrameRef.current = null;
    }
  }, []);

  const commitDragPreview = useCallback((height: number) => {
    if (dragPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }
    pendingDragPreviewHeightRef.current = null;
    document.documentElement.style.setProperty("--mobile-sheet-drag-height", `${Math.round(height)}px`);
  }, []);

  const showDragPreview = useCallback((height: number) => {
    cancelDeferredPreviewClear();
    pendingDragPreviewHeightRef.current = height;

    if (!dragPreviewActiveRef.current) {
      dragPreviewActiveRef.current = true;
      setMobileSheetDragging(true);
    }

    if (dragPreviewFrameRef.current !== null) return;
    dragPreviewFrameRef.current = window.requestAnimationFrame(() => {
      dragPreviewFrameRef.current = null;
      const nextHeight = pendingDragPreviewHeightRef.current;
      if (nextHeight === null) return;
      pendingDragPreviewHeightRef.current = null;
      document.documentElement.style.setProperty("--mobile-sheet-drag-height", `${Math.round(nextHeight)}px`);
    });
  }, [cancelDeferredPreviewClear]);

  const clearDragPreview = useCallback(() => {
    cancelDeferredPreviewClear();
    if (dragPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPreviewFrameRef.current);
      dragPreviewFrameRef.current = null;
    }
    pendingDragPreviewHeightRef.current = null;
    dragPreviewActiveRef.current = false;
    document.documentElement.style.removeProperty("--mobile-sheet-drag-height");
    setMobileSheetDragging(false);
  }, [cancelDeferredPreviewClear]);

  const deferDragPreviewClear = useCallback(() => {
    cancelDeferredPreviewClear();
    dragPreviewClearFrameRef.current = window.requestAnimationFrame(() => {
      dragPreviewActiveRef.current = false;
      setMobileSheetDragging(false);
      dragPreviewClearFrameRef.current = window.requestAnimationFrame(() => {
        dragPreviewClearFrameRef.current = null;
        document.documentElement.style.removeProperty("--mobile-sheet-drag-height");
      });
    });
  }, [cancelDeferredPreviewClear]);

  useEffect(() => {
    if (!isMobileViewport()) return;
    const frame = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => window.cancelAnimationFrame(frame);
  }, [mobileSheetState]);

  useEffect(() => {
    if (!isMobileViewport()) return;

    const preventNestedScroll = (event: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.inputSource !== "touch" || event.touches.length !== 1 || !event.cancelable) return;
      if (!(event.target instanceof Element) || !event.target.closest(".mobile-sheet-panel, .map-list-manager")) return;
      if (event.target.closest(".drag-handle:not(.placeholder):not(.disabled)")) return;

      const touch = Array.from(event.touches).find((item) => item.identifier === drag.pointerId);
      if (!touch) return;
      const verticalDistance = touch.clientY - drag.startY;
      const horizontalDistance = touch.clientX - drag.startX;
      if (Math.abs(horizontalDistance) > Math.abs(verticalDistance)) return;

      const expandsSheet = drag.sheetState === "peek";
      const collapsesExpandedSheet = drag.sheetState === "expanded"
        && verticalDistance > 0
        && (drag.fromHandle || drag.scrollContainers.every((container) => container.scrollTop <= 1));
      if (expandsSheet || collapsesExpandedSheet) event.preventDefault();
    };

    document.addEventListener("touchmove", preventNestedScroll, { passive: false });
    return () => document.removeEventListener("touchmove", preventNestedScroll);
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
        root.style.removeProperty("--mobile-layout-viewport-height");
        root.style.removeProperty("--mobile-keyboard-height");
        root.removeAttribute("data-mobile-keyboard-open");
        stableViewportRef.current = { width: 0, height: 0 };
        return;
      }

      const width = Math.round(visualViewport?.width ?? window.innerWidth);
      const visibleHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      // In iOS installed fullscreen mode, visualViewport can exclude the transparent
      // system-bar area while the layout viewport still occupies the full screen.
      // Keep the sheet layout aligned with that full layout viewport; only the
      // visual viewport should shrink when the keyboard is open.
      const layoutViewportHeight = Math.round(Math.max(
        visibleHeight,
        window.innerHeight,
        document.documentElement.clientHeight,
        getIosStandaloneScreenHeight(),
      ));
      const viewportChanged = stableViewportRef.current.width !== width;

      if (viewportChanged || layoutViewportHeight > stableViewportRef.current.height) {
        stableViewportRef.current = { width, height: layoutViewportHeight };
      }

      const layoutHeight = stableViewportRef.current.height || layoutViewportHeight;
      const keyboardHeight = Math.max(0, layoutHeight - visibleHeight);
      const keyboardOpen = keyboardHeight >= KEYBOARD_OPEN_THRESHOLD;
      root.style.setProperty("--mobile-visual-viewport-height", `${visibleHeight}px`);
      // iOS already moves fixed elements above its keyboard. Repositioning them
      // by the keyboard height causes a second, incorrect offset. Only switch
      // the layout sizing basis to the visible viewport while typing.
      root.style.setProperty("--mobile-layout-viewport-height", `${keyboardOpen ? visibleHeight : layoutHeight}px`);
      root.style.setProperty("--mobile-keyboard-height", `${keyboardHeight}px`);
      root.toggleAttribute("data-mobile-keyboard-open", keyboardOpen);
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
      root.style.removeProperty("--mobile-layout-viewport-height");
      root.style.removeProperty("--mobile-keyboard-height");
      root.removeAttribute("data-mobile-keyboard-open");
    };
  }, []);

  const stepMobileSheet = useCallback((direction: "up" | "down") => {
    setMobileSheetState((current) => stepMobileSheetState(current, direction));
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

  const beginDrag = useCallback((input: Omit<MobileSheetDrag, "claimed" | "scrollContainers" | "startHeight"> & { target: EventTarget | null; sheet: HTMLElement }) => {
    if (!isMobileViewport()) return;
    if (document.documentElement.hasAttribute("data-mobile-keyboard-open")) return;
    if (!input.fromHandle && input.sheetState !== "peek" && isInteractiveTarget(input.target)) return;

    dragRef.current = {
      startX: input.startX,
      startY: input.startY,
      sheetState: input.sheetState,
      startHeight: getSheetStageHeights()[input.sheetState],
      scrollContainers: input.fromHandle ? [] : findScrollableAncestors(input.target, input.sheet),
      pointerId: input.pointerId,
      inputSource: input.inputSource,
      fromHandle: input.fromHandle,
      claimed: false,
    };
  }, []);

  const moveDrag = useCallback((clientX: number, clientY: number, preventDefault: () => void, pointerId: number, inputSource: MobileSheetDrag["inputSource"]) => {
    const drag = dragRef.current;
    if (!drag || drag.inputSource !== inputSource || drag.pointerId !== pointerId) return false;

    const distance = clientY - drag.startY;
    const horizontalDistance = clientX - drag.startX;
    if (!drag.claimed && Math.abs(horizontalDistance) > Math.abs(distance)) return false;
    if (!drag.claimed && Math.abs(distance) >= DRAG_CLAIM_DISTANCE) {
      const direction = distance < 0 ? "up" : "down";
      if (!canClaimDrag(drag, direction)) return false;
      drag.claimed = true;
    }

    if (drag.claimed) {
      showDragPreview(clampSheetHeight(drag.startHeight - distance));
      preventDefault();
      return true;
    }

    return false;
  }, [canClaimDrag, showDragPreview]);

  const endDrag = useCallback((clientY: number, pointerId: number, inputSource: MobileSheetDrag["inputSource"]) => {
    const drag = dragRef.current;
    if (!drag || drag.inputSource !== inputSource || drag.pointerId !== pointerId) return;
    dragRef.current = null;

    const distance = clientY - drag.startY;
    if (!drag.claimed) {
      if (drag.fromHandle && Math.abs(distance) < HANDLE_TAP_DISTANCE) cycleMobileSheet();
      return;
    }

    const finalHeight = clampSheetHeight(drag.startHeight - distance);
    const nextSheetState = getNearestSheetState(finalHeight);
    commitDragPreview(getSheetStageHeights()[nextSheetState]);
    setMobileSheetState(nextSheetState);
    deferDragPreviewClear();
  }, [commitDragPreview, cycleMobileSheet, deferDragPreviewClear]);

  const cancelDrag = useCallback((inputSource?: MobileSheetDrag["inputSource"]) => {
    if (!inputSource || dragRef.current?.inputSource === inputSource) {
      dragRef.current = null;
      clearDragPreview();
    }
  }, [clearDragPreview]);

  const onSheetPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.pointerType === "touch") return;
    beginDrag({
      startX: event.clientX,
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
    if (moveDrag(event.clientX, event.clientY, () => event.preventDefault(), event.pointerId, "pointer")) {
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
      startX: event.clientX,
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
    if (event.target instanceof Element && event.target.closest(".drag-handle:not(.placeholder):not(.disabled)")) return;
    const touch = event.touches[0];
    const fromHandle = event.target instanceof Element && Boolean(event.target.closest(".mobile-sheet-handle"));
    beginDrag({
      startX: touch.clientX,
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
    moveDrag(touch.clientX, touch.clientY, () => undefined, touch.identifier, "touch");
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
    mobileSheetDragging,
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
