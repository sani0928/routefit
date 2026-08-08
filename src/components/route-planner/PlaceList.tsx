"use client";

import { DragDropProvider, KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { PointerActivationConstraints } from "@dnd-kit/dom";
import { useSortable } from "@dnd-kit/react/sortable";
import { Clock3, List, ListPlus, LocateFixed, Lock, LockOpen, RotateCcw, Square, SquareCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { FixedVisitOrder, Place } from "@/features/route-optimization/types/route.types";
import { notify } from "@/lib/notify";
import { ContentLoading } from "@/components/ui/ContentLoading";

interface Props {
  places: Place[];
  returnToStart: boolean;
  fixedVisitOrders: FixedVisitOrder[];
  onReturnChange: (value: boolean) => void;
  onReset: () => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, destinationIndex: number) => void;
  onStayDurationChange: (id: string, minutes: number) => void;
  onFixedVisitOrderChange: (placeId: string, visitOrder: number) => void;
  onSavePlace?: (place: Omit<Place, "id" | "type">) => void;
  currentLocationActive: boolean;
  currentLocationLocating: boolean;
  onCurrentLocationToggle: () => void;
  onSavedPlacesOpen?: () => void;
  onMobileInputFocus?: () => void;
  mobileSheetExpanded: boolean;
  isLoading?: boolean;
}

const sortableSensors = [
  PointerSensor.configure({
    activationConstraints(event) {
      if (event.pointerType !== "touch") return undefined;
      return [new PointerActivationConstraints.Delay({ value: 120, tolerance: 12 })];
    },
  }),
  KeyboardSensor,
];
type SortablePlaceItemProps = {
  place: Place;
  index: number;
  isStart: boolean;
  isDestination: boolean;
  canSetStayDuration: boolean;
  isOrderLocked: boolean;
  isSelected: boolean;
  isStayEditing: boolean;
  mobileSheetExpanded: boolean;
  isMobileViewportActive: boolean;
  onCardClick: (event: MouseEvent<HTMLElement>, place: Place) => void;
  onFixedVisitOrderChange: (placeId: string, visitOrder: number) => void;
  onSavePlace?: (place: Omit<Place, "id" | "type">) => void;
  onRemove: (id: string) => void;
  onStayDurationChange: (id: string, delta: number) => void;
  onMobileInputFocus?: () => void;
};

function SortablePlaceItem({
  place,
  index,
  isStart,
  isDestination,
  canSetStayDuration,
  isOrderLocked,
  isSelected,
  isStayEditing,
  mobileSheetExpanded,
  isMobileViewportActive,
  onCardClick,
  onFixedVisitOrderChange,
  onSavePlace,
  onRemove,
  onStayDurationChange,
  onMobileInputFocus,
}: SortablePlaceItemProps) {
  const mobileReorderDisabled = isMobileViewportActive && !mobileSheetExpanded;
  const dragDisabled = isDestination || mobileReorderDisabled;
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: place.id,
    index,
    disabled: dragDisabled,
    transition: { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)", idle: true },
  });
  const stayDuration = place.stayDurationMinutes ?? 0;
  const [stayInput, setStayInput] = useState(String(stayDuration));
  const [mobileSwipe, setMobileSwipe] = useState<"actions" | "stay" | null>(null);
  const itemRef = useRef<HTMLLIElement | null>(null);
  const latestStayDurationChangeRef = useRef(onStayDurationChange);
  const holdStartTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const swipeHandledRef = useRef(false);
  latestStayDurationChangeRef.current = onStayDurationChange;

  useEffect(() => {
    setStayInput(String(stayDuration));
  }, [stayDuration]);
  function closeMobileSwipe() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && itemRef.current?.contains(activeElement)) activeElement.blur();
    setMobileSwipe(null);
  }
  useEffect(() => {
    if (!mobileSwipe) return;

    const closeSwipeOnOutsidePointer = (event: PointerEvent) => {
      if (!itemRef.current?.contains(event.target as Node)) closeMobileSwipe();
    };

    document.addEventListener("pointerdown", closeSwipeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeSwipeOnOutsidePointer, true);
  }, [mobileSwipe]);

  useEffect(() => {
    if (isDragging) closeMobileSwipe();
  }, [isDragging]);

  function commitStayDuration() {
    const requestedMinutes = Number(stayInput);
    const nextMinutes = Number.isFinite(requestedMinutes)
      ? Math.min(1_440, Math.max(0, Math.trunc(requestedMinutes)))
      : stayDuration;

    if (nextMinutes !== stayDuration) onStayDurationChange(place.id, nextMinutes - stayDuration);
    setStayInput(String(nextMinutes));
  }

  function stopCardToggle(event: MouseEvent<HTMLButtonElement | HTMLDivElement>) {
    event.stopPropagation();
  }

  function applyStayStep(delta: number) {
    latestStayDurationChangeRef.current(place.id, delta);
  }

  function clearStayStepHold() {
    if (holdStartTimeoutRef.current !== null) {
      window.clearTimeout(holdStartTimeoutRef.current);
      holdStartTimeoutRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  function startStayStepHold(event: ReactPointerEvent<HTMLButtonElement>, delta: number) {
    event.stopPropagation();
    clearStayStepHold();
    applyStayStep(delta);
    event.currentTarget.setPointerCapture(event.pointerId);
    holdStartTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => applyStayStep(delta), 75);
    }, 350);
  }

  useEffect(() => clearStayStepHold, []);

  function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches;
  }

  function handleMobileSwipeStart(event: ReactPointerEvent<HTMLElement>) {
    if (!isMobileViewport() || event.pointerType === "mouse" || (event.target as HTMLElement).closest("button, input, .drag-handle, .place-stay-control")) return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMobileSwipeEnd(event: ReactPointerEvent<HTMLElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    const isHorizontalSwipe = Math.abs(horizontalDistance) > Math.abs(verticalDistance);
    const isClosingGesture = mobileSwipe === "actions"
      ? horizontalDistance >= 18
      : mobileSwipe === "stay" && horizontalDistance <= -18;

    if (isClosingGesture || Math.abs(horizontalDistance) < 18 || !isHorizontalSwipe) {
      if (mobileSwipe) closeMobileSwipe();
      return;
    }

    if (Math.abs(horizontalDistance) < 44) return;

    const nextSwipe = horizontalDistance < 0 ? "actions" : canSetStayDuration ? "stay" : null;
    swipeHandledRef.current = true;
    setMobileSwipe((current) => current === nextSwipe ? null : nextSwipe);
  }

  return (
    <li
      ref={(node) => {
        itemRef.current = node;
        ref(node);
      }}
      className={`sortable-place-item${isDragging ? " dragging" : ""}${isDropTarget && !isDragging ? " dnd-drop-target" : ""}${mobileSwipe ? ` mobile-swipe-${mobileSwipe}` : ""}`}
      onPointerDownCapture={handleMobileSwipeStart}
      onPointerUpCapture={handleMobileSwipeEnd}
      onPointerCancelCapture={() => { swipeStartRef.current = null; }}
    >
      <div
        className={`place-item draggable${place.isCurrentLocation ? " current-location-stop" : ""}${isDragging ? " dragging" : ""}${isDropTarget && !isDragging ? " dnd-drop-target" : ""}${isSelected ? " selected-place" : ""}${isStayEditing ? " editing-stay" : ""}${canSetStayDuration && stayDuration > 0 ? " has-stay-duration" : ""}${mobileSwipe ? ` mobile-swipe-${mobileSwipe}` : ""}`}

        onClick={(event) => {
          if (swipeHandledRef.current) {
            swipeHandledRef.current = false;
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (isMobileViewport()) return;
          onCardClick(event, place);
        }}
      >
        <span ref={dragDisabled ? undefined : handleRef} className={`drag-handle${isDestination ? " placeholder" : ""}${mobileReorderDisabled ? " disabled" : ""}`} aria-label={isDestination ? "도착지는 순서를 변경할 수 없습니다." : "드래그하여 순서 변경"} title={isDestination ? "도착지는 순서를 변경할 수 없습니다." : "드래그하여 순서 변경"}>⠿</span>
        <div className={`place-badge${isStart ? " start" : isDestination ? " destination" : ""}`}>{index + 1}</div>
        <div className="place-main">
          <strong>{place.name}</strong>
          <small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small>
        </div>
        <div className="place-mobile-status" aria-label="장소 상태">
          {canSetStayDuration && stayDuration > 0 && (
            <span className="place-stay-badge"><Clock3 aria-hidden="true" /> {stayDuration}분</span>
          )}
          {canSetStayDuration && isOrderLocked && (
            <span className="place-lock-badge" aria-label="순서 보장"><Lock aria-hidden="true" /></span>
          )}
        </div>
        <div className="place-actions">
          <button
            type="button"
            className="danger icon-action place-delete-action"
            aria-label={`${place.name} 삭제`}
            title="삭제"
            onClick={(event) => {
              stopCardToggle(event);
              onRemove(place.id);
            }}
          >
            <Trash2 aria-hidden="true" />
            <span className="place-action-label">삭제</span>
          </button>
          {onSavePlace && (
            <button
              type="button"
              className="icon-action place-save-action"
              aria-label={`${place.name} 장소 리스트에 저장`}
              title="장소 리스트에 저장"
              onClick={(event) => {
                stopCardToggle(event);
                onSavePlace({
                  name: place.name,
                  address: place.address,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  stayDurationMinutes: 0,
                });
              }}
            >
              <ListPlus aria-hidden="true" />
              <span className="place-action-label">리스트 저장</span>
            </button>
          )}
          {canSetStayDuration && (
            <button
              type="button"
              className={`place-order-lock icon-action${isOrderLocked ? " locked" : ""}`}
              aria-label={isOrderLocked ? `${index + 1}번째 방문 순서 고정 해제` : `${index + 1}번째 방문 순서 고정`}
              title={isOrderLocked ? "순서 고정 해제" : "현재 순서 고정"}
              aria-pressed={isOrderLocked}
              onClick={(event) => {
                stopCardToggle(event);
                onFixedVisitOrderChange(place.id, index + 1);
              }}
            >
              {isOrderLocked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
              <span className="place-action-label">{isOrderLocked ? "순서 해제" : "순서 보장"}</span>
            </button>
          )}
        </div>
        {isStayEditing && canSetStayDuration && (
          <div className="place-stay-control" onClick={stopCardToggle} aria-label="머무는 시간 설정">
            <span>머무는 시간</span>
            <div className="stay-stepper">
              <button
                className="stay-step"
                type="button"
                aria-label="머무는 시간 5분 줄이기"
                onPointerDown={(event) => startStayStepHold(event, -5)}
                onPointerUp={clearStayStepHold}
                onPointerCancel={clearStayStepHold}
                onPointerLeave={clearStayStepHold}
                onClick={(event) => {
                  if (event.detail !== 0) return;
                  stopCardToggle(event);
                  applyStayStep(-5);
                }}
              >
                −
              </button>
              <div className="stay-value">

              <input
                className="stay-duration-input"
                type="number"
                min="0"
                max="1440"
                step="1"
                inputMode="numeric"
                aria-label="머무는 시간(분)"
                value={stayInput}
                onPointerDown={(event) => { event.stopPropagation(); onMobileInputFocus?.(); }}
                onFocus={() => onMobileInputFocus?.()}
                onChange={(event) => setStayInput(event.target.value)}
                onBlur={commitStayDuration}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
              <span className="stay-duration-unit" aria-hidden="true">분</span>
              </div>

              <button
                className="stay-step"
                type="button"
                aria-label="머무는 시간 5분 늘리기"
                onPointerDown={(event) => startStayStepHold(event, 5)}
                onPointerUp={clearStayStepHold}
                onPointerCancel={clearStayStepHold}
                onPointerLeave={clearStayStepHold}
                onClick={(event) => {
                  if (event.detail !== 0) return;
                  stopCardToggle(event);
                  applyStayStep(5);
                }}
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="mobile-swipe-action-tray" inert={mobileSwipe !== "actions"}>
        <button type="button" className="mobile-swipe-delete" aria-label={`${place.name} 삭제`} title="삭제" onClick={(event) => { stopCardToggle(event); onRemove(place.id); }}>
          <Trash2 aria-hidden="true" />
        </button>
        {onSavePlace && (
          <button type="button" className="mobile-swipe-save" aria-label={`${place.name} 장소 리스트에 저장`} title="리스트 저장" onClick={(event) => {
            stopCardToggle(event);
            onSavePlace({ name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude, stayDurationMinutes: 0 });
          }}>
            <ListPlus aria-hidden="true" />
          </button>
        )}
        {canSetStayDuration && (
          <button type="button" className={`mobile-swipe-lock${isOrderLocked ? " locked" : ""}`} aria-label={isOrderLocked ? `${index + 1}번째 방문 순서 고정 해제` : `${index + 1}번째 방문 순서 고정`} title={isOrderLocked ? "순서 고정 해제" : "순서 보장"} aria-pressed={isOrderLocked} onClick={(event) => {
            stopCardToggle(event);
            onFixedVisitOrderChange(place.id, index + 1);
          }}>
            {isOrderLocked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
          </button>
        )}
      </div>
      {canSetStayDuration && (
        <div className="mobile-swipe-stay-tray" inert={mobileSwipe !== "stay"}>
          <button type="button" aria-label="머무는 시간 5분 줄이기" onPointerDown={(event) => startStayStepHold(event, -5)} onPointerUp={clearStayStepHold} onPointerCancel={clearStayStepHold} onClick={(event) => { if (event.detail !== 0) return; stopCardToggle(event); applyStayStep(-5); }}>−</button>
          <input type="number" min="0" max="1440" step="1" inputMode="numeric" aria-label="머무는 시간(분)" value={stayInput} onPointerDown={(event) => { event.stopPropagation(); onMobileInputFocus?.(); }} onFocus={() => onMobileInputFocus?.()} onChange={(event) => setStayInput(event.target.value)} onBlur={commitStayDuration} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          <span aria-hidden="true">분</span>
          <button type="button" aria-label="머무는 시간 5분 늘리기" onPointerDown={(event) => startStayStepHold(event, 5)} onPointerUp={clearStayStepHold} onPointerCancel={clearStayStepHold} onClick={(event) => { if (event.detail !== 0) return; stopCardToggle(event); applyStayStep(5); }}>+</button>
        </div>
      )}
    </li>
  );
}

function useMobileActionSwipe() {
  const [isOpen, setIsOpen] = useState(false);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches;
  }

  function onPointerDownCapture(event: ReactPointerEvent<HTMLElement>) {
    if (!isMobileViewport() || event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
    startRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerUpCapture(event: ReactPointerEvent<HTMLElement>) {
    const start = startRef.current;
    startRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) < 44 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) {
      if (isOpen) setIsOpen(false);
      return;
    }
    setIsOpen(horizontalDistance < 0);
  }

  return { isOpen, onPointerDownCapture, onPointerUpCapture, onPointerCancelCapture: () => { startRef.current = null; } };
}

function ReturnStop({ place, index, onReturnChange, onSavePlace }: {
  place: Place;
  index: number;
  onReturnChange: (value: boolean) => void;
  onSavePlace?: (place: Omit<Place, "id" | "type">) => void;
}) {
  const swipe = useMobileActionSwipe();
  return (
    <li className={`place-item return-stop${swipe.isOpen ? " mobile-swipe-actions" : ""}`} onPointerDownCapture={swipe.onPointerDownCapture} onPointerUpCapture={swipe.onPointerUpCapture} onPointerCancelCapture={swipe.onPointerCancelCapture}>
      <span className="drag-handle placeholder" aria-hidden="true">⠿</span>
      <div className="place-badge destination">{index + 1}</div>
      <div className="place-main">
        <strong>{place.name}</strong>
        <small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small>
      </div>
      <div className="place-actions">
        <button type="button" className="danger icon-action place-delete-action" aria-label="복귀 지점 제거" title="복귀 해제" onClick={() => onReturnChange(false)}>
          <Trash2 aria-hidden="true" />
          <span className="place-action-label">복귀 해제</span>
        </button>
        {onSavePlace && (
          <button type="button" className="icon-action place-save-action" aria-label={`${place.name} 장소 리스트에 저장`} title="장소 리스트에 저장" onClick={() => onSavePlace({ name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude, stayDurationMinutes: 0 })}>
            <ListPlus aria-hidden="true" />
            <span className="place-action-label">리스트 저장</span>
          </button>
        )}
      </div>
    </li>
  );
}

export function PlaceList({
  places,
  returnToStart,
  fixedVisitOrders,
  onReturnChange,
  onReset,
  onRemove,
  onReorder,
  onStayDurationChange,
  onFixedVisitOrderChange,
  onSavePlace,
  currentLocationActive,
  currentLocationLocating,
  onCurrentLocationToggle,
  onSavedPlacesOpen,
  onMobileInputFocus,
  mobileSheetExpanded,
  isLoading = false,
}: Props) {
  const [stayEditingPlaceId, setStayEditingPlaceId] = useState<string | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [isMobileViewportActive, setIsMobileViewportActive] = useState(false);
  const didDragRef = useRef(false);
  const dragReleaseTimeoutRef = useRef<number | null>(null);
  const resetConfirmationExpiresAtRef = useRef(0);
  const fixedPlaceIds = new Set(fixedVisitOrders.map((fixed) => fixed.placeId));
  const returnStop = returnToStart && places[0] ? places[0] : null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 700px)");
    const syncViewport = () => setIsMobileViewportActive(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!stayEditingPlaceId) return;
    if (!places.some((place) => place.id === stayEditingPlaceId)) setStayEditingPlaceId(null);
  }, [places, stayEditingPlaceId]);

  useEffect(() => () => {
    if (dragReleaseTimeoutRef.current !== null) window.clearTimeout(dragReleaseTimeoutRef.current);
  }, []);

  function adjustStayDuration(id: string, delta: number) {
    const currentMinutes = places.find((place) => place.id === id)?.stayDurationMinutes ?? 0;
    const nextMinutes = Math.min(1_440, Math.max(0, currentMinutes + delta));
    onStayDurationChange(id, nextMinutes);
  }

  function handleCardClick(event: MouseEvent<HTMLElement>, place: Place) {
    if (didDragRef.current || (event.target as HTMLElement).closest("button, input, .drag-handle, .place-stay-control")) return;
    setStayEditingPlaceId((current) => (current === place.id ? null : place.id));
  }

  function handleReset() {
    if (Date.now() < resetConfirmationExpiresAtRef.current) {
      resetConfirmationExpiresAtRef.current = 0;
      onReset();
      return;
    }

    resetConfirmationExpiresAtRef.current = Date.now() + 3_000;
    notify.info("한 번 더 누르면 모든 방문 장소가 삭제됩니다.");
  }
  function finishDrag() {
    setIsSorting(false);
    if (dragReleaseTimeoutRef.current !== null) window.clearTimeout(dragReleaseTimeoutRef.current);
    dragReleaseTimeoutRef.current = window.setTimeout(() => {
      didDragRef.current = false;
      dragReleaseTimeoutRef.current = null;
    }, 240);
  }

  return (
    <section className="place-section">
      <div className="section-heading">
        <h2>방문 장소</h2>
        <div className="place-heading-actions">
          {onSavedPlacesOpen && (
            <button
              type="button"
              className="saved-places-toggle"
              aria-label="장소 리스트 열기"
              title="장소 리스트"
              onClick={onSavedPlacesOpen}
            >
              <List size={17} aria-hidden="true" />
              <span>장소 리스트</span>
            </button>
          )}
          <button
            type="button"
            className={`current-location-toggle${currentLocationActive ? " active" : ""}${currentLocationLocating ? " locating" : ""}`}
            aria-label="현재 위치"
            aria-pressed={currentLocationActive}
            title="현재 위치를 업데이트합니다."
            onClick={onCurrentLocationToggle}
            disabled={currentLocationLocating}
          >
            <LocateFixed size={18} aria-hidden="true" />
            <span>현재 위치</span>
          </button>
          <button type="button" className="place-return-toggle" aria-pressed={returnToStart} onClick={() => onReturnChange(!returnToStart)} title="출발지로 복귀">
            {returnToStart ? <SquareCheck aria-hidden="true" /> : <Square aria-hidden="true" />}
            <span>복귀</span>
          </button>
          <button type="button" className="place-reset-action" onClick={handleReset} title="방문 장소 초기화">
            <RotateCcw aria-hidden="true" />
            <span>초기화</span>
          </button>
        </div>
      </div>      <div className="place-list-scroll">
        {isLoading ? (
          <ContentLoading variant="places" />
        ) : places.length === 0 ? (
          <div className="place-empty-state">
            <img src="/icons/nothing.png" alt="" aria-hidden="true" />
            <p>동선을 최적화 할 장소를 추가하세요.</p>
          </div>
        ) : (
        <DragDropProvider
        sensors={sortableSensors}
        onDragStart={() => {
          navigator.vibrate?.(80);
          if (dragReleaseTimeoutRef.current !== null) window.clearTimeout(dragReleaseTimeoutRef.current);
          didDragRef.current = true;
          setIsSorting(true);
          setStayEditingPlaceId(null);
        }}
        onDragEnd={(event) => {
          const source = event.operation.source;
          if (!event.canceled && source && "initialIndex" in source && "index" in source && typeof source.initialIndex === "number" && typeof source.index === "number") {
            const sourceId = String(source.id);
            const destinationIndex = source.index;

            if (source.initialIndex !== destinationIndex) onReorder(sourceId, destinationIndex);
          }
          finishDrag();
        }}
      >
        <ol className={`place-list${isSorting ? " dnd-sorting" : ""}`}>
          {places.map((place, index) => {
            const isStart = index === 0;
            const isDestination = !returnToStart && index === places.length - 1;
            const canSetStayDuration = !place.isCurrentLocation && !isStart && !isDestination;

            return (
              <SortablePlaceItem
                key={place.id}
                place={place}
                index={index}
                isStart={isStart}
                isDestination={isDestination}
                canSetStayDuration={canSetStayDuration}
                isOrderLocked={fixedPlaceIds.has(place.id)}
                isSelected={stayEditingPlaceId === place.id}
                isStayEditing={stayEditingPlaceId === place.id && canSetStayDuration}
                mobileSheetExpanded={mobileSheetExpanded}
                isMobileViewportActive={isMobileViewportActive}
                onCardClick={handleCardClick}
                onFixedVisitOrderChange={onFixedVisitOrderChange}
                onSavePlace={onSavePlace}
                onRemove={onRemove}
                onStayDurationChange={adjustStayDuration}
                onMobileInputFocus={onMobileInputFocus}
              />
            );
          })}
          {returnStop && <ReturnStop place={returnStop} index={places.length} onReturnChange={onReturnChange} onSavePlace={onSavePlace} />}
          </ol>
        </DragDropProvider>
        )}
      </div>
    </section>
  );
}
