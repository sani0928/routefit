"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { ListPlus, Lock, LockOpen, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { FixedVisitOrder, Place } from "@/features/route-optimization/types/route.types";

interface Props {
  places: Place[];
  returnToStart: boolean;
  fixedVisitOrders: FixedVisitOrder[];
  onReturnChange: (value: boolean) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, destinationIndex: number) => void;
  onStayDurationChange: (id: string, minutes: number) => void;
  onFixedVisitOrderChange: (placeId: string, visitOrder: number) => void;
  onSavePlace?: (place: Omit<Place, "id" | "type">) => void;
}

type SortablePlaceItemProps = {
  place: Place;
  index: number;
  isStart: boolean;
  isDestination: boolean;
  canSetStayDuration: boolean;
  isOrderLocked: boolean;
  isStayEditing: boolean;
  onCardClick: (event: MouseEvent<HTMLDivElement>, place: Place) => void;
  onFixedVisitOrderChange: (placeId: string, visitOrder: number) => void;
  onSavePlace?: (place: Omit<Place, "id" | "type">) => void;
  onRemove: (id: string) => void;
  onStayDurationChange: (id: string, delta: number) => void;
};

function SortablePlaceItem({
  place,
  index,
  isStart,
  isDestination,
  canSetStayDuration,
  isOrderLocked,
  isStayEditing,
  onCardClick,
  onFixedVisitOrderChange,
  onSavePlace,
  onRemove,
  onStayDurationChange,
}: SortablePlaceItemProps) {
  const { ref, isDragging, isDropTarget } = useSortable({
    id: place.id,
    index,
    transition: { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)", idle: true },
  });
  const stayDuration = place.stayDurationMinutes ?? 0;

  function stopCardToggle(event: MouseEvent<HTMLButtonElement | HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <li
      ref={ref}
      className={`sortable-place-item${isDragging ? " dragging" : ""}${isDropTarget && !isDragging ? " dnd-drop-target" : ""}`}
    >
      <div
        className={`place-item draggable${isDragging ? " dragging" : ""}${isDropTarget && !isDragging ? " dnd-drop-target" : ""}${isStayEditing ? " editing-stay" : ""}${canSetStayDuration && stayDuration > 0 ? " has-stay-duration" : ""}`}
        onClick={(event) => onCardClick(event, place)}
      >
        <span className="drag-handle" aria-label="드래그하여 순서 변경" title="드래그하여 순서 변경">⠿</span>
        <div className={`place-badge${isStart ? " start" : isDestination ? " destination" : ""}`}>{index + 1}</div>
        <div className="place-main">
          <strong>{place.name}</strong>
          <small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small>
        </div>
        <div className="place-actions">
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
            </button>
          )}
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
            </button>
          )}
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
          </button>
        </div>
        {isStayEditing && canSetStayDuration && (
          <div className="place-stay-control" onClick={stopCardToggle} aria-label="머무는 시간 설정">
            <span>머무는 시간</span>
            <div className="stay-stepper">
              <button
                className="stay-step"
                type="button"
                aria-label="머무는 시간 5분 줄이기"
                onClick={(event) => {
                  stopCardToggle(event);
                  onStayDurationChange(place.id, -5);
                }}
              >
                −
              </button>
              <output aria-live="polite">{stayDuration}분</output>
              <button
                className="stay-step"
                type="button"
                aria-label="머무는 시간 5분 늘리기"
                onClick={(event) => {
                  stopCardToggle(event);
                  onStayDurationChange(place.id, 5);
                }}
              >
                +
              </button>
            </div>
          </div>
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
  onRemove,
  onReorder,
  onStayDurationChange,
  onFixedVisitOrderChange,
  onSavePlace,
}: Props) {
  const [stayEditingPlaceId, setStayEditingPlaceId] = useState<string | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const didDragRef = useRef(false);
  const fixedPlaceIds = new Set(fixedVisitOrders.map((fixed) => fixed.placeId));
  const returnStop = returnToStart && places[0] ? places[0] : null;

  useEffect(() => {
    if (!stayEditingPlaceId) return;
    const index = places.findIndex((place) => place.id === stayEditingPlaceId);
    const canKeepEditing = index > 0 && (returnToStart || index < places.length - 1);

    if (!canKeepEditing) setStayEditingPlaceId(null);
  }, [places, returnToStart, stayEditingPlaceId]);

  function adjustStayDuration(id: string, delta: number) {
    const currentMinutes = places.find((place) => place.id === id)?.stayDurationMinutes ?? 0;
    const nextMinutes = Math.min(1_440, Math.max(0, Math.round(currentMinutes / 5) * 5 + delta));
    onStayDurationChange(id, nextMinutes);
  }

  function handleCardClick(event: MouseEvent<HTMLDivElement>, place: Place) {
    const index = places.findIndex((item) => item.id === place.id);
    const canSetStayDuration = index > 0 && (returnToStart || index < places.length - 1);

    if (didDragRef.current || !canSetStayDuration || (event.target as HTMLElement).closest("button, .drag-handle, .place-stay-control")) return;
    setStayEditingPlaceId((current) => (current === place.id ? null : place.id));
  }

  function finishDrag() {
    setIsSorting(false);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }

  return (
    <section className="place-section">
      <div className="section-heading">
        <h2>방문 장소</h2>
        <label className="toggle place-return-toggle">
          <input type="checkbox" checked={returnToStart} onChange={(event) => onReturnChange(event.target.checked)} /> 출발지로 복귀
        </label>
      </div>
      {places.length === 0 && <p className="place-empty-hint">검색하거나 지도에서 장소를 선택하세요.</p>}
      <DragDropProvider
        onDragStart={() => {
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
            const canSetStayDuration = !isStart && !isDestination;

            return (
              <SortablePlaceItem
                key={place.id}
                place={place}
                index={index}
                isStart={isStart}
                isDestination={isDestination}
                canSetStayDuration={canSetStayDuration}
                isOrderLocked={fixedPlaceIds.has(place.id)}
                isStayEditing={stayEditingPlaceId === place.id}
                onCardClick={handleCardClick}
                onFixedVisitOrderChange={onFixedVisitOrderChange}
                onSavePlace={onSavePlace}
                onRemove={onRemove}
                onStayDurationChange={adjustStayDuration}
              />
            );
          })}
          {returnStop && (
            <li className="place-item return-stop">
              <span className="drag-handle placeholder" aria-hidden="true">⠿</span>
              <div className="place-badge destination">{places.length + 1}</div>
              <div className="place-main">
                <strong>{returnStop.name}</strong>
                <small>{returnStop.address || `${returnStop.latitude.toFixed(5)}, ${returnStop.longitude.toFixed(5)}`}</small>
              </div>
            </li>
          )}
        </ol>
      </DragDropProvider>
    </section>
  );
}