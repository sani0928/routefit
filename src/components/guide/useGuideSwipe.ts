import { useRef, useState, type PointerEvent } from "react";

type PointerStart = { x: number; pointerId: number };

type GuidePointerDragOptions = {
  onStart?: (event: PointerEvent<HTMLDivElement>, start: PointerStart) => void;
  onMove?: (event: PointerEvent<HTMLDivElement>, start: PointerStart) => void;
  onEnd?: (event: PointerEvent<HTMLDivElement>, start: PointerStart) => void;
  onCancel?: () => void;
};

/** Shared pointer lifecycle for guide card gestures. */
export function useGuidePointerDrag(options: GuidePointerDragOptions) {
  const pointerRef = useRef<PointerStart | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const pointer = { x: event.clientX, pointerId: event.pointerId };
    pointerRef.current = pointer;
    event.currentTarget.setPointerCapture(event.pointerId);
    optionsRef.current.onStart?.(event, pointer);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    optionsRef.current.onMove?.(event, pointer);
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    pointerRef.current = null;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    optionsRef.current.onEnd?.(event, pointer);
  };
  const cancel = () => {
    pointerRef.current = null;
    optionsRef.current.onCancel?.();
  };

  return { handlers: { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: cancel } };
}

type GuideSwipeOptions = {
  getRevealWidth: () => number;
  threshold?: number;
};

/** Shared pointer gesture for horizontally revealing guide-card actions. */
export function useGuideSwipe({ getRevealWidth, threshold = 44 }: GuideSwipeOptions) {
  const [offset, setOffset] = useState(0);
  const pointerDrag = useGuidePointerDrag({
    onMove: (event, pointer) => {
    const revealWidth = getRevealWidth();
    setOffset(Math.max(-revealWidth, Math.min(0, event.clientX - pointer.x)));
    },
    onEnd: (event, pointer) => setOffset(event.clientX - pointer.x < -threshold ? -getRevealWidth() : 0),
    onCancel: () => setOffset(0),
  });

  return { offset, setOffset, handlers: pointerDrag.handlers };
}

